// packages/react-frontend/src/Dashboard.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useNavigate } from "react-router-dom";
import { authHeaders } from "./auth";
import "./dashboard.css";
import {
  CalendarCheck2,
  CheckCircle2,
  Search,
  ListTodo
} from "lucide-react";

const DEFAULT_COLOR = "#9ca3af";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYYYYMMDD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatMDY(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}

function endOfWeek(d) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function inRangeYYYYMMDD(dateStr, start, end) {
  if (!dateStr) return false;
  const dt = new Date(`${dateStr}T00:00:00`);
  return dt >= start && dt <= end;
}

function formatTimeRange(startMin, endMin) {
  const fmt = (m) => {
    const h24 = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, "0");
    const ampm = h24 < 12 ? "am" : "pm";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${mm}${ampm}`;
  };
  return `${fmt(startMin)} – ${fmt(endMin)}`;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [planners, setPlanners] = useState([]);
  const [eventsByPlanner, setEventsByPlanner] = useState({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("priority");
  const [scope, setScope] = useState("all");
  const todayStr = useMemo(() => toYYYYMMDD(new Date()), []);

  function scopeTitle(s) {
    if (s === "today") return "Today's Tasks";
    if (s === "week") return "Tasks This Week";
    if (s === "weekCompleted") return "Completed This Week";
    return "All Tasks";
  }

  function handleScopeKeyDown(e, nextScope) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setScope(nextScope);
    }
  }

  const [focusOpen, setFocusOpen] = useState(false);
  const [focusMode, setFocusMode] = useState("work");

  const DEFAULT_WORK_SECONDS = 25 * 60;
  const BREAK_SECONDS = 5 * 60;

  const [workDurationSec, setWorkDurationSec] = useState(
    DEFAULT_WORK_SECONDS
  );
  const [remainingSec, setRemainingSec] = useState(
    DEFAULT_WORK_SECONDS
  );
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  function openFocus(task) {
    setFocusOpen(true);
    setIsRunning(false);

    let allocatedMin = 0;
    if (
      task &&
      typeof task.startMin === "number" &&
      typeof task.endMin === "number"
    ) {
      allocatedMin = Math.max(0, task.endMin - task.startMin);
    }

    const workSec =
      allocatedMin > 0
        ? allocatedMin * 60
        : DEFAULT_WORK_SECONDS;
    setWorkDurationSec(workSec);

    const d = focusMode === "work" ? workSec : BREAK_SECONDS;
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

    const d = mode === "work" ? workDurationSec : BREAK_SECONDS;
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
      focusMode === "work" ? workDurationSec : BREAK_SECONDS;
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

  // Loads all planners for the authenticated user.
  useEffect(() => {
    let cancelled = false;

    async function loadPlanners() {
      try {
        setLoading(true);
        const res = await fetch("/api/planners", {
          headers: authHeaders()
        });

        if (res.status === 401) return navigate("/login");
        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        if (!cancelled)
          setPlanners(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled)
          setPageError(e?.message || "Network error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPlanners();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Loads events for each planner and groups them by planner id.
  useEffect(() => {
    let cancelled = false;

    async function loadAllPlannerEvents() {
      try {
        const entries = await Promise.all(
          planners.map(async (p) => {
            const pid = p.id || p._id;
            if (!pid) return [null, []];

            try {
              const res = await fetch(
                `/api/planners/${pid}/events`,
                {
                  headers: authHeaders()
                }
              );

              if (res.status === 401) return navigate("/login");
              if (!res.ok) return [pid, []];

              const data = await res.json();
              return [pid, Array.isArray(data) ? data : []];
            } catch {
              return [pid, []];
            }
          })
        );

        if (cancelled) return;

        const obj = {};
        for (const [plannerId, evs] of entries) {
          if (plannerId) obj[plannerId] = evs;
        }
        setEventsByPlanner(obj);
      } catch (e) {
        if (!cancelled)
          setPageError(e?.message || "Failed to load events.");
      }
    }

    if (planners.length > 0) loadAllPlannerEvents();
    else setEventsByPlanner({});

    return () => {
      cancelled = true;
    };
  }, [planners, navigate]);

  // Flattens planner events into one list while preserving planner metadata for display.
  const allEvents = useMemo(() => {
    const out = [];
    for (const p of planners) {
      const pid = p.id || p._id;
      if (!pid) continue;

      const color = p.color || DEFAULT_COLOR;
      const evs = eventsByPlanner[pid] || [];

      for (const ev of evs) {
        out.push({
          ...ev,
          id: ev.id || ev._id,
          plannerId: pid,
          plannerName: p.name || "Planner",
          plannerColor: color
        });
      }
    }
    return out;
  }, [planners, eventsByPlanner]);

  const tasks = useMemo(
    () => allEvents.filter((e) => e.kind === "task"),
    [allEvents]
  );

  // Builds summary counts used by the dashboard stat cards.
  const { todayOpenCount, weekOpenTotal, weekCompleted } =
    useMemo(() => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const s = startOfWeek(now);
      const e = endOfWeek(now);

      const todayOpenCount = tasks.filter(
        (t) => t.date === todayStr && !t.completed
      ).length;

      const weekTasks = tasks.filter((t) =>
        inRangeYYYYMMDD(t.date, s, e)
      );
      const weekOpenTotal = weekTasks.filter(
        (t) => !t.completed
      ).length;
      const weekCompleted = weekTasks.filter(
        (t) => !!t.completed
      ).length;

      return { todayOpenCount, weekOpenTotal, weekCompleted };
    }, [tasks, todayStr]);

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekStart = useMemo(() => startOfWeek(now), [now]);
  const weekEnd = useMemo(() => endOfWeek(now), [now]);

  // Applies scope filtering, search filtering, and sorting to the task list.
  const filteredTasks = useMemo(() => {
    let scoped = tasks;

    if (scope === "today") {
      scoped = tasks.filter((t) => t.date === todayStr);
    } else if (scope === "week") {
      scoped = tasks.filter((t) =>
        inRangeYYYYMMDD(t.date, weekStart, weekEnd)
      );
    } else if (scope === "weekCompleted") {
      scoped = tasks.filter(
        (t) =>
          inRangeYYYYMMDD(t.date, weekStart, weekEnd) &&
          !!t.completed
      );
    }

    const q = query.trim().toLowerCase();
    const base = q
      ? scoped.filter((t) =>
          (t.title || "").toLowerCase().includes(q)
        )
      : scoped.slice();

    const priorityRank = { high: 0, medium: 1, low: 2 };
    base.sort((a, b) => {
      if (sortBy === "date")
        return (a.date || "").localeCompare(b.date || "");
      const pa = priorityRank[a.priority || "medium"] ?? 1;
      const pb = priorityRank[b.priority || "medium"] ?? 1;
      if (pa !== pb) return pa - pb;
      return (a.date || "").localeCompare(b.date || "");
    });

    return base;
  }, [
    tasks,
    scope,
    todayStr,
    weekStart,
    weekEnd,
    query,
    sortBy
  ]);

  return (
    <div className={`dash ${focusOpen ? "dash--blurred" : ""}`}>
      <div className="dash__top">
        <div style={{ width: 120 }} />
        <div className="dash__searchTop">
          <input
            className="dash__searchTopInput"
            placeholder="Search Tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="dash__layout">
        <div className="dash__stats">
          <div
            className={`dashStatCard ${scope === "today" ? "dashStatCard--active" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={scope === "today"}
            onClick={() => setScope("today")}
            onKeyDown={(e) => handleScopeKeyDown(e, "today")}
            title="Show only today's tasks">
            <div className="dashStatIcon">
              <CalendarCheck2 size={28} />
            </div>
            <div>
              <div className="dashStatLabel">Today Tasks</div>
              <div className="dashStatValue">
                {todayOpenCount}
              </div>
            </div>
          </div>

          <div
            className={`dashStatCard ${scope === "week" ? "dashStatCard--active" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={scope === "week"}
            onClick={() => setScope("week")}
            onKeyDown={(e) => handleScopeKeyDown(e, "week")}
            title="Show only this week's tasks">
            <div className="dashStatIcon">
              <ListTodo size={28} />
            </div>
            <div>
              <div className="dashStatLabel">
                Tasks This Week
              </div>
              <div className="dashStatValue">
                {weekOpenTotal}
              </div>
            </div>
          </div>

          <div
            className={`dashStatCard ${scope === "weekCompleted" ? "dashStatCard--active" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={scope === "weekCompleted"}
            onClick={() => setScope("weekCompleted")}
            onKeyDown={(e) =>
              handleScopeKeyDown(e, "weekCompleted")
            }
            title="Show only completed tasks from this week">
            <div className="dashStatIcon">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <div className="dashStatLabel">
                Completed This Week
              </div>
              <div className="dashStatValue">
                {weekCompleted}
              </div>
            </div>
          </div>
        </div>

        <div className="dash__mainCard">
          <div className="dash__mainHeader">
            <h2
              className="dash__title"
              style={{ cursor: "pointer" }}
              onClick={() => setScope("all")}
              title="Click to show all tasks">
              {scopeTitle(scope)}
            </h2>

            <div className="dash__controls">
              <div className="dash__searchMini">
                <span className="dash__searchIcon">
                  <Search size={12} />
                </span>
                <input
                  className="dash__searchMiniInput"
                  placeholder="Search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="dash__sort">
                <span className="dash__sortLabel">
                  Sort by :
                </span>
                <select
                  className="dash__sortSelect"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}>
                  <option value="priority">Priority</option>
                  <option value="date">Date</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="dash__empty">Loading tasks…</div>
          ) : pageError ? (
            <div className="dash__empty">{pageError}</div>
          ) : filteredTasks.length === 0 ? (
            <div className="dash__empty">No tasks found.</div>
          ) : (
            <div className="dashTable">
              <div className="dashTable__head">
                <div>Task Name</div>
                <div>Planner</div>
                <div>Status</div>
                <div>Date</div>
                <div>Time</div>
                <div>Start Focus</div>
              </div>

              {filteredTasks.map((t) => (
                <div className="dashTable__row" key={t.id}>
                  <div className="dashTable__cell dashTable__taskName">
                    {t.title}
                  </div>
                  <div className="dashTable__cell">
                    {t.plannerName || "—"}
                  </div>
                  <div className="dashTable__cell">
                    {t.completed ? "Complete" : "Not Complete"}
                  </div>
                  <div className="dashTable__cell">
                    {formatMDY(t.date)}
                  </div>
                  <div className="dashTable__cell">
                    {typeof t.startMin === "number" &&
                    typeof t.endMin === "number"
                      ? formatTimeRange(t.startMin, t.endMin)
                      : "—"}
                  </div>
                  <div className="dashTable__cell">
                    <button
                      className="dashFocusBtn"
                      type="button"
                      onClick={() => openFocus(t)}>
                      Focus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
