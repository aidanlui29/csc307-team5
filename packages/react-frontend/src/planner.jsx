import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authHeaders } from "./auth";
import "./planner.css";
import { Pencil, Trash2, Clock, X } from "lucide-react";

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addWeeks(date, n) {
  return addDays(date, n * 7);
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthTitleForWeek(weekStart) {
  const weekEnd = addDays(weekStart, 6);
  const startMonth = weekStart.toLocaleString(undefined, {
    month: "long"
  });
  const endMonth = weekEnd.toLocaleString(undefined, {
    month: "long"
  });
  const startYear = weekStart.getFullYear();
  const endYear = weekEnd.getFullYear();

  if (
    weekStart.getMonth() === weekEnd.getMonth() &&
    startYear === endYear
  )
    return `${startMonth} ${startYear}`;
  if (startYear === endYear)
    return `${startMonth} – ${endMonth} ${startYear}`;
  return `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
}

function formatHour(hour24) {
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const ampm = hour24 < 12 ? "AM" : "PM";
  return `${hour12} ${ampm}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateInputValue(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function minutesToLabel(mins) {
  const total = Number(mins ?? 0);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad2(m)}${ampm}`;
}

// Used only for one-time migration from the original localStorage version.
function storageKey(id) {
  return `plannerEvents_v1_${id || "default"}`;
}

// Normalizes backend event identifiers so the UI can always use ev.id.
function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id ?? raw._id ?? raw.eventId ?? raw._eventId;
  if (!id) return { ...raw, id: undefined };
  return { ...raw, id };
}

// Converts a hex color into a translucent background tint for event cards.
function hexToRgba(hex, alpha) {
  if (typeof hex !== "string") return null;
  const h = hex.trim().replace("#", "");
  if (![3, 6].includes(h.length)) return null;

  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Generates a stable-enough id for grouping repeated events into a series.
function makeSeriesId() {
  return `series_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const DEFAULT_COLOR_SCHEDULE = "#22c55e";
const DEFAULT_COLOR_TASK = "#7c3aed";

const EVENT_COLOR_OPTIONS = [
  "#22c55e",
  "#7c3aed",
  "#3b82f6",
  "#06b6d4",
  "#f97316",
  "#ef4444",
  "#eab308",
  "#8b5cf6",
  "#14b8a6",
  "#ec4899",
  "#64748b",
  "#9ca3af"
];

export default function Planner() {
  const { id } = useParams();
  const navigate = useNavigate();

  const dayNames = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat"
  ];

  const [anchorDate, setAnchorDate] = useState(
    () => new Date()
  );
  const [now, setNow] = useState(() => new Date());

  const [events, setEvents] = useState([]);
  const [pageError, setPageError] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [clockInEvent, setClockInEvent] = useState(null);
  const [dismissedClockInIds, setDismissedClockInIds] =
    useState(() => new Set());
  const [shownClockInId, setShownClockInId] = useState(null);

  // Loads planner events from the API and migrates legacy localStorage data once.
  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setLoadingEvents(true);
      setPageError("");

      try {
        const res = await fetch(`/api/planners/${id}/events`, {
          headers: authHeaders()
        });

        if (res.status === 401) {
          navigate("/login");
          return;
        }
        if (!res.ok) {
          const msg = await res.text();
          if (!cancelled)
            setPageError(msg || "Failed to load events");
          return;
        }

        const data = await res.json();
        const serverEvents = (Array.isArray(data) ? data : [])
          .map(normalizeEvent)
          .filter(Boolean);

        if (!cancelled) setEvents(serverEvents);

        const migratedFlag = `clockedInMigratedEvents_v1_${id}`;
        const alreadyMigrated =
          localStorage.getItem(migratedFlag) === "1";

        if (!alreadyMigrated) {
          let legacy = [];
          try {
            const raw = localStorage.getItem(storageKey(id));
            legacy = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(legacy)) legacy = [];
          } catch {
            legacy = [];
          }

          // Migration only runs when the server does not already have events.
          if (legacy.length > 0 && serverEvents.length === 0) {
            for (const ev of legacy) {
              if (!ev?.title || !ev?.date || !ev?.kind)
                continue;
              if (
                typeof ev.startMin !== "number" ||
                typeof ev.endMin !== "number"
              )
                continue;

              const priority =
                ev.kind === "task"
                  ? ev.priority || "medium"
                  : undefined;
              const completed =
                ev.kind === "task"
                  ? Boolean(ev.completed)
                  : undefined;

              const createRes = await fetch(
                `/api/planners/${id}/events`,
                {
                  method: "POST",
                  headers: {
                    ...authHeaders(),
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    kind: ev.kind,
                    date: ev.date,
                    title: ev.title,
                    desc: ev.desc || "",
                    startMin: ev.startMin,
                    endMin: ev.endMin,
                    priority,
                    completed,
                    color: ev.color || null
                  })
                }
              );

              if (createRes.status === 401) {
                navigate("/login");
                return;
              }
            }

            const res2 = await fetch(
              `/api/planners/${id}/events`,
              {
                headers: authHeaders()
              }
            );
            if (res2.ok) {
              const data2 = await res2.json();
              const normalized = (
                Array.isArray(data2) ? data2 : []
              )
                .map(normalizeEvent)
                .filter(Boolean);
              if (!cancelled) setEvents(normalized);
            }
          }

          localStorage.setItem(migratedFlag, "1");
        }
      } catch {
        if (!cancelled)
          setPageError(
            "Network error. Is the backend running?"
          );
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    }

    if (id) fetchEvents();

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const [focusOpen, setFocusOpen] = useState(false);
  const [focusMode, setFocusMode] = useState("work");

  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);

  const [, setDurationSec] = useState(25 * 60);
  const [remainingSec, setRemainingSec] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  function getModeDurationSec(mode) {
    const mins = mode === "work" ? workMinutes : breakMinutes;
    const safeMins = Math.max(1, Number(mins) || 1);
    return safeMins * 60;
  }

  function openFocus() {
    setFocusOpen(true);
    setIsRunning(false);
    const d = getModeDurationSec(focusMode);
    setDurationSec(d);
    setRemainingSec(d);
  }

  function closeFocus() {
    setFocusOpen(false);
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function setMode(mode) {
    setFocusMode(mode);
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    const d = getModeDurationSec(mode);
    setDurationSec(d);
    setRemainingSec(d);
  }

  function startTimer() {
    if (isRunning) return;
    setIsRunning(true);
  }

  function endTimer() {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    const d = getModeDurationSec(focusMode);
    setDurationSec(d);
    setRemainingSec(d);
  }

  function formatMMSS(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // Runs the focus timer countdown while the timer is active.
  useEffect(() => {
    if (!isRunning) return;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isRunning]);

  const [addOpen, setAddOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const [priority, setPriority] = useState("medium");
  const [completed, setCompleted] = useState(false);

  const [color, setColor] = useState(DEFAULT_COLOR_SCHEDULE);

  const today = now;
  const todayIndex = today.getDay();

  const weekStart = useMemo(
    () => startOfWeek(anchorDate),
    [anchorDate]
  );
  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        addDays(weekStart, i)
      ),
    [weekStart]
  );
  const isCurrentWeek = useMemo(() => {
    const currentWeekStart = startOfWeek(today);
    return sameDay(currentWeekStart, weekStart);
  }, [today, weekStart]);

  const START_HOUR = 0;
  const END_HOUR = 23;
  const hours = useMemo(
    () =>
      Array.from(
        { length: END_HOUR - START_HOUR + 1 },
        (_, i) => i + START_HOUR
      ),
    []
  );

  const gridRef = useRef(null);
  const [layout, setLayout] = useState(null);

  // Reads rendered grid measurements so events and the current-time line can be positioned accurately.
  useEffect(() => {
    const computeLayout = () => {
      if (!gridRef.current) return;
      const grid = gridRef.current;
      const headerEl = grid.querySelector(".planner__header");
      const cellEl = grid.querySelector(".planner__cell");
      if (!headerEl || !cellEl) return;

      const headerH = headerEl.getBoundingClientRect().height;
      const rowH = cellEl.getBoundingClientRect().height;
      setLayout({ headerH, rowH });
    };

    computeLayout();
    window.addEventListener("resize", computeLayout);
    return () =>
      window.removeEventListener("resize", computeLayout);
  }, []);

  const nowIntervalRef = useRef(null);

  // Updates the current time once per minute so time-based UI stays aligned.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const msToNextMinute =
      (60 - new Date().getSeconds()) * 1000 -
      new Date().getMilliseconds();

    const t = setTimeout(() => {
      tick();
      nowIntervalRef.current = setInterval(tick, 60 * 1000);
    }, msToNextMinute);

    return () => {
      clearTimeout(t);
      if (nowIntervalRef.current)
        clearInterval(nowIntervalRef.current);
      nowIntervalRef.current = null;
    };
  }, []);

  // Finds the next upcoming event and shows a single clock-in toast within 30 minutes of its start time.
  useEffect(() => {
    if (!events || events.length === 0) {
      setClockInEvent(null);
      return;
    }

    const nowMs = now.getTime();

    const startDateTime = (ev) => {
      const base = new Date(`${ev.date}T00:00:00`);
      const startMin = Number(ev.startMin ?? 0);
      base.setMinutes(base.getMinutes() + startMin);
      return base;
    };

    const endDateTime = (ev) => {
      const base = new Date(`${ev.date}T00:00:00`);
      const endMin = Number(ev.endMin ?? ev.startMin ?? 0);
      base.setMinutes(base.getMinutes() + endMin);
      return base;
    };

    const upcoming = events
      .filter((ev) => ev?.id && !dismissedClockInIds.has(ev.id))
      .map((ev) => ({ ev, start: startDateTime(ev) }))
      .filter(({ start }) => start.getTime() >= nowMs)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const next = upcoming[0]?.ev ?? null;
    if (!next) {
      setClockInEvent(null);
      return;
    }

    const nextStart = startDateTime(next).getTime();
    const diffMin = (nextStart - nowMs) / 60000;

    // The toast only appears for the immediate next event and does not auto-cycle forward.
    if (diffMin >= 0 && diffMin <= 30) {
      if (
        shownClockInId === next.id ||
        clockInEvent?.id === next.id
      ) {
        if (clockInEvent?.id !== next.id) setClockInEvent(next);
        return;
      }

      setClockInEvent(next);
      setShownClockInId(next.id);
      return;
    }

    if (clockInEvent) {
      const endMs = endDateTime(clockInEvent).getTime();
      if (nowMs > endMs) setClockInEvent(null);
    }
  }, [
    events,
    now,
    dismissedClockInIds,
    shownClockInId,
    clockInEvent
  ]);

  const [nowLineStyle, setNowLineStyle] = useState(null);

  // Positions the current-time line within today's column for the visible week.
  useEffect(() => {
    if (!gridRef.current || !layout) return;
    if (!isCurrentWeek) {
      setNowLineStyle(null);
      return;
    }

    const minutesIntoDay =
      now.getHours() * 60 + now.getMinutes();
    const startMinutes = START_HOUR * 60;
    const endMinutes = (END_HOUR + 1) * 60;

    if (
      minutesIntoDay < startMinutes ||
      minutesIntoDay > endMinutes
    ) {
      setNowLineStyle(null);
      return;
    }

    const grid = gridRef.current;
    const todayHeaderEl = grid.querySelector(
      `[data-day-index="${todayIndex}"]`
    );
    if (!todayHeaderEl) return;

    const gridRect = grid.getBoundingClientRect();
    const todayRect = todayHeaderEl.getBoundingClientRect();

    const minutesFromStart = minutesIntoDay - startMinutes;
    const top =
      layout.headerH + (minutesFromStart / 60) * layout.rowH;

    const left = todayRect.left - gridRect.left;
    const width = todayRect.width;

    setNowLineStyle({
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`
    });
  }, [now, isCurrentWeek, todayIndex, layout]);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("schedule");
  const [dateStr, setDateStr] = useState(() =>
    toDateInputValue(new Date())
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [desc, setDesc] = useState("");

  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatEveryWeeks, setRepeatEveryWeeks] = useState(2);
  const [repeatUntil, setRepeatUntil] = useState(() =>
    toDateInputValue(new Date())
  );
  const [repeatDays, setRepeatDays] = useState(() => {
    const d = new Date();
    const init = Array(7).fill(false);
    init[d.getDay()] = true;
    return init;
  });

  const [seriesId, setSeriesId] = useState(null);

  function setRepeatDaysDefaultForDate(dateISO) {
    const d = new Date(`${dateISO}T00:00:00`);
    const idx = Number.isNaN(d.getTime())
      ? new Date().getDay()
      : d.getDay();
    const arr = Array(7).fill(false);
    arr[idx] = true;
    setRepeatDays(arr);
  }

  function applyRecurrenceFromEvent(ev) {
    const rec = ev?.recurrence;
    if (!rec || typeof rec !== "object") {
      setRepeatEnabled(false);
      setRepeatEveryWeeks(2);
      setRepeatUntil(ev?.date || toDateInputValue(new Date()));
      setRepeatDaysDefaultForDate(
        ev?.date || toDateInputValue(new Date())
      );
      setSeriesId(null);
      return;
    }

    setRepeatEnabled(true);

    // The UI only supports weekly or every-other-week recurrence.
    const ew = Number(rec.everyWeeks);
    setRepeatEveryWeeks(ew === 1 ? 1 : 2);

    setRepeatUntil(rec.until || ev.date);

    if (Array.isArray(rec.days) && rec.days.length === 7) {
      setRepeatDays(rec.days.map(Boolean));
    } else {
      setRepeatDaysDefaultForDate(ev.date);
    }

    setSeriesId(ev.seriesId || null);
  }

  function openAddNew() {
    setSelectedEventId(null);
    setEditingId(null);
    setFormError("");
    setTitle("");
    setDesc("");
    setKind("schedule");

    const todayStr = toDateInputValue(new Date());
    setDateStr(todayStr);
    setStartTime("09:00");
    setEndTime("10:00");

    setRepeatEnabled(false);
    setRepeatEveryWeeks(2);
    setRepeatUntil(todayStr);
    setRepeatDaysDefaultForDate(todayStr);
    setSeriesId(null);

    setPriority("medium");
    setCompleted(false);

    setColor(DEFAULT_COLOR_SCHEDULE);

    setAddOpen(true);
  }

  function openEdit(ev) {
    setSelectedEventId(null);
    setFormError("");
    setEditingId(ev.id);
    setTitle(ev.title);
    setDesc(ev.desc || "");
    setKind(ev.kind);
    setDateStr(ev.date);
    setStartTime(minutesToTime(ev.startMin));
    setEndTime(minutesToTime(ev.endMin));

    setPriority(ev.priority || "medium");
    setCompleted(Boolean(ev.completed));

    setColor(
      ev.color ||
        (ev.kind === "task"
          ? DEFAULT_COLOR_TASK
          : DEFAULT_COLOR_SCHEDULE)
    );

    applyRecurrenceFromEvent(ev);

    setAddOpen(true);
  }

  function closeAdd() {
    if (savingEvent) return;
    setAddOpen(false);
    setFormError("");
    setEditingId(null);
  }

  // Resets the modal color to the default schedule color when switching event type.
  function setKindToSchedule() {
    setKind("schedule");
    setColor(DEFAULT_COLOR_SCHEDULE);
  }

  // Resets the modal color to the default task color when switching event type.
  function setKindToTask() {
    setKind("task");
    setColor(DEFAULT_COLOR_TASK);
  }

  async function postOneEvent(payloadForDate) {
    const res = await fetch(`/api/planners/${id}/events`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payloadForDate)
    });

    if (res.status === 401) {
      navigate("/login");
      return { ok: false, unauth: true };
    }
    if (!res.ok) {
      return {
        ok: false,
        message:
          (await res.text()) ||
          "Failed to create recurring event"
      };
    }
    return { ok: true };
  }

  async function refetchEventsAndShowWeek(dateISO) {
    try {
      const res = await fetch(`/api/planners/${id}/events`, {
        headers: authHeaders()
      });
      if (res.status === 401) return navigate("/login");
      if (res.ok) {
        const data = await res.json();
        const normalized = (Array.isArray(data) ? data : [])
          .map(normalizeEvent)
          .filter(Boolean);
        setEvents(normalized);
      }
    } catch {
      // Ignore refetch errors here and preserve the current UI state.
    }

    if (dateISO) {
      const d = new Date(`${dateISO}T00:00:00`);
      if (!Number.isNaN(d.getTime())) setAnchorDate(d);
    }
  }

  // Creates repeated occurrences using the selected weekdays and weekly interval.
  async function createOccurrencesFrom(
    basePayload,
    startDateISO,
    untilISO,
    opts
  ) {
    const {
      everyWeeks,
      daysArray,
      skipFirst,
      seriesIdToUse,
      recurrenceToUse
    } = opts;

    const startDate = new Date(`${startDateISO}T00:00:00`);
    const untilDate = new Date(`${untilISO}T00:00:00`);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(untilDate.getTime())
    )
      throw new Error("Invalid recurrence dates.");
    if (untilDate < startDate)
      throw new Error(
        "Recurrence end date must be on/after the start date."
      );

    const selectedDays = Array.isArray(daysArray)
      ? daysArray
      : Array(7).fill(false);
    if (!selectedDays.some(Boolean))
      throw new Error("Pick at least one day to repeat on.");

    const interval = Math.max(1, Number(everyWeeks) || 1);

    // Anchoring by week start keeps every-other-week patterns consistent.
    const startWeek = startOfWeek(startDate);

    let cursor = new Date(startDate);
    while (cursor <= untilDate) {
      const isFirst = sameDay(cursor, startDate);
      const dayIdx = cursor.getDay();

      const cursorWeek = startOfWeek(cursor);
      const weeksDiff = Math.round(
        (cursorWeek.getTime() - startWeek.getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      const matchesInterval =
        interval === 1 ? true : weeksDiff % interval === 0;

      if (
        matchesInterval &&
        (!skipFirst || !isFirst) &&
        selectedDays[dayIdx]
      ) {
        const payloadForDate = {
          ...basePayload,
          date: toDateInputValue(cursor),
          seriesId: seriesIdToUse,
          recurrence: recurrenceToUse
        };

        const result = await postOneEvent(payloadForDate);
        if (result.unauth) return;
        if (!result.ok) throw new Error(result.message);
      }

      cursor = addDays(cursor, 1);
    }
  }

  async function handleSave() {
    setFormError("");

    if (!title.trim())
      return setFormError("Please enter a title.");

    const sMin = timeToMinutes(startTime);
    const eMin = timeToMinutes(endTime);
    if (eMin <= sMin)
      return setFormError("End time must be after start time.");

    const wantsRecurrence = repeatEnabled && repeatUntil;

    if (wantsRecurrence && !repeatDays.some(Boolean)) {
      return setFormError(
        "Pick at least one day to repeat on."
      );
    }

    setSavingEvent(true);
    try {
      const basePayload = {
        title: title.trim(),
        kind,
        date: dateStr,
        startMin: sMin,
        endMin: eMin,
        desc: desc.trim(),
        color: color || null
      };

      if (kind === "task") {
        basePayload.priority = priority;
        basePayload.completed = completed;
      }

      const seriesIdToUse = wantsRecurrence
        ? seriesId || makeSeriesId()
        : null;

      const recurrenceToUse = wantsRecurrence
        ? {
            everyWeeks: repeatEveryWeeks,
            days: repeatDays,
            until: repeatUntil
          }
        : null;

      if (editingId) {
        const res = await fetch(`/api/events/${editingId}`, {
          method: "PUT",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...basePayload,
            ...(wantsRecurrence
              ? {
                  seriesId: seriesIdToUse,
                  recurrence: recurrenceToUse
                }
              : { seriesId: null, recurrence: null })
          })
        });

        if (res.status === 401) return navigate("/login");
        if (!res.ok)
          throw new Error(
            (await res.text()) || "Failed to update event"
          );

        const updatedRaw = await res.json();
        const updated =
          normalizeEvent(updatedRaw) || updatedRaw;

        setEvents((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e))
        );

        if (wantsRecurrence) {
          await createOccurrencesFrom(
            basePayload,
            dateStr,
            repeatUntil,
            {
              everyWeeks: repeatEveryWeeks,
              daysArray: repeatDays,
              skipFirst: true,
              seriesIdToUse,
              recurrenceToUse
            }
          );
          setSeriesId(seriesIdToUse);
          await refetchEventsAndShowWeek(dateStr);
        } else {
          setSeriesId(null);
          setAnchorDate(new Date(`${dateStr}T00:00:00`));
        }
      } else {
        if (wantsRecurrence) {
          await createOccurrencesFrom(
            basePayload,
            dateStr,
            repeatUntil,
            {
              everyWeeks: repeatEveryWeeks,
              daysArray: repeatDays,
              skipFirst: false,
              seriesIdToUse,
              recurrenceToUse
            }
          );
          setSeriesId(seriesIdToUse);
          await refetchEventsAndShowWeek(dateStr);
        } else {
          const res = await fetch(
            `/api/planners/${id}/events`,
            {
              method: "POST",
              headers: {
                ...authHeaders(),
                "Content-Type": "application/json"
              },
              body: JSON.stringify(basePayload)
            }
          );

          if (res.status === 401) return navigate("/login");
          if (!res.ok)
            throw new Error(
              (await res.text()) || "Failed to create event"
            );

          const createdRaw = await res.json();
          const created =
            normalizeEvent(createdRaw) || createdRaw;

          setEvents((prev) => [...prev, created]);
          setAnchorDate(new Date(`${dateStr}T00:00:00`));
        }
      }

      closeAdd();
    } catch (e) {
      setFormError(e?.message || "Backend error.");
    } finally {
      setSavingEvent(false);
    }
  }

  async function deleteEvent(eventId) {
    setPageError("");
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        headers: authHeaders()
      });

      if (res.status === 401) return navigate("/login");
      if (!res.ok)
        throw new Error(
          (await res.text()) || "Failed to delete event"
        );

      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setSelectedEventId(null);
    } catch (e) {
      setPageError(e?.message || "Failed to delete event.");
    }
  }

  // Calculates absolute positioning for an event block inside the weekly grid.
  function getEventStyle(ev) {
    if (!layout || !gridRef.current) return { display: "none" };

    const selectedDate = new Date(`${ev.date}T00:00:00`);
    const inThisWeek = weekDates.some((d) =>
      sameDay(d, selectedDate)
    );
    if (!inThisWeek) return { display: "none" };

    const dayIdx = weekDates.findIndex((d) =>
      sameDay(d, selectedDate)
    );
    if (dayIdx < 0) return { display: "none" };

    const gridRect = gridRef.current.getBoundingClientRect();
    const dayHeaderEl = gridRef.current.querySelector(
      `[data-day-index="${dayIdx}"]`
    );
    if (!dayHeaderEl) return { display: "none" };

    const dayRect = dayHeaderEl.getBoundingClientRect();
    const left = dayRect.left - gridRect.left;
    const width = dayRect.width;

    const top =
      layout.headerH + (ev.startMin / 60) * layout.rowH;
    const height =
      ((ev.endMin - ev.startMin) / 60) * layout.rowH;

    const base = {
      left: `${left + 8}px`,
      top: `${top + 2}px`,
      width: `${width - 16}px`,
      height: `${Math.max(28, height - 4)}px`
    };

    if (ev.color) {
      const tint = hexToRgba(ev.color, 0.18);
      return {
        ...base,
        borderLeft: `6px solid ${ev.color}`,
        backgroundColor: tint || undefined
      };
    }

    return base;
  }

  // Places the event popover beside the selected event while keeping it inside the grid.
  function getPopoverStyle(ev) {
    if (!gridRef.current) return null;
    const s = getEventStyle(ev);
    if (s.display === "none") return null;

    const gridW = gridRef.current.getBoundingClientRect().width;
    const popW = 360;

    const leftNum = parseFloat(s.left);
    const topNum = parseFloat(s.top);

    let left = leftNum + parseFloat(s.width) + 12;
    let top = topNum;

    if (left + popW > gridW - 8)
      left = Math.max(8, leftNum - popW - 12);
    if (top < 70) top = 70;

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${popW}px`
    };
  }

  const selectedEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId)
    : null;

  return (
    <div
      className={`planner ${focusOpen ? "planner--blurred" : ""}`}
      onClick={() => {
        if (focusOpen) return;
        setSelectedEventId(null);
      }}>
      <div
        className="planner__topbar"
        onClick={(e) => e.stopPropagation()}>
        <div className="planner__left">
          <button
            className="planner__menuIcon"
            type="button"
            aria-label="Open menu"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent("clockedIn:openMenu")
              );
            }}>
            <span className="planner__hamburgerLine" />
            <span className="planner__hamburgerLine" />
            <span className="planner__hamburgerLine" />
          </button>

          <div className="planner__nav">
            <button
              className="planner__navbtn"
              onClick={() =>
                setAnchorDate((d) => addWeeks(d, -1))
              }
              type="button">
              ◀
            </button>
            <button
              className="planner__navbtn"
              onClick={() => setAnchorDate(new Date())}
              type="button">
              Today
            </button>
            <button
              className="planner__navbtn"
              onClick={() =>
                setAnchorDate((d) => addWeeks(d, 1))
              }
              type="button">
              ▶
            </button>
          </div>
        </div>

        <div className="planner__monthTitle">
          {monthTitleForWeek(weekStart)}
        </div>

        <div className="planner__actions">
          <button
            className="planner__add"
            type="button"
            onClick={openAddNew}>
            + add
          </button>
          <button
            className="planner__focus"
            type="button"
            onClick={openFocus}>
            focus
          </button>
        </div>
      </div>

      {clockInEvent && (
        <div
          className="plannerToast"
          role="status"
          aria-live="polite"
          onClick={(e) => e.stopPropagation()}>
          <button
            className="plannerToast__close"
            type="button"
            aria-label="Dismiss notification"
            onClick={() => {
              setDismissedClockInIds((prev) => {
                const next = new Set(prev);
                next.add(clockInEvent.id);
                return next;
              });
              setClockInEvent(null);
            }}>
            <X size={18} />
          </button>

          <div
            className="plannerToast__icon"
            aria-hidden="true">
            <Clock size={36} />
          </div>

          <div className="plannerToast__body">
            <div className="plannerToast__title">
              Hello! It is time to ClockIn!
            </div>
            <div className="plannerToast__msg">
              You have{" "}
              {clockInEvent.kind === "task"
                ? "Task"
                : "Schedule"}{" "}
              - {clockInEvent.title} from{" "}
              {minutesToLabel(clockInEvent.startMin)} -{" "}
              {minutesToLabel(clockInEvent.endMin)}
            </div>
          </div>
        </div>
      )}

      <div
        className="planner__scrollArea"
        onClick={() => {
          if (focusOpen) return;
          setSelectedEventId(null);
        }}>
        <div className="planner__gridwrap" ref={gridRef}>
          <div className="planner__header">
            <div className="planner__timecol" />
            {weekDates.map((d, idx) => (
              <div
                key={idx}
                data-day-index={idx}
                className={`planner__dayheader ${
                  isCurrentWeek && idx === todayIndex
                    ? "planner__dayheader--today"
                    : ""
                }`}>
                <div className="planner__daydate">
                  {d.getDate()}
                </div>
                <div className="planner__dayname">
                  {dayNames[idx]}
                </div>
              </div>
            ))}
          </div>

          {nowLineStyle && (
            <div
              className="planner__nowLine"
              style={nowLineStyle}
              aria-hidden="true"
            />
          )}

          {(loadingEvents || pageError) && (
            <div style={{ padding: 12, opacity: 0.9 }}>
              {loadingEvents ? "Loading events..." : pageError}
            </div>
          )}

          {events.map((ev, idx) => (
            <div
              key={
                ev.id ??
                `${ev.date}-${ev.startMin}-${ev.endMin}-${idx}`
              }
              className={`planner__event ${
                ev.kind === "schedule"
                  ? "planner__event--schedule"
                  : "planner__event--task"
              }`}
              style={getEventStyle(ev)}
              onClick={(e) => {
                e.stopPropagation();
                if (ev.id) setSelectedEventId(ev.id);
              }}
              title={ev.desc || ev.title}>
              <div className="planner__eventTitle">
                {ev.title}
              </div>
            </div>
          ))}

          {selectedEvent && (
            <div
              className="plannerPopover"
              style={getPopoverStyle(selectedEvent)}
              onClick={(e) => e.stopPropagation()}>
              <div className="plannerPopover__title">
                {selectedEvent.title}
              </div>
              <div className="plannerPopover__desc">
                {selectedEvent.desc
                  ? selectedEvent.desc
                  : "description..."}
              </div>

              <div className="plannerPopover__actions">
                <button
                  className="plannerPopover__iconBtn"
                  type="button"
                  title="Edit"
                  onClick={() => openEdit(selectedEvent)}>
                  <Pencil size={28} />
                </button>
                <button
                  className="plannerPopover__iconBtn plannerPopover__iconBtn--danger"
                  type="button"
                  title="Delete"
                  onClick={() => deleteEvent(selectedEvent.id)}>
                  <Trash2 size={28} />
                </button>
              </div>
            </div>
          )}

          {hours.map((hour) => (
            <div key={hour} className="planner__row">
              <div className="planner__time">
                {formatHour(hour)}
              </div>
              {weekDates.map((_, idx) => (
                <div
                  key={`${idx}-${hour}`}
                  className={`planner__cell ${
                    isCurrentWeek && idx === todayIndex
                      ? "planner__cell--today"
                      : ""
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {addOpen && (
        <div
          className="plannerModal"
          role="dialog"
          aria-modal="true"
          onClick={closeAdd}>
          <div className="plannerModal__backdrop" />
          <div
            className="plannerModal__card"
            onClick={(e) => e.stopPropagation()}>
            <div style={{ height: 34 }} aria-hidden="true" />
            <button
              className="plannerModal__close"
              onClick={closeAdd}
              aria-label="Close"
              style={{ top: 18, right: 22 }}
              type="button">
              ✕
            </button>

            <input
              className="plannerModal__title"
              placeholder="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="plannerModal__row">
              {kind === "task" ? (
                <div className="plannerModal__fieldRow">
                  <div className="plannerModal__field">
                    <label>Priority</label>
                    <div className="plannerModal__selectWrap">
                      <select
                        className={`plannerModal__select ${
                          priority === "low"
                            ? "plannerModal__select--low"
                            : priority === "high"
                              ? "plannerModal__select--high"
                              : "plannerModal__select--medium"
                        }`}
                        value={priority}
                        onChange={(e) =>
                          setPriority(e.target.value)
                        }>
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </select>
                    </div>
                  </div>

                  <div className="plannerModal__field">
                    <label>Status</label>
                    <div className="plannerModal__selectWrap">
                      <select
                        className={`plannerModal__select ${
                          completed
                            ? "plannerModal__select--complete"
                            : "plannerModal__select--notcomplete"
                        }`}
                        value={
                          completed ? "complete" : "notcomplete"
                        }
                        onChange={(e) =>
                          setCompleted(
                            e.target.value === "complete"
                          )
                        }>
                        <option value="notcomplete">
                          not complete
                        </option>
                        <option value="complete">
                          complete
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div />
              )}

              <div className="plannerModal__toggle">
                <button
                  type="button"
                  className={`plannerModal__pill ${
                    kind === "schedule"
                      ? "is-active is-schedule"
                      : ""
                  }`}
                  onClick={setKindToSchedule}>
                  schedule
                </button>
                <button
                  type="button"
                  className={`plannerModal__pill ${
                    kind === "task" ? "is-active is-task" : ""
                  }`}
                  onClick={() => {
                    setKindToTask();
                    if (!priority) setPriority("medium");
                  }}>
                  task
                </button>
              </div>
            </div>

            <div className="plannerModal__row plannerModal__row--stack">
              <div className="plannerModal__field">
                <label>Date</label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDateStr(v);
                    if (repeatEnabled)
                      setRepeatDaysDefaultForDate(v);
                  }}
                />
              </div>

              <div className="plannerModal__field plannerModal__field--times">
                <label>Time</label>
                <div className="plannerModal__times">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) =>
                      setStartTime(e.target.value)
                    }
                  />
                  <span className="plannerModal__dash">–</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="plannerModal__field">
              <label>Color</label>
              <div className="colorRowSimple">
                {EVENT_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatchSimple ${color === c ? "selected" : ""}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Select color ${c}`}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="plannerModal__field plannerModal__recur">
              <label>Recurrence</label>

              <label className="plannerModal__recurToggle">
                <input
                  type="checkbox"
                  checked={repeatEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRepeatEnabled(checked);

                    if (checked)
                      setRepeatDaysDefaultForDate(dateStr);

                    if (!checked) setSeriesId(null);
                  }}
                />
                Repeat
              </label>

              {repeatEnabled && (
                <div className="plannerModal__recurGrid">
                  <div className="plannerModal__recurCol">
                    <div className="plannerModal__recurHint">
                      How often
                    </div>
                    <select
                      className="plannerModal__recurControl"
                      value={repeatEveryWeeks}
                      onChange={(e) =>
                        setRepeatEveryWeeks(
                          Number(e.target.value)
                        )
                      }>
                      <option value={1}>Every week</option>
                      <option value={2}>
                        Every other week
                      </option>
                    </select>
                  </div>

                  <div className="plannerModal__recurCol">
                    <div className="plannerModal__recurHint">
                      Repeat on
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap"
                      }}>
                      {dayNames.map((dn, idx) => {
                        const active = repeatDays[idx];
                        return (
                          <button
                            key={dn}
                            type="button"
                            onClick={() => {
                              setRepeatDays((prev) => {
                                const next = [...prev];
                                next[idx] = !next[idx];
                                return next;
                              });
                            }}
                            className={`plannerModal__pill ${
                              active ? "is-active" : ""
                            }`}
                            style={{
                              padding: "6px 10px",
                              opacity: active ? 1 : 0.75
                            }}>
                            {dn}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="plannerModal__recurCol">
                    <div className="plannerModal__recurHint">
                      Until
                    </div>
                    <input
                      className="plannerModal__recurControl"
                      type="date"
                      value={repeatUntil}
                      onChange={(e) =>
                        setRepeatUntil(e.target.value)
                      }
                    />
                  </div>

                  <div className="plannerModal__recurNote">
                    {editingId
                      ? "Editing recurrence will create additional future copies starting after this event."
                      : "Repeats on the selected days, weekly or every other week."}
                  </div>
                </div>
              )}
            </div>

            <div className="plannerModal__field">
              <label>Description</label>
              <textarea
                placeholder="description..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>

            {formError && (
              <div className="plannerModal__error">
                {formError}
              </div>
            )}

            <div className="plannerModal__actions">
              <button
                className="plannerModal__save"
                type="button"
                onClick={handleSave}
                disabled={savingEvent}>
                {savingEvent ? "saving..." : "save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {focusOpen && (
        <div
          className="focusModal"
          role="dialog"
          aria-modal="true"
          onClick={closeFocus}>
          <div className="focusModal__backdrop" />
          <div
            className="focusModal__card"
            onClick={(e) => e.stopPropagation()}>
            <div className="focusModal__top">
              <button
                type="button"
                className={`focusModal__pill ${
                  focusMode === "work" ? "is-active" : ""
                }`}
                onClick={() => setMode("work")}>
                work timer
              </button>
              <button
                type="button"
                className={`focusModal__pill ${
                  focusMode === "break" ? "is-active" : ""
                }`}
                onClick={() => setMode("break")}>
                break timer
              </button>
            </div>

            <div className="focusModal__durations">
              <div className="focusModal__durRow">
                <label className="focusModal__durLabel">
                  <span className="focusModal__durText">
                    Work
                  </span>
                  <input
                    className="focusModal__durInput"
                    type="number"
                    min="1"
                    value={workMinutes}
                    disabled={isRunning}
                    onChange={(e) => {
                      const v = Math.max(
                        1,
                        Number(e.target.value) || 1
                      );
                      setWorkMinutes(v);
                      if (focusMode === "work" && !isRunning) {
                        const d = v * 60;
                        setDurationSec(d);
                        setRemainingSec(d);
                      }
                    }}
                  />
                  <span className="focusModal__durText">
                    min
                  </span>
                </label>

                <label className="focusModal__durLabel">
                  <span className="focusModal__durText">
                    Break
                  </span>
                  <input
                    className="focusModal__durInput"
                    type="number"
                    min="1"
                    value={breakMinutes}
                    disabled={isRunning}
                    onChange={(e) => {
                      const v = Math.max(
                        1,
                        Number(e.target.value) || 1
                      );
                      setBreakMinutes(v);
                      if (focusMode === "break" && !isRunning) {
                        const d = v * 60;
                        setDurationSec(d);
                        setRemainingSec(d);
                      }
                    }}
                  />
                  <span className="focusModal__durText">
                    min
                  </span>
                </label>
              </div>
            </div>

            <div className="focusModal__circleWrap">
              <div className="focusModal__circle">
                <div className="focusModal__time">
                  {formatMMSS(remainingSec)}
                </div>
              </div>
            </div>

            <div className="focusModal__btns">
              <button
                type="button"
                className="focusModal__btn"
                onClick={() =>
                  isRunning ? setIsRunning(false) : startTimer()
                }>
                {isRunning ? "PAUSE" : "START"}
              </button>

              <button
                type="button"
                className="focusModal__btn"
                onClick={endTimer}>
                END
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
