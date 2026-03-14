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
import Feedback from "./feedback.jsx";
import RouteGuard from "./routeGuard.jsx";
import TopBar from "./topBar.jsx";
import MenuDrawer from "./menuDrawer.jsx";

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Shared layout for pages that use both the top bar and the menu drawer.
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

  // Opens the drawer in response to the custom menu event dispatched from the planner page.
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
  // Defines public routes, protected routes, and layout wrappers for the app.
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
            <Route path="/feedback" element={<Feedback />} />
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
