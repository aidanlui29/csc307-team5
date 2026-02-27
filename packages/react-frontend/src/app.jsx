import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";

import Login from "./login.jsx";
import Signup from "./signup.jsx";
import Planners from "./planners.jsx";
import Dashboard from "./dashboard.jsx";
import Planner from "./planner.jsx";

import RouteGuard from "./routeGuard.jsx";
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

function DrawerOnlyLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setMenuOpen(true);
    window.addEventListener("clockedIn:openMenu", onOpen);
    return () => window.removeEventListener("clockedIn:openMenu", onOpen);
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Auth pages (NO menu) */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<RouteGuard />}>
          {/* Menu Layout routes */}
          <Route element={<Layout />}>
            <Route path="/planners" element={<Planners />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          {/* Drawer-only layout routes */}
          <Route element={<DrawerOnlyLayout />}>
            <Route path="/planner" element={<Planner />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}