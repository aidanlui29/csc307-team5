import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { saveToken, clearToken } from "./auth";
import "./auth.css";

const AUTH_ME_URL = "/api/me";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    clearToken();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const msg = await res.text();
        setError(msg || "Invalid email or password.");
        return;
      }

      const data = await res.json();
      if (!data?.token) {
        setError("Server did not return a token.");
        return;
      }

      const verifyRes = await fetch(AUTH_ME_URL, {
        headers: { Authorization: `Bearer ${data.token}` },
      });

      if (!verifyRes.ok) {
        setError("Invalid email or password.");
        return;
      }

      saveToken(data.token);
      navigate("/planners");
    } catch {
      setError("Network error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__brand">ClockedIn</div>

      <div className="auth__card">
        <h1 className="auth__title">Welcome</h1>
        <p className="auth__subtitle">Please enter your email and password</p>

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

          <button type="submit" className="auth__btn" disabled={loading}>
            {loading ? "Logging in..." : "Continue"}
          </button>
        </form>
      </div>

      {/* ✅ Footer is OUTSIDE the white card now */}
      <div style={{ marginTop: "14px", textAlign: "center" }}>
        <span
          style={{
            color: "white",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          Don’t have an account?{" "}
        </span>

        <button
          type="button"
          onClick={() => navigate("/signup")}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "#3b82f6",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          Create account
        </button>
      </div>
    </div>
  );
}