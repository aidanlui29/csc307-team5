import "./Planners.css";

export default function Planners() {
  const planners = []; // empty for fresh account

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
              No tasks for today.
            </div>
          </div>

          <div className="panelCard">
            <div className="panelHeader">
              <h2>Weekly Overview</h2>
            </div>

            <div className="emptyState">
              No activity this week.
            </div>
          </div>

        </aside>
      </main>
    </div>
  );
}