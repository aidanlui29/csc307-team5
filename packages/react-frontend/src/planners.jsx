import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authHeaders } from "./auth";
import "./planners.css";

const DEFAULT_COLOR = "#9ca3af";

const COLOR_PRESETS = [
  "#9ca3af",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6"
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateInputValue(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// rolling window: startDateStr (YYYY-MM-DD) -> next 7 days
function isDateInNext7Days(dateStr, startDateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const start = new Date(`${startDateStr}T00:00:00`);
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 7); // exclusive
  return d >= start && d < end;
}

function formatDurationMinutes(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function minutesToLabel(mins) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad2(m)}${ampm.toLowerCase()}`;
}

function formatShortDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day}`;
}

export default function Planners() {
  const navigate = useNavigate();

  const [planners, setPlanners] = useState([]);
  const [error, setError] = useState("");

  // create/edit modal state
  const [plannerModalOpen, setPlannerModalOpen] =
    useState(false);
  const [plannerName, setPlannerName] = useState("");
  const [plannerColor, setPlannerColor] =
    useState(DEFAULT_COLOR);
  const [plannerDesc, setPlannerDesc] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // delete confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPlanner, setConfirmPlanner] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // server events for overview panels
  const [eventsByPlanner, setEventsByPlanner] = useState({}); // { [plannerId]: Event[] }

  // ---------- CLOCKIN NOTIFICATION TOAST (CLIENT-SIDE) ----------
  // Shows a banner when a task/schedule starts (based on events we already fetch).
  const [clockInNotification, setClockInNotification] =
    useState(null);
  const [dismissedEventIds, setDismissedEventIds] = useState(
    () => new Set()
  );

  const todayStr = useMemo(
    () => toDateInputValue(new Date()),
    []
  );

  // Load planners list
  useEffect(() => {
    let cancelled = false;

    async function loadPlanners() {
      try {
        setError("");
        const res = await fetch("/api/planners", {
          headers: authHeaders()
        });

        if (res.status === 401) {
          navigate("/login");
          return;
        }

        if (!res.ok) {
          const msg = await res.text();
          if (!cancelled)
            setError(msg || "Failed to load planners");
          return;
        }

        const data = await res.json();
        if (!cancelled)
          setPlanners(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled)
          setError("Network error. Is the backend running?");
      }
    }

    loadPlanners();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Load events for each planner (for Today/Weekly panels)
  useEffect(() => {
    let cancelled = false;

    async function loadAllPlannerEvents() {
      try {
        const entries = await Promise.all(
          planners.map(async (p) => {
            try {
              const res = await fetch(
                `/api/planners/${p.id}/events`,
                {
                  headers: authHeaders()
                }
              );

              if (res.status === 401) {
                navigate("/login");
                return [p.id, []];
              }

              if (!res.ok) return [p.id, []];

              const data = await res.json();
              return [p.id, Array.isArray(data) ? data : []];
            } catch {
              return [p.id, []];
            }
          })
        );

        if (cancelled) return;

        const obj = {};
        for (const [plannerId, evs] of entries)
          obj[plannerId] = evs;
        setEventsByPlanner(obj);
      } catch {
        // ignore
      }
    }

    if (planners.length > 0) loadAllPlannerEvents();
    else setEventsByPlanner({});

    return () => {
      cancelled = true;
    };
  }, [planners, navigate]);

  function openCreate() {
    setEditingId(null);
    setPlannerName("");
    setPlannerColor(DEFAULT_COLOR);
    setPlannerDesc("");
    setFormError("");
    setPlannerModalOpen(true);
  }

  function openEdit(planner) {
    setEditingId(planner.id);
    setPlannerName(planner.name || "");
    setPlannerColor(planner.color || DEFAULT_COLOR);
    setPlannerDesc(planner.description || "");
    setFormError("");
    setPlannerModalOpen(true);
  }

  function closeModal() {
    setPlannerModalOpen(false);
    setFormError("");
    setEditingId(null);
  }

  async function savePlanner() {
    setFormError("");

    if (!plannerName.trim()) {
      setFormError("Please enter a name.");
      return;
    }

    const body = JSON.stringify({
      name: plannerName.trim(),
      color: plannerColor,
      description: plannerDesc.trim()
    });

    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/planners/${editingId}`, {
          method: "PUT",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body
        });

        if (res.status === 401) return navigate("/login");
        if (!res.ok)
          throw new Error(
            (await res.text()) || "Failed to update planner"
          );

        const updated = await res.json();
        setPlanners((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
        closeModal();
      } else {
        const res = await fetch("/api/planners", {
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body
        });

        if (res.status === 401) return navigate("/login");
        if (!res.ok)
          throw new Error(
            (await res.text()) || "Failed to create planner"
          );

        const created = await res.json();
        setPlanners((prev) => [created, ...prev]);
        closeModal();

        if (created?.id) navigate(`/planner/${created.id}`);
      }
    } catch (e) {
      setFormError(e?.message || "Backend error.");
    } finally {
      setSaving(false);
    }
  }

  function openDeleteConfirm(planner) {
    setConfirmPlanner(planner);
    setConfirmOpen(true);
  }

  function closeDeleteConfirm() {
    if (confirmBusy) return;
    setConfirmOpen(false);
    setConfirmPlanner(null);
  }

  async function confirmDelete() {
    if (!confirmPlanner?.id) return;

    setConfirmBusy(true);
    try {
      const res = await fetch(
        `/api/planners/${confirmPlanner.id}`,
        {
          method: "DELETE",
          headers: authHeaders()
        }
      );

      if (res.status === 401) return navigate("/login");
      if (!res.ok)
        throw new Error(
          (await res.text()) || "Failed to delete planner"
        );

      setPlanners((prev) =>
        prev.filter((p) => p.id !== confirmPlanner.id)
      );
      closeDeleteConfirm();
    } catch (e) {
      setError(e?.message || "Failed to delete planner.");
    } finally {
      setConfirmBusy(false);
    }
  }

  // ---------- BUILD OVERVIEW LISTS (FROM SERVER EVENTS) ----------
  const allEvents = useMemo(() => {
    const out = [];
    for (const p of planners) {
      const color = p.color || DEFAULT_COLOR;
      const evs = eventsByPlanner[p.id] || [];
      for (const ev of evs) {
        out.push({
          ...ev,
          plannerId: p.id,
          plannerName: p.name || "Planner",
          plannerColor: color
        });
      }
    }
    return out;
  }, [planners, eventsByPlanner]);

  // ClockIn notification!
  useEffect(() => {
    if (!allEvents || allEvents.length === 0) return;

    const getStartDateTime = (ev) => {
      // date is "YYYY-MM-DD" and startMin is minutes from midnight
      const base = new Date(`${ev.date}T00:00:00`);
      const mins = ev.startMin ?? 0;
      base.setMinutes(base.getMinutes() + mins);
      return base;
    };

    const pickNextEvent = () => {
      const now = new Date();

      // Filter out dismissed events
      const candidates = allEvents
        .filter((ev) => ev?.id && !dismissedEventIds.has(ev.id))
        // OPTIONAL: ignore completed tasks if you want
        // .filter((ev) => !(ev.kind === "task" && ev.completed))
        .map((ev) => ({ ev, start: getStartDateTime(ev) }))
        // only keep events that are not too far in the past
        .filter(
          ({ start }) =>
            start.getTime() >= now.getTime() - 10 * 60 * 1000
        )
        .sort((a, b) => a.start - b.start);

      return candidates[0]?.ev ?? null;
    };

    const check = () => {
      const next = pickNextEvent();

      // Debug to verify it is selecting something:
      // console.log("ClockIn next:", next);

      if (next) setClockInNotification(next);
      else setClockInNotification(null);
    };

    // Run immediately (important)
    check();

    // Then keep checking in case schedule changes
    const interval = setInterval(check, 15_000);
    return () => clearInterval(interval);
  }, [allEvents, dismissedEventIds]);

  const todaysTasks = useMemo(() => {
    const priorityWeight = { high: 0, medium: 1, low: 2 };

    const items = allEvents
      .filter(
        (e) =>
          e.kind === "task" &&
          e.date === todayStr &&
          !e.completed
      )
      .map((e) => ({
        id: e.id,
        title: e.title,
        plannerName: e.plannerName,
        plannerColor: e.plannerColor,
        priority: e.priority || "medium",
        durationMin: Math.max(
          0,
          (e.endMin ?? 0) - (e.startMin ?? 0)
        ),
        startMin: e.startMin ?? 0
      }));

    items.sort((a, b) => {
      const pa = priorityWeight[a.priority] ?? 99;
      const pb = priorityWeight[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.startMin - b.startMin;
    });

    return items;
  }, [allEvents, todayStr]);

  const weeklySchedule = useMemo(() => {
    const items = allEvents
      .filter(
        (e) =>
          e.kind === "schedule" &&
          isDateInNext7Days(e.date, todayStr)
      )
      .map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        shortDate: formatShortDate(e.date),
        plannerName: e.plannerName,
        plannerColor: e.plannerColor,
        startLabel: minutesToLabel(e.startMin ?? 0),
        endLabel: minutesToLabel(e.endMin ?? 0),
        startMin: e.startMin ?? 0
      }));

    items.sort((a, b) => {
      const aDate = new Date(`${a.date}T00:00:00`);
      const bDate = new Date(`${b.date}T00:00:00`);

      if (aDate < bDate) return -1;
      if (aDate > bDate) return 1;

      return a.startMin - b.startMin;
    });

    return items;
  }, [allEvents, todayStr]);

  return (
    <div className="plannersPage">
      {clockInNotification && (
        <div
          className="clockinToast"
          role="status"
          aria-live="polite">
          <button
            className="clockinToastClose"
            type="button"
            aria-label="Dismiss notification"
            onClick={() => {
              setDismissedEventIds((prev) => {
                const next = new Set(prev);
                next.add(clockInNotification.id);
                return next;
              });
              setClockInNotification(null);
            }}>
            ✕
          </button>

          <div className="clockinToastIcon" aria-hidden="true">
            <div className="clockinToastClock" />
          </div>

          <div className="clockinToastBody">
            <div className="clockinToastTitle">
              Hello! It is time to ClockIn!
            </div>
            <div className="clockinToastMsg">
              You have{" "}
              {clockInNotification.kind === "task"
                ? "Task"
                : "Schedule"}{" "}
              - {clockInNotification.title} from{" "}
              {minutesToLabel(
                clockInNotification.startMin ?? 0
              )}
              {clockInNotification.endMin != null
                ? ` - ${minutesToLabel(clockInNotification.endMin)}`
                : ""}
            </div>
          </div>
        </div>
      )}
      <main className="plannersMain">
        {/* LEFT SIDE */}
        <section className="tilesArea">
          <div className="tilesGrid">
            {planners.map((p) => (
              <div
                key={p.id}
                className="plannerTile plannerTileReal"
                style={{ background: p.color || "#e5e7eb" }}
                onClick={() => navigate(`/planner/${p.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    navigate(`/planner/${p.id}`);
                }}
                title="Open planner">
                <div className="tileInner">
                  <div className="tileTitle">{p.name}</div>
                  {p.description ? (
                    <div className="tileDesc">
                      {p.description}
                    </div>
                  ) : null}
                </div>

                <div
                  className="tileActions"
                  onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteConfirm(p)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}

            <button
              className="plannerTile createTile"
              type="button"
              onClick={openCreate}>
              <span className="plus">+</span>
            </button>
          </div>
        </section>

        {/* RIGHT SIDE */}
        <aside className="rightPanels">
          <div className="panelCard">
            <div className="panelHeader">
              <h2>Today’s Tasks</h2>
              <div className="panelTotal">
                {todaysTasks.length}
              </div>
            </div>

            <div className="panelList">
              {error ? (
                <div className="emptyState">{error}</div>
              ) : todaysTasks.length === 0 ? (
                <div className="emptyState">
                  No tasks for today.
                </div>
              ) : (
                todaysTasks.map((t) => (
                  <div key={t.id} className="panelRow">
                    <div className="rowLeft">
                      <span
                        className="rowDot"
                        style={{ background: t.plannerColor }}
                      />
                      <div className="rowTitle">{t.title}</div>
                      <div className="rowSub">
                        {t.plannerName} • {t.priority}
                      </div>
                    </div>
                    <div className="rowMeta">
                      {formatDurationMinutes(t.durationMin)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panelCard">
            <div className="panelHeader">
              <h2>Weekly Overview</h2>
              <div className="panelTotal">
                {weeklySchedule.length}
              </div>
            </div>

            <div className="panelList">
              {weeklySchedule.length === 0 ? (
                <div className="emptyState">
                  No schedule in the next 7 days.
                </div>
              ) : (
                weeklySchedule.map((s) => (
                  <div key={s.id} className="panelRow">
                    <div className="rowLeft">
                      <span
                        className="rowDot"
                        style={{ background: s.plannerColor }}
                      />
                      <div className="rowTitle">{s.title}</div>
                      <div className="rowSub">
                        {s.plannerName} • {s.shortDate}
                      </div>
                    </div>
                    <div className="rowMeta">
                      {s.startLabel} - {s.endLabel}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* Create/Edit Modal */}
      {plannerModalOpen && (
        <div
          className="plannerModal"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}>
          <div className="plannerModal__backdrop" />
          <div
            className="plannerModal__card"
            onClick={(e) => e.stopPropagation()}>
            <div style={{ height: 34 }} aria-hidden="true" />

            {/* ✅ Match the task modal close button */}
            <button
              className="plannerModal__close"
              onClick={closeModal}
              aria-label="Close"
              type="button"
              style={{ top: 18, right: 22 }}>
              ✕
            </button>

            <input
              className="plannerModal__title"
              placeholder="planner name"
              value={plannerName}
              onChange={(e) => setPlannerName(e.target.value)}
            />

            <div className="plannerModal__field">
              <label>Color</label>
              <div className="colorRowSimple">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatchSimple ${plannerColor === c ? "selected" : ""}`}
                    style={{ background: c }}
                    onClick={() => setPlannerColor(c)}
                    aria-label={`Select color ${c}`}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="plannerModal__field">
              <label>Description</label>
              <textarea
                className="plannerDesc"
                placeholder="description..."
                value={plannerDesc}
                onChange={(e) => setPlannerDesc(e.target.value)}
                rows={6}
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
                onClick={savePlanner}
                disabled={saving}>
                {saving ? "saving..." : "save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div
          className="plannerModal"
          role="dialog"
          aria-modal="true"
          onClick={closeDeleteConfirm}>
          <div className="plannerModal__backdrop" />
          <div
            className="plannerModal__card"
            onClick={(e) => e.stopPropagation()}>
            <div className="confirmTitle">
              Are you sure you want to delete?
            </div>

            <input
              className="plannerModal__title"
              value={confirmPlanner?.name || ""}
              readOnly
            />

            <div className="confirmActions">
              <button
                className="confirmBtn"
                type="button"
                onClick={closeDeleteConfirm}
                disabled={confirmBusy}>
                Cancel
              </button>
              <button
                className="confirmBtn confirmBtnDanger"
                type="button"
                onClick={confirmDelete}
                disabled={confirmBusy}>
                {confirmBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
