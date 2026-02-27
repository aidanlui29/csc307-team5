import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authHeaders } from "./auth";
import "./Planners.css";

export default function Planners() {
  const navigate = useNavigate();

  // Start with empty list so your default UI shows immediately
  const [planners, setPlanners] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPlanners() {
      try {
        setError("");
        const res = await fetch("/api/planners", {
          headers: authHeaders(),
        });

        if (res.status === 401) {
          navigate("/login");
          return;
        }

        if (!res.ok) {
          const msg = await res.text();
          if (!cancelled) setError(msg || "Failed to load planners");
          return;
        }

        const data = await res.json();
        if (!cancelled) setPlanners(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("Network error. Is the backend running?");
      }
    }

    loadPlanners();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="plannersPage">
      <main className="plannersMain">
        {/* LEFT SIDE */}
        <section className="tilesArea">
          {planners.length === 0 && (
            <button className="plannerTile createTile">
              <span className="plus">+</span>
            </button>
          )}
        </section>

        {/* RIGHT SIDE */}
        <aside className="rightPanels">
          <div className="panelCard">
            <div className="panelHeader">
              <h2>Today’s Tasks</h2>
            </div>

            <div className="emptyState">
              {error ? error : "No tasks for today."}
            </div>
          </div>

          <div className="panelCard">
            <div className="panelHeader">
              <h2>Weekly Overview</h2>
            </div>

            <div className="emptyState">No activity this week.</div>
          </div>
        </aside>
      </main>
    </div>
  );
}