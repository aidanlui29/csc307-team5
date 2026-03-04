import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet
} from "react-router-dom";
import { useEffect, useState } from "react";

import Login from "./login.jsx";
import Signup from "./signup.jsx";
import Planners from "./planners.jsx";
import Dashboard from "./dashboard.jsx";
import Planner from "./planner.jsx";

import RouteGuard from "./routeGuard.jsx";
import TopBar from "./topBar.jsx";
import MenuDrawer from "./menuDrawer.jsx";

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopBar onMenuClick={() => setMenuOpen(true)} />
      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

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
    return () =>
      window.removeEventListener("clockedIn:openMenu", onOpen);
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<RouteGuard />}>
          <Route element={<Layout />}>
            <Route path="/planners" element={<Planners />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          <Route element={<DrawerOnlyLayout />}>
            <Route path="/planner/:id" element={<Planner />} />
          </Route>
        </Route>

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
