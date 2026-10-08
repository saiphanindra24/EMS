import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const { login, authError, clearError } = useAuth();
  const [email, setEmail] = useState("admin@emwts.local");
  const [password, setPassword] = useState("AdminPass2026!");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    await login(email, password);
    setIsSubmitting(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">E</div>
          <h1>EMWTS</h1>
          <p>Workplace & Employee Tracking Suite</p>
        </div>

        {authError && (
          <div className="login-alert" role="alert">
            <span>⚠ {authError}</span>
            <button type="button" onClick={clearError} className="alert-close">×</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Authenticating..." : "Sign In to Workspace"}
          </button>
        </form>

        <div className="login-footer">
          <div className="demo-credentials">
            <strong>Development Administrator:</strong>
            <code>admin@emwts.local / AdminPass2026!</code>
          </div>
        </div>
      </div>
    </div>
  );
}
