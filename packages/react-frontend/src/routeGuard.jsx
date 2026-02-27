import { Navigate, Outlet } from "react-router-dom";
import { getToken } from "./auth";

export default function RouteGuard() {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}