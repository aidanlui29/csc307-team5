import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { clearToken, getToken } from "./auth";

const AUTH_ME_URL = "/api/me";

export default function RouteGuard() {
  const token = getToken();
  const [status, setStatus] = useState(
    token ? "checking" : "missing"
  );

  // Verifies the stored token before allowing access to protected routes.
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch(AUTH_ME_URL, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (cancelled) return;

        // Invalid or expired tokens are cleared and redirected to login.
        if (res.status === 401 || res.status === 403) {
          clearToken();
          setStatus("invalid");
          return;
        }

        // Non-auth errors do not immediately block access.
        if (!res.ok) {
          setStatus("ok");
          return;
        }

        setStatus("ok");
      } catch {
        if (cancelled) return;
        setStatus("ok");
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "missing")
    return <Navigate to="/login" replace />;
  if (status === "checking") return null;
  if (status === "invalid")
    return <Navigate to="/login" replace />;
  return <Outlet />;
}
