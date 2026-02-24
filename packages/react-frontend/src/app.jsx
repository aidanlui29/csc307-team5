import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./login.jsx";
import Planners from "./planners.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/planners" element={<Planners />} />
      </Routes>
    </BrowserRouter>
  );
}