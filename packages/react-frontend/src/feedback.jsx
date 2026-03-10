import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useNavigate } from "react-router-dom";
import { authHeaders } from "./auth";
import "./feedback.css";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYYYYMMDD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYmd(ymd) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekSunday(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}

function endOfWeekSunday(d) {
  const s = startOfWeekSunday(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function fmtRange(s, e) {
  const opts = {
    month: "short",
    day: "numeric",
    year: "numeric"
  };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

function shiftWeekStart(weekStartStr, deltaWeeks) {
  const d = parseYmd(weekStartStr);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return toYYYYMMDD(d);
}

export default function WeeklyFeedback() {
  const navigate = useNavigate();

  const [planners, setPlanners] = useState([]);
  const [eventsByPlanner, setEventsByPlanner] = useState({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const thisWeekStartStr = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return toYYYYMMDD(startOfWeekSunday(t));
  }, []);

  const [weekStartStr, setWeekStartStr] =
    useState(thisWeekStartStr);

  const weekStart = useMemo(
    () => parseYmd(weekStartStr),
    [weekStartStr]
  );
  const weekEnd = useMemo(
    () => endOfWeekSunday(weekStart),
    [weekStart]
  );

  const isCurrentWeek = weekStartStr === thisWeekStartStr;

  // ============================
  // Reflection (MongoDB)
  // ============================
  const [reflection, setReflection] = useState("");
  const [reflectionLoading, setReflectionLoading] =
    useState(false);
  const didLoadRef = useRef(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReflection() {
      try {
        setReflectionLoading(true);
        didLoadRef.current = false;

        const res = await fetch(
          `/api/reflections/week/${weekStartStr}`,
          {
            headers: authHeaders()
          }
        );

        if (res.status === 401) return navigate("/login");
        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();

        if (!cancelled) {
          setReflection(data?.text || "");
          didLoadRef.current = true;
        }
      } catch {
        if (!cancelled)
          setPageError("Failed to load reflection.");
      } finally {
        if (!cancelled) setReflectionLoading(false);
      }
    }

    loadReflection();
    return () => {
      cancelled = true;
    };
  }, [weekStartStr, navigate]);

  // Debounced autosave
  useEffect(() => {
    if (!didLoadRef.current) return;

    if (saveTimerRef.current)
      clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/reflections/week/${weekStartStr}`, {
          method: "PUT",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text: reflection })
        });
      } catch {
        // ignore
      }
    }, 600);

    return () => {
      if (saveTimerRef.current)
        clearTimeout(saveTimerRef.current);
    };
  }, [reflection, weekStartStr]);

  // ============================
  // Load planners
  // ============================
  useEffect(() => {
    let cancelled = false;

    async function loadPlanners() {
      try {
        setLoading(true);
        setPageError("");

        const res = await fetch("/api/planners", {
          headers: authHeaders()
        });

        if (res.status === 401) return navigate("/login");
        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        if (!cancelled)
          setPlanners(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled)
          setPageError("Failed to load planners.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPlanners();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Load week events
  useEffect(() => {
    let cancelled = false;

    async function loadWeekEvents() {
      try {
        const from = weekStartStr;
        const to = toYYYYMMDD(weekEnd);

        const entries = await Promise.all(
          planners.map(async (p) => {
            const pid = p.id || p._id;
            if (!pid) return [null, []];

            try {
              const res = await fetch(
                `/api/planners/${pid}/events?from=${from}&to=${to}`,
                { headers: authHeaders() }
              );

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
      } catch {
        if (!cancelled) setPageError("Failed to load events.");
      }
    }

    if (planners.length > 0) loadWeekEvents();
    else setEventsByPlanner({});

    return () => {
      cancelled = true;
    };
  }, [planners, weekStartStr, weekEnd]);

  // ============================
  // Weekly Report
  // ============================
  const report = useMemo(() => {
    const all = [];
    for (const p of planners) {
      const pid = p.id || p._id;
      if (!pid) continue;
      const evs = eventsByPlanner[pid] || [];
      for (const ev of evs) all.push(ev);
    }

    const tasks = all.filter((e) => e.kind === "task");
    const total = tasks.length;
    const completedTasks = tasks.filter((t) => !!t.completed);
    const completed = completedTasks.length;
    const rate =
      total === 0 ? 100 : Math.round((completed / total) * 100);

    if (total === 0) {
      return {
        total,
        completed,
        rate,
        daysActive: 0,
        bestDayLabel: "No data",
        longestStreak: 0,
        noData: true
      };
    }

    const completedByDate = {};
    for (const t of completedTasks) {
      completedByDate[t.date] =
        (completedByDate[t.date] || 0) + 1;
    }

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const ymd = toYYYYMMDD(d);
      days.push({
        label: d.toLocaleDateString(undefined, {
          weekday: "long"
        }),
        completed: completedByDate[ymd] || 0
      });
    }

    const daysActive = days.filter(
      (d) => d.completed > 0
    ).length;

    let bestDay = days[0];
    for (const d of days) {
      if (d.completed > bestDay.completed) bestDay = d;
    }

    const bestDayLabel =
      bestDay.completed > 0
        ? `${bestDay.label} (${bestDay.completed})`
        : "No data";

    let longestStreak = 0;
    let currentStreak = 0;

    for (const d of days) {
      if (d.completed > 0) {
        currentStreak++;
        if (currentStreak > longestStreak)
          longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    return {
      total,
      completed,
      rate,
      daysActive,
      bestDayLabel,
      longestStreak,
      noData: false
    };
  }, [planners, eventsByPlanner, weekStart]);

  const canGoNext = weekStartStr < thisWeekStartStr;

  return (
    <div className="fb">
      <div className="fbHeader">
        <div>
          <div className="fbTitle">Weekly Report</div>
          <div className="fbRange">
            {fmtRange(weekStart, weekEnd)}
          </div>
        </div>

        <div className="fbHeaderRight">
          <button
            className="fbArrowBtn"
            onClick={() =>
              setWeekStartStr((s) => shiftWeekStart(s, -1))
            }>
            ←
          </button>

          <div className="fbWeekChip">
            {fmtRange(weekStart, weekEnd)}
          </div>

          <button
            className="fbArrowBtn"
            onClick={() =>
              setWeekStartStr((s) => shiftWeekStart(s, 1))
            }
            disabled={!canGoNext}>
            →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="fbCard">Loading…</div>
      ) : pageError ? (
        <div className="fbCard">{pageError}</div>
      ) : report.noData && !isCurrentWeek ? null : (
        <>
          <div className="fbCard">
            <div className="fbStats">
              <div className="fbStat">
                <div className="fbStatLabel">Completed</div>
                <div className="fbStatValue">
                  {report.completed}
                </div>
              </div>

              <div className="fbStat">
                <div className="fbStatLabel">Total</div>
                <div className="fbStatValue">
                  {report.total}
                </div>
              </div>

              <div className="fbStat">
                <div className="fbStatLabel">Completion</div>
                <div className="fbStatValue">
                  {report.rate}%
                </div>
              </div>
            </div>
          </div>

          <div className="fbCard">
            <div className="fbSectionTitle">Insights</div>
            <div className="fbInsights">
              <div className="fbInsightItem">
                <div className="fbInsightLabel">
                  Days active
                </div>
                <div className="fbInsightValue">
                  {report.daysActive} / 7
                </div>
              </div>

              <div className="fbInsightItem">
                <div className="fbInsightLabel">Best day</div>
                <div className="fbInsightValue">
                  {report.bestDayLabel}
                </div>
              </div>

              <div className="fbInsightItem">
                <div className="fbInsightLabel">
                  Longest streak
                </div>
                <div className="fbInsightValue">
                  {report.longestStreak} day(s)
                </div>
              </div>
            </div>
          </div>

          <div className="fbCard">
            <div className="fbSectionTitle">
              Self Reflection
            </div>
            <textarea
              className="fbTextarea"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              disabled={reflectionLoading}
              placeholder="Write here..."
            />
          </div>
        </>
      )}
    </div>
  );
}
