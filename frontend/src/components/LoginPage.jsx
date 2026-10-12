import { useState, useId } from "react";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

// ── Icons ────────────────────────────────────────────────────────────────────
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function LockKeyholeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="16" r="1" />
      <rect x="3" y="10" width="18" height="12" rx="2" />
      <path d="M7 10V7a5 5 0 0110 0v3" />
    </svg>
  );
}

// ── Department Catalog ───────────────────────────────────────────────────────
const DEPARTMENTS = [
  "Engineering & Cloud Architecture",
  "Product Management & UX Design",
  "Human Resources & People Ops",
  "Marketing & Corporate Growth",
  "Global Finance & Accounting",
  "Operations & Physical Security",
];

export default function LoginPage() {
  const {
    login,
    register,
    verifyMFA,
    forgotPassword,
    resetPassword,
    authError,
    clearError,
  } = useAuth();

  // Mode: "login" | "register" | "forgot" | "reset" | "mfa"
  const [mode, setMode] = useState("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState("");

  // Show/Hide password toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login Form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Register Form
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regDepartment, setRegDepartment] = useState(DEPARTMENTS[0]);
  const [regDesignation, setRegDesignation] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // Forgot / Reset Form
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // MFA Challenge State
  const [mfaTempToken, setMfaTempToken] = useState("");
  const [mfaMaskedEmail, setMfaMaskedEmail] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  // Demo Switcher popover state
  const [showDemoProfiles, setShowDemoProfiles] = useState(false);

  // Dynamic Password Strength Meter (0-4)
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };
  const passwordScore = calculatePasswordStrength(regPassword || newPassword);
  const strengthLabels = ["Very Weak", "Weak", "Moderate", "Strong", "Enterprise Secure"];
  const strengthColors = ["#ef4444", "#f97316", "#eab308", "#10b981", "#059669"];

  // ── Handlers ─────────────────────────────────────────────────────────────
  const switchMode = (newMode) => {
    clearError();
    setSuccessNotice("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setMode(newMode);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;

    setIsSubmitting(true);
    clearError();
    setSuccessNotice("");

    const res = await login(loginEmail, loginPassword);
    setIsSubmitting(false);

    if (res?.mfaRequired) {
      setMfaTempToken(res.tempToken);
      setMfaMaskedEmail(res.emailMasked);
      setMode("mfa");
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      return;
    }

    setIsSubmitting(true);
    clearError();
    setSuccessNotice("");

    const res = await register({
      first_name: regFirstName,
      last_name: regLastName,
      email: regEmail,
      phone: regPhone,
      department: regDepartment,
      designation: regDesignation || "Associate",
      password: regPassword,
      confirm_password: regConfirmPassword,
    });

    setIsSubmitting(false);
    if (res.success) {
      setSuccessNotice("Account created successfully! Welcome to EMWTS.");
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;

    setIsSubmitting(true);
    clearError();
    setSuccessNotice("");

    const res = await forgotPassword(forgotEmail);
    setIsSubmitting(false);

    if (res.success) {
      setSuccessNotice(res.message);
      setMode("reset");
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetCode || !newPassword || !confirmNewPassword) return;

    setIsSubmitting(true);
    clearError();
    setSuccessNotice("");

    const res = await resetPassword(
      forgotEmail || loginEmail,
      resetCode,
      newPassword,
      confirmNewPassword
    );
    setIsSubmitting(false);

    if (res.success) {
      setSuccessNotice(res.message);
      setLoginEmail(forgotEmail || loginEmail);
      setLoginPassword(newPassword);
      setMode("login");
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!mfaCode || mfaCode.length !== 6) return;

    setIsSubmitting(true);
    clearError();
    setSuccessNotice("");

    const res = await verifyMFA(mfaTempToken, mfaCode);
    setIsSubmitting(false);

    if (!res.success) {
      setMfaCode("");
    }
  };

  // Helper for fast developer/evaluator profile population without hardcoding default inputs
  const applyDemoProfile = (email, pwd) => {
    setLoginEmail(email);
    setLoginPassword(pwd);
    setShowDemoProfiles(false);
    clearError();
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Brand Header */}
        <div className="login-header">
          <div className="login-logo-wrapper">
            <div className="login-logo">E</div>
            <span className="live-status-pill">Enterprise 2026</span>
          </div>
          <h1>EMWTS</h1>
          <p>Employee Management &amp; Workplace Tracking Suite</p>
        </div>

        {/* Dynamic Mode Switch Tabs (Login / Register) */}
        {(mode === "login" || mode === "register") && (
          <nav className="auth-tab-switch" aria-label="Authentication mode">
            <button
              type="button"
              className={`auth-tab-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Create Account
            </button>
          </nav>
        )}

        {/* Global Notifications & Error Alerts */}
        {authError && (
          <div className="login-alert error" role="alert">
            <div className="alert-content">
              <span className="alert-icon">⚠</span>
              <span>{authError}</span>
            </div>
            <button type="button" onClick={clearError} className="alert-close" aria-label="Dismiss error">×</button>
          </div>
        )}

        {successNotice && (
          <div className="login-alert success" role="status">
            <div className="alert-content">
              <span className="alert-icon">✓</span>
              <span>{successNotice}</span>
            </div>
            <button type="button" onClick={() => setSuccessNotice("")} className="alert-close" aria-label="Dismiss notice">×</button>
          </div>
        )}

        {/* ── MODE 1: SIGN IN ───────────────────────────────────────────────── */}
        {mode === "login" && (
          <form onSubmit={handleLoginSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="login-email">Work Email</label>
              <div className="input-field-wrapper">
                <input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <div className="label-with-action">
                <label htmlFor="login-password">Password</label>
                <button
                  type="button"
                  className="link-subtle-btn"
                  onClick={() => switchMode("forgot")}
                >
                  Forgot Password?
                </button>
              </div>

              <div className="input-field-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your account password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="form-options-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Keep me signed in</span>
              </label>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isSubmitting || !loginEmail || !loginPassword}
            >
              {isSubmitting ? (
                <span className="btn-spinner-text">Authenticating...</span>
              ) : (
                "Sign In to Workspace →"
              )}
            </button>
          </form>
        )}

        {/* ── MODE 2: SELF-SERVICE REGISTRATION ────────────────────────────── */}
        {mode === "register" && (
          <form onSubmit={handleRegisterSubmit} className="login-form">
            <div className="form-row-2col">
              <div className="form-group">
                <label htmlFor="reg-firstname">First Name</label>
                <input
                  id="reg-firstname"
                  type="text"
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  placeholder="e.g. Jane"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-lastname">Last Name</label>
                <input
                  id="reg-lastname"
                  type="text"
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                  placeholder="e.g. Miller"
                  required
                />
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label htmlFor="reg-email">Work Email</label>
                <input
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-phone">Phone (Optional)</label>
                <input
                  id="reg-phone"
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="+1 (555) 019-0000"
                />
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label htmlFor="reg-dept">Department</label>
                <select
                  id="reg-dept"
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  className="auth-select"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="reg-desig">Designation</label>
                <input
                  id="reg-desig"
                  type="text"
                  value={regDesignation}
                  onChange={(e) => setRegDesignation(e.target.value)}
                  placeholder="e.g. Software Engineer"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <div className="input-field-wrapper">
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {/* Real-Time Password Strength Meter */}
              {regPassword && (
                <div className="password-meter-container">
                  <div className="password-meter-track">
                    <div
                      className="password-meter-bar"
                      style={{
                        width: `${(passwordScore / 4) * 100}%`,
                        backgroundColor: strengthColors[passwordScore],
                      }}
                    />
                  </div>
                  <span
                    className="password-meter-text"
                    style={{ color: strengthColors[passwordScore] }}
                  >
                    {strengthLabels[passwordScore]}
                  </span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="reg-confirm-password">Confirm Password</label>
              <div className="input-field-wrapper">
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {regPassword && regConfirmPassword && regPassword !== regConfirmPassword && (
                <span className="field-hint-error">Passwords do not match</span>
              )}
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={
                isSubmitting ||
                !regFirstName ||
                !regLastName ||
                !regEmail ||
                !regPassword ||
                regPassword !== regConfirmPassword
              }
            >
              {isSubmitting ? "Creating Account..." : "Register & Join Workspace →"}
            </button>
          </form>
        )}

        {/* ── MODE 3: FORGOT PASSWORD REQUEST ───────────────────────────────── */}
        {mode === "forgot" && (
          <form onSubmit={handleForgotSubmit} className="login-form">
            <div className="auth-step-intro">
              <div className="step-icon-badge">
                <LockKeyholeIcon />
              </div>
              <h2>Reset Password</h2>
              <p>Enter your work email address to receive a secure 6-digit verification code.</p>
            </div>

            <div className="form-group">
              <label htmlFor="forgot-email">Registered Email</label>
              <div className="input-field-wrapper">
                <input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isSubmitting || !forgotEmail}
            >
              {isSubmitting ? "Sending Code..." : "Send Verification Code"}
            </button>

            <button
              type="button"
              className="btn-back-link"
              onClick={() => switchMode("login")}
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* ── MODE 4: CONFIRM PASSWORD RESET WITH CODE ───────────────────────── */}
        {mode === "reset" && (
          <form onSubmit={handleResetSubmit} className="login-form">
            <div className="auth-step-intro">
              <div className="step-icon-badge">
                <LockKeyholeIcon />
              </div>
              <h2>Set New Password</h2>
              <p>
                Enter the 6-digit code sent to{" "}
                <strong>{forgotEmail || "your email"}</strong> and create a new password.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="reset-code">6-Digit Security Code</label>
              <input
                id="reset-code"
                type="text"
                maxLength={6}
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="otp-single-input"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="reset-new-password">New Password</label>
              <div className="input-field-wrapper">
                <input
                  id="reset-new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reset-confirm-password">Confirm New Password</label>
              <div className="input-field-wrapper">
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-type new password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {newPassword && confirmNewPassword && newPassword !== confirmNewPassword && (
                <span className="field-hint-error">Passwords do not match</span>
              )}
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={
                isSubmitting ||
                resetCode.length !== 6 ||
                !newPassword ||
                newPassword !== confirmNewPassword
              }
            >
              {isSubmitting ? "Updating Password..." : "Update Password & Sign In"}
            </button>

            <button
              type="button"
              className="btn-back-link"
              onClick={() => switchMode("login")}
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* ── MODE 5: TWO-FACTOR AUTHENTICATION CHALLENGE ────────────────────── */}
        {mode === "mfa" && (
          <form onSubmit={handleMfaSubmit} className="login-form">
            <div className="auth-step-intro mfa-intro">
              <div className="step-icon-badge mfa-badge">
                <ShieldCheckIcon />
              </div>
              <h2>Two-Factor Verification</h2>
              <p>
                A high-security 6-digit code has been dispatched to{" "}
                <span className="mfa-email-highlight">{mfaMaskedEmail || "your email"}</span>.
                You can also enter your Authenticator App TOTP code.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="mfa-code" className="text-center">Security Code</label>
              <input
                id="mfa-code"
                type="text"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="otp-single-input"
                autoComplete="one-time-code"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="login-submit-btn mfa-submit-btn"
              disabled={isSubmitting || mfaCode.length !== 6}
            >
              {isSubmitting ? "Verifying..." : "Confirm & Enter Workspace →"}
            </button>

            <button
              type="button"
              className="btn-back-link"
              onClick={() => switchMode("login")}
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* Enterprise Security Compliance Footer */}
        <div className="login-footer">
          <div className="enterprise-security-meta">
            <div className="security-badges">
              <span>🔒 256-Bit TLS</span>
              <span>🛡️ SOC2 Ready</span>
              <span>⚡ Neon PostgreSQL</span>
            </div>
            <p className="security-subtext">
              Authorized personnel only. All access attempts are cryptographically signed &amp; audited.
            </p>
          </div>

          {/* Quick Demo Switcher Accordion (No hardcoded credentials in the main form) */}
          <div className="demo-switcher-wrapper">
            <button
              type="button"
              className="demo-toggle-link"
              onClick={() => setShowDemoProfiles(!showDemoProfiles)}
            >
              {showDemoProfiles ? "▲ Hide Quick Evaluation Roles" : "▼ Testing & Evaluation Quick Profiles"}
            </button>

            {showDemoProfiles && (
              <div className="demo-roles-panel">
                <p className="demo-helper-title">Select a role to populate sign-in credentials:</p>
                <div className="demo-roles-grid">
                  <button
                    type="button"
                    className="demo-role-btn"
                    onClick={() => applyDemoProfile("admin@emwts.local", "AdminPass2026!")}
                  >
                    <strong>Super Admin</strong>
                    <span>admin@emwts.local</span>
                  </button>
                  <button
                    type="button"
                    className="demo-role-btn"
                    onClick={() => applyDemoProfile("hr@emwts.local", "HrPass2026!")}
                  >
                    <strong>HR Director</strong>
                    <span>hr@emwts.local</span>
                  </button>
                  <button
                    type="button"
                    className="demo-role-btn"
                    onClick={() => applyDemoProfile("manager@emwts.local", "ManagerPass2026!")}
                  >
                    <strong>Team Manager</strong>
                    <span>manager@emwts.local</span>
                  </button>
                  <button
                    type="button"
                    className="demo-role-btn"
                    onClick={() => applyDemoProfile("ananya.rao@emwts.local", "EmployeePass2026!")}
                  >
                    <strong>Staff Engineer</strong>
                    <span>ananya.rao@emwts.local</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
