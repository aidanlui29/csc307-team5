import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useState } from "react";

import Login from "./login.jsx";
import Planners from "./planners.jsx";
import Dashboard from "./dashboard.jsx";

import TopBar from "./topBar.jsx";
import MenuDrawer from "./menuDrawer.jsx";

/* Layout wrapper: anything inside here gets the menu */
function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar onMenuClick={() => setMenuOpen(true)} />
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Page content renders here */}
      <div>
        <Outlet />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Login page (NO menu) */}
        <Route path="/login" element={<Login />} />

        {/* All routes below use Layout (menu included) */}
        <Route element={<Layout />}>
          <Route path="/planners" element={<Planners />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}