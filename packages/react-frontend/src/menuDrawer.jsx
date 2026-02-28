import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearToken } from "./auth"; 

export default function MenuDrawer({ open, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function handleLogout() {
    clearToken(); 
    onClose();
    navigate("/login");
  }

  if (!open) return null;

  const isActive = (path) => location.pathname === path;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.45)",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100vh",
          width: 280,
          padding: 20,
          color: "white",
          background:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 40%)," +
            "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
          boxShadow: "20px 0 60px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          overflowY: "auto",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18 }}>
          Menu
        </div>

        <Link
          to="/planners"
          onClick={onClose}
          style={navStyle(isActive("/planners"))}
        >
          Planners
        </Link>

        <Link
          to="/dashboard"
          onClick={onClose}
          style={navStyle(isActive("/dashboard"))}
        >
          Dashboard
        </Link>

        <button onClick={handleLogout} style={logoutStyle}>
          Log Out
        </button>
      </aside>
    </div>
  );
}

function navStyle(active) {
  return {
    padding: "12px",
    borderRadius: "10px",
    textDecoration: "none",
    color: "white",
    background: active
      ? "rgba(255,255,255,0.25)"
      : "rgba(255,255,255,0.15)",
    fontWeight: 600,
  };
}

const logoutStyle = {
  marginTop: "190%",
  padding: "12px",
  border: "none",
  borderRadius: "10px",
  background: "rgba(255,255,255,0.18)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};