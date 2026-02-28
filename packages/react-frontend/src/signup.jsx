import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveToken } from "./auth";
import "./auth.css";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const msg = await res.text();
        setError(msg || "Signup failed");
        return;
      }

      const data = await res.json();
      if (!data.token) {
        setError("No token returned from server.");
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
        <h1 className="auth__title">Create account</h1>
        <p className="auth__subtitle">
          Enter your email and password to get started
        </p>

        {error && <div className="auth__error">{error}</div>}

        <form className="auth__form" onSubmit={handleSignup}>
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
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </div>

      <div style={{ marginTop: "14px", textAlign: "center" }}>
        <span
          style={{
            color: "white",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          Have an account?{" "}
        </span>

        <button
          type="button"
          onClick={() => navigate("/login")}
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
          Login
        </button>
      </div>
    </div>
  );
}