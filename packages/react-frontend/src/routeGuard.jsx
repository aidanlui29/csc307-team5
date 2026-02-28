import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { clearToken, getToken } from "./auth";

const AUTH_ME_URL = "/api/me";

export default function RouteGuard() {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;

  const [status, setStatus] = useState("checking"); 

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch(AUTH_ME_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (!res.ok) {
          clearToken();
          setStatus("invalid");
          return;
        }

        setStatus("ok");
      } catch {
        clearToken();
        setStatus("invalid");
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "checking") return null;
  if (status === "invalid") return <Navigate to="/login" replace />;
  return <Outlet />;
}