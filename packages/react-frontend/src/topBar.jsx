export default function TopBar({ onMenuClick }) {
  return (
    <header
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        color: "white",
        background:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 40%)," +
          "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
        position: "sticky",
        top: 0,
        zIndex: 20,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)"
      }}>
      <button
        onClick={onMenuClick}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(255,255,255,0.08)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center"
        }}>
        <div style={{ display: "grid", gap: 4 }}>
          <span style={barStyle} />
          <span style={barStyle} />
          <span style={barStyle} />
        </div>
      </button>

      <div style={{ fontWeight: 800 }}>ClockedIn</div>
      <div style={{ width: 40 }} />
    </header>
  );
}

const barStyle = {
  display: "block",
  width: 18,
  height: 2,
  background: "white",
  borderRadius: 999
};
