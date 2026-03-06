import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authHeaders } from "./auth";
import "./dashboard.css";
import { Users, UserCheck } from "lucide-react";

// same kind label styling as planner
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

function computeDueLabel(dateStr) {
  // dateStr is YYYY-MM-DD
  const today = new Date();
  const d = new Date(`${dateStr}T00:00:00`);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Do Today";
  if (diffDays === 1) return "Do Tomorrow";
  if (diffDays > 1) return `Do in ${diffDays} Days`;
  if (diffDays === -1) return "Overdue (1 day)";
  return `Overdue (${Math.abs(diffDays)} days)`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { id } = useParams(); // optional, if your route is /dashboard/:id
  // If your route is just /dashboard, set plannerId manually or remove id usage.
  const plannerId = id; // you can change this to a default planner id if needed

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("priority"); // "priority" | "date"

  // -------- Focus timer modal (copied from Planner logic) --------
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
  // -------------------------------------------------------------

  // Load events from backend (same source as Planner)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setPageError("");

      try {
        // If you don’t have plannerId in the route, you can:
        // 1) fetch a "default planner" endpoint, or
        // 2) store last-opened plannerId in localStorage and read it here.
        if (!plannerId) {
          setEvents([]);
          setPageError(
            "No planner selected for dashboard. (Route may need /dashboard/:id)"
          );
          return;
        }

        const res = await fetch(
          `/api/planners/${plannerId}/events`,
          { headers: authHeaders() }
        );

        if (res.status === 401) {
          navigate("/login");
          return;
        }
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "Failed to load tasks");
        }

        const data = await res.json();
        if (!cancelled)
          setEvents(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled)
          setPageError(
            e?.message ||
              "Network error. Is the backend running?"
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [plannerId, navigate]);

  // Dashboard focuses on tasks (not schedules)
  const tasks = useMemo(
    () => events.filter((e) => e.kind === "task"),
    [events]
  );

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? tasks.filter((t) =>
          (t.title || "").toLowerCase().includes(q)
        )
      : tasks.slice();

    const priorityRank = { high: 0, medium: 1, low: 2 };

    base.sort((a, b) => {
      if (sortBy === "date")
        return (a.date || "").localeCompare(b.date || "");
      // default: priority first, then date
      const pa = priorityRank[a.priority || "medium"] ?? 1;
      const pb = priorityRank[b.priority || "medium"] ?? 1;
      if (pa !== pb) return pa - pb;
      return (a.date || "").localeCompare(b.date || "");
    });

    return base;
  }, [tasks, query, sortBy]);

  const todayTasksCount = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    return tasks.filter((t) => t.date === todayStr).length;
  }, [tasks]);

  const upcomingCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter((t) => {
      const d = new Date(`${t.date}T00:00:00`);
      return d.getTime() > today.getTime();
    }).length;
  }, [tasks]);

  return (
    <div className={`dash ${focusOpen ? "dash--blurred" : ""}`}>
      {/* Top bar (menu + search) */}
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

      {/* Content */}
      <div className="dash__layout">
        {/* Left stat cards */}
        <div className="dash__stats">
          <div className="dashStatCard">
            <div className="dashStatIcon">
              <Users size={28} />
            </div>
            <div>
              <div className="dashStatLabel">Total Tasks</div>
              <div className="dashStatValue">
                {tasks.length}
              </div>
            </div>
          </div>

          <div className="dashStatCard">
            <div className="dashStatIcon">
              <UserCheck size={28} />
            </div>
            <div>
              <div className="dashStatLabel">Today Tasks</div>
              <div className="dashStatValue">
                {todayTasksCount}
              </div>
            </div>
          </div>

          <div className="dashStatCard">
            <div className="dashStatIcon">
              <Users size={28} />
            </div>
            <div>
              <div className="dashStatLabel">
                Upcoming Tasks
              </div>
              <div className="dashStatValue">
                {upcomingCount}
              </div>
            </div>
          </div>
        </div>

        {/* Main table */}
        <div className="dash__mainCard">
          <div className="dash__mainHeader">
            <h2 className="dash__title">All Tasks</h2>

            <div className="dash__controls">
              <div className="dash__searchMini">
                <span className="dash__searchIcon">🔍</span>
                <input
                  className="dash__searchMiniInput"
                  placeholder="Search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="dash__sort">
                <span className="dash__sortLabel">
                  Short by :
                </span>
                <select
                  className="dash__sortSelect"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}>
                  <option value="priority">Priority</option>
                  <option value="date">Due Date</option>
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
                <div>Progress</div>
                <div>Due Date</div>
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
                    {t.completed
                      ? "100% completed"
                      : "0% completed"}
                  </div>
                  <div className="dashTable__cell">
                    {computeDueLabel(t.date)}
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
                      onClick={openFocus}>
                      Focus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Focus timer modal (same as planner) */}
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
