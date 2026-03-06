import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authHeaders } from "./auth.jsx";
import "./planner.css";
import { Pencil, Trash2 } from "lucide-react";

/* ---------- date helpers ---------- */
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

// legacy localStorage key (migration only)
function storageKey(id) {
  return `plannerEvents_v1_${id || "default"}`;
}

export default function Planner() {
  const { id } = useParams(); // plannerId
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

  // ---- load events from API + one-time migration from localStorage
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
        const serverEvents = Array.isArray(data) ? data : [];
        if (!cancelled) setEvents(serverEvents);

        // ---- migrate legacy localStorage (only once per planner)
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

          // Only migrate if server has none (prevents duplicates)
          if (legacy.length > 0 && serverEvents.length === 0) {
            for (const ev of legacy) {
              if (!ev?.title || !ev?.date || !ev?.kind)
                continue;
              if (
                typeof ev.startMin !== "number" ||
                typeof ev.endMin !== "number"
              )
                continue;

              // defaults for tasks
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
                    completed
                  })
                }
              );

              if (createRes.status === 401) {
                navigate("/login");
                return;
              }
            }

            // re-fetch after migration
            const res2 = await fetch(
              `/api/planners/${id}/events`,
              {
                headers: authHeaders()
              }
            );
            if (res2.ok) {
              const data2 = await res2.json();
              if (!cancelled)
                setEvents(Array.isArray(data2) ? data2 : []);
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

  /* ---------- Focus timer ---------- */
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusMode, setFocusMode] = useState("work");
  const WORK_SECONDS = 25 * 60;
  const BREAK_SECONDS = 5 * 60;

  const [_durationSec, setDurationSec] = useState(WORK_SECONDS);
  const [remainingSec, setRemainingSec] =
    useState(WORK_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  function openFocus() {
    setFocusOpen(true);
    setIsRunning(false);
    const d =
      focusMode === "work" ? WORK_SECONDS : BREAK_SECONDS;
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

    const d = mode === "work" ? WORK_SECONDS : BREAK_SECONDS;
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

    const d =
      focusMode === "work" ? WORK_SECONDS : BREAK_SECONDS;
    setDurationSec(d);
    setRemainingSec(d);
  }

  function formatMMSS(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

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

  /* ---------- UI state for add/edit ---------- */
  const [addOpen, setAddOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);

  // NEW: task-only fields
  const [priority, setPriority] = useState("medium"); // low | medium | high
  const [completed, setCompleted] = useState(false); // boolean

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

  const [nowLineStyle, setNowLineStyle] = useState(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const msToNextMinute =
      (60 - new Date().getSeconds()) * 1000 -
      new Date().getMilliseconds();

    const t = setTimeout(() => {
      tick();
      const id2 = setInterval(tick, 60 * 1000);
      window.__plannerNowInterval = id2;
    }, msToNextMinute);

    return () => {
      clearTimeout(t);
      if (window.__plannerNowInterval)
        clearInterval(window.__plannerNowInterval);
      window.__plannerNowInterval = null;
    };
  }, []);

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

  /* ---------- form fields ---------- */
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("schedule");
  const [dateStr, setDateStr] = useState(() =>
    toDateInputValue(new Date())
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [desc, setDesc] = useState("");

  function openAddNew() {
    setSelectedEventId(null);
    setEditingId(null);
    setFormError("");
    setTitle("");
    setDesc("");
    setKind("schedule");
    setDateStr(toDateInputValue(new Date()));
    setStartTime("09:00");
    setEndTime("10:00");

    // defaults for new task fields (only matter if user switches to task)
    setPriority("medium");
    setCompleted(false);

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

    setAddOpen(true);
  }

  function closeAdd() {
    if (savingEvent) return;
    setAddOpen(false);
    setFormError("");
    setEditingId(null);
  }

  async function handleSave() {
    setFormError("");

    if (!title.trim())
      return setFormError("Please enter a title.");

    const sMin = timeToMinutes(startTime);
    const eMin = timeToMinutes(endTime);
    if (eMin <= sMin)
      return setFormError("End time must be after start time.");

    setSavingEvent(true);
    try {
      const payload = {
        title: title.trim(),
        kind,
        date: dateStr,
        startMin: sMin,
        endMin: eMin,
        desc: desc.trim()
      };

      // Only attach these for tasks (keeps schedule clean)
      if (kind === "task") {
        payload.priority = priority;
        payload.completed = completed;
      }

      if (editingId) {
        const res = await fetch(`/api/events/${editingId}`, {
          method: "PUT",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (res.status === 401) return navigate("/login");
        if (!res.ok)
          throw new Error(
            (await res.text()) || "Failed to update event"
          );

        const updated = await res.json();
        setEvents((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e))
        );
      } else {
        const res = await fetch(`/api/planners/${id}/events`, {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (res.status === 401) return navigate("/login");
        if (!res.ok)
          throw new Error(
            (await res.text()) || "Failed to create event"
          );

        const created = await res.json();
        setEvents((prev) => [...prev, created]);
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

    return {
      left: `${left + 8}px`,
      top: `${top + 2}px`,
      width: `${width - 16}px`,
      height: `${Math.max(28, height - 4)}px`
    };
  }

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
        if (focusOpen) return; // blur mode should not allow clicking background to do stuff
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
                className={`planner__dayheader ${isCurrentWeek && idx === todayIndex ? "planner__dayheader--today" : ""}`}>
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

          {events.map((ev) => (
            <div
              key={ev.id}
              className={`planner__event ${ev.kind === "schedule" ? "planner__event--schedule" : "planner__event--task"}`}
              style={getEventStyle(ev)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEventId(ev.id);
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
                  className={`planner__cell ${isCurrentWeek && idx === todayIndex ? "planner__cell--today" : ""}`}
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
            <button
              className="plannerModal__close"
              onClick={closeAdd}
              aria-label="Close">
              ✕
            </button>

            <input
              className="plannerModal__title"
              placeholder="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="plannerModal__row">
              {/* LEFT: Priority + Status ONLY for task */}
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
                        className={`plannerModal__select ${completed ? "plannerModal__select--complete" : "plannerModal__select--notcomplete"}`}
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

              {/* RIGHT: schedule/task toggle */}
              <div className="plannerModal__toggle">
                <button
                  type="button"
                  className={`plannerModal__pill ${kind === "schedule" ? "is-active is-schedule" : ""}`}
                  onClick={() => setKind("schedule")}>
                  schedule
                </button>
                <button
                  type="button"
                  className={`plannerModal__pill ${kind === "task" ? "is-active is-task" : ""}`}
                  onClick={() => {
                    setKind("task");
                    // ensure defaults when switching to task
                    if (!priority) setPriority("medium");
                    // completed keeps existing value
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
                  onChange={(e) => setDateStr(e.target.value)}
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
                className={`focusModal__pill ${focusMode === "work" ? "is-active" : ""}`}
                onClick={() => setMode("work")}>
                work timer
              </button>
              <button
                type="button"
                className={`focusModal__pill ${focusMode === "break" ? "is-active" : ""}`}
                onClick={() => setMode("break")}>
                break timer
              </button>
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
