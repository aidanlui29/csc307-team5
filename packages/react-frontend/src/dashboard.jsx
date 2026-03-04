import "./Dashboard.css";

export default function Dashboard() {
  return (
    <div className="dashboardPage">
      <h1 className="dashboardTitle">Dashboard</h1>

      <div className="dashboardGrid">
        <div className="dashboardCard">
          <h2>Welcome Back</h2>
          <p>Your planner overview will appear here.</p>
        </div>

        <div className="dashboardCard">
          <h2>Today</h2>
          <p>No tasks scheduled yet.</p>
        </div>

        <div className="dashboardCard">
          <h2>This Week</h2>
          <p>No activity yet.</p>
        </div>
      </div>
    </div>
  );
}
