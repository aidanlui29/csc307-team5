// packages/react-frontend/src/feedback.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authHeaders } from "./auth";
import "./dashboard.css";
import { UserCheck, Clock, Users } from "lucide-react";

// Currently uses similar style to dashboard
// Ironically Time worked does not work
// The week summary is very minimal

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYYYYMMDD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

export default function WeeklyFeedback() {
  const navigate = useNavigate();

  const [planners, setPlanners] = useState([]);
  const [eventsByPlanner, setEventsByPlanner] = useState({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // currently have this set at 60 minutes
  const [focusMinutes, setFocusMinutes] = useState(60);

  // Load planners (same as Dashboard)
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

  // Load events (same as Dashboard)
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

  const allEvents = useMemo(() => {
    const out = [];
    for (const p of planners) {
      const pid = p.id || p._id;
      if (!pid) continue;
      const evs = eventsByPlanner[pid] || [];
      for (const ev of evs)
        out.push({ ...ev, id: ev.id || ev._id });
    }
    return out;
  }, [planners, eventsByPlanner]);

  const tasks = useMemo(
    () => allEvents.filter((e) => e.kind === "task"),
    [allEvents]
  );

  const { weekTotalTasks, weekCompletedTasks } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const s = startOfWeek(now);
    const e = endOfWeek(now);

    const weekTasks = tasks.filter((t) =>
      inRangeYYYYMMDD(t.date, s, e)
    );
    const weekTotalTasks = weekTasks.length;
    const weekCompletedTasks = weekTasks.filter(
      (t) => !!t.completed
    ).length;

    return { weekTotalTasks, weekCompletedTasks };
  }, [tasks]);

  // This will show how long a user has worked on tasks
  // Might be converted to hours
  const timeWorked = useMemo(() => {
    return Math.round((focusMinutes / 60) * 10) / 10;
  }, [focusMinutes]);

  return (
    <div className="dash">
      <div className="dash__top"></div>

      <div className="dash__layout">
        <div className="dash__stats">
          <div className="dashStatCard">
            <div className="dashStatIcon">
              <UserCheck size={28} />
            </div>
            <div>
              <div className="dashStatLabel">
                Completed This Week
              </div>
              <div className="dashStatValue">
                {weekCompletedTasks}
              </div>
            </div>
          </div>

          <div className="dashStatCard">
            <div className="dashStatIcon">
              <Users size={28} />
            </div>
            <div>
              <div className="dashStatLabel">
                Tasks This Week
              </div>
              <div className="dashStatValue">
                {weekTotalTasks}
              </div>
            </div>
          </div>

          <div className="dashStatCard">
            <div className="dashStatIcon">
              <Clock size={28} />
            </div>
            <div>
              <div className="dashStatLabel">Time Worked</div>
              <div className="dashStatValue">{timeWorked}</div>
            </div>
          </div>
        </div>

        <div className="dash__mainCard">
          <div className="dash__mainHeader">
            <h2 className="dash__title">This Week Summary</h2>
          </div>

          {loading ? (
            <div className="dash__empty">Loading…</div>
          ) : pageError ? (
            <div className="dash__empty">{pageError}</div>
          ) : (
            <div className="dash__empty">
              You completed <b>{weekCompletedTasks}</b> out of{" "}
              <b>{weekTotalTasks}</b> tasks this week.
              <br />
              Time worked: <b>{timeWorked}</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
