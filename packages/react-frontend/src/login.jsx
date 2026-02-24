import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./auth.css";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const msg = await res.text();
        setError(msg || "Login failed");
        return;
      }

      const data = await res.json();

      // For now you only return ok/id/email; later we'll store JWT token here
      localStorage.setItem("clockedInUser", JSON.stringify(data));

      navigate("/planners");
    } catch (err) {
      setError("Network error. Is the backend running?");
    }
  }

  return (
    <div className="auth">
      <div className="auth__brand">ClockedIn</div>

      <div className="auth__card">
        <h1 className="auth__title">Login</h1>
        <p className="auth__subtitle">Please enter your credentials</p>

        {error && <div className="auth__error">{error}</div>}

        <form className="auth__form" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            className="auth__input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="auth__input"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" className="auth__btn">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}