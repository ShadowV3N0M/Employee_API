import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import ThemeToggle from "../components/ThemeToggle";
import FieldError from "../components/FieldError";
import { validateUsername, validatePassword, validateEmail } from "../validation";

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  // Flip State: false = Front (Sign in), true = Back (Register or Forgot Password)
  const [isFlipped, setIsFlipped] = useState(false);
  const [backMode, setBackMode] = useState("register"); // "register" | "forgot"

  // Remember me state
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem("portal_remember_me") === "true";
    } catch {
      return false;
    }
  });

  // Front Form State (Login)
  const [loginUsername, setLoginUsername] = useState(() => {
    try {
      if (localStorage.getItem("portal_remember_me") === "true") {
        return localStorage.getItem("portal_saved_user") || "";
      }
    } catch {}
    return "";
  });
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [loginError, setLoginError] = useState("");
  const [loginNotice, setLoginNotice] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sessionReason = sessionStorage.getItem("logout_reason");
      const sessionMins = sessionStorage.getItem("logout_minutes");
      if (params.get("reason") === "timeout" || sessionReason === "timeout") {
        const mins = params.get("minutes") || sessionMins;
        sessionStorage.removeItem("logout_reason");
        sessionStorage.removeItem("logout_minutes");
        return mins
          ? `You have been signed out automatically due to ${mins} minutes of inactivity.`
          : "You have been signed out automatically due to inactivity.";
      }
    } catch {}
    return "";
  });
  const [loginBusy, setLoginBusy] = useState(false);

  // Back Form State (Register / Forgot Password)
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regFieldErrors, setRegFieldErrors] = useState({});

  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotError, setForgotError] = useState("");

  const [backError, setBackError] = useState("");
  const [backNotice, setBackNotice] = useState("");
  const [debugUrl, setDebugUrl] = useState("");
  const [backBusy, setBackBusy] = useState(false);

  // Live Clock & Dynamic Date State
  const [currentTime, setCurrentTime] = useState("");
  const [currentDateFormatted, setCurrentDateFormatted] = useState("");
  const [currentDayLine, setCurrentDayLine] = useState("");
  const [greeting, setGreeting] = useState("GOOD DAY");

  useEffect(() => {
    const updateLiveTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      const day = now.getDate();
      const month = now.toLocaleDateString("en-US", { month: "short" });
      const year = now.getFullYear();
      setCurrentDateFormatted(`${day} ${month}, ${year}`);

      setCurrentDayLine(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );

      const hour = now.getHours();
      if (hour < 12) setGreeting("GOOD MORNING");
      else if (hour < 17) setGreeting("GOOD AFTERNOON");
      else setGreeting("GOOD EVENING");
    };

    updateLiveTime();
    const timer = setInterval(updateLiveTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (user) return <Navigate to="/" replace />;

  // Login handlers
  const handleLoginUsernameChange = (e) => {
    setLoginUsername(e.target.value);
    if (loginFieldErrors.username) {
      setLoginFieldErrors((prev) => ({ ...prev, username: "" }));
    }
    if (loginError) setLoginError("");
  };

  const handleLoginPasswordChange = (e) => {
    setLoginPassword(e.target.value);
    if (loginFieldErrors.password) {
      setLoginFieldErrors((prev) => ({ ...prev, password: "" }));
    }
    if (loginError) setLoginError("");
  };

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError("");

    const errors = {};
    if (!loginUsername.trim()) {
      errors.username = "Work email or Employee ID is required.";
    }
    if (!loginPassword) {
      errors.password = "Password is required.";
    }

    if (Object.keys(errors).length > 0) {
      setLoginFieldErrors(errors);
      const firstId = errors.username ? "login-username" : "login-password";
      const el = document.getElementById(firstId);
      if (el) el.focus();
      return;
    }

    setLoginBusy(true);
    try {
      const { access_token } = await api.login(loginUsername, loginPassword);

      // Handle remember me persistence
      try {
        if (rememberMe) {
          localStorage.setItem("portal_remember_me", "true");
          localStorage.setItem("portal_saved_user", loginUsername.trim());
        } else {
          localStorage.removeItem("portal_remember_me");
          localStorage.removeItem("portal_saved_user");
        }
      } catch {}

      await signIn(access_token);
      navigate("/", { replace: true });
    } catch (err) {
      setLoginError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoginBusy(false);
    }
  }

  // Registration handlers
  const handleRegUsernameChange = (e) => {
    setRegUsername(e.target.value);
    if (regFieldErrors.username) {
      setRegFieldErrors((prev) => ({ ...prev, username: "" }));
    }
    if (backError) setBackError("");
  };

  const handleRegUsernameBlur = () => {
    const err = validateUsername(regUsername);
    setRegFieldErrors((prev) => ({ ...prev, username: err }));
  };

  const handleRegEmailChange = (e) => {
    setRegEmail(e.target.value);
    if (regFieldErrors.email) {
      setRegFieldErrors((prev) => ({ ...prev, email: "" }));
    }
    if (backError) setBackError("");
  };

  const handleRegEmailBlur = () => {
    const err = validateEmail(regEmail, false);
    setRegFieldErrors((prev) => ({ ...prev, email: err }));
  };

  const handleRegPasswordChange = (e) => {
    setRegPassword(e.target.value);
    if (regFieldErrors.password) {
      setRegFieldErrors((prev) => ({ ...prev, password: "" }));
    }
    if (backError) setBackError("");
  };

  const handleRegPasswordBlur = () => {
    const err = validatePassword(regPassword, 6);
    setRegFieldErrors((prev) => ({ ...prev, password: err }));
  };

  // Forgot password handlers
  const handleForgotUsernameChange = (e) => {
    setForgotUsername(e.target.value);
    if (forgotError) setForgotError("");
    if (backError) setBackError("");
  };

  async function handleBackSubmit(e) {
    e.preventDefault();
    setBackError("");
    setBackNotice("");
    setDebugUrl("");

    if (backMode === "forgot") {
      if (!forgotUsername.trim()) {
        setForgotError("Please enter your username or registered email.");
        const el = document.getElementById("forgot-username");
        if (el) el.focus();
        return;
      }

      setBackBusy(true);
      try {
        const res = await api.forgotPassword(forgotUsername.trim());
        setBackNotice(res.message || "Password reset instructions sent.");
        if (res.debug_reset_url) {
          setDebugUrl(res.debug_reset_url);
        }
      } catch (err) {
        setBackError(err.message || "Failed to initiate password reset.");
      } finally {
        setBackBusy(false);
      }
    } else {
      // Register mode
      const errors = {
        username: validateUsername(regUsername),
        password: validatePassword(regPassword, 6),
        email: validateEmail(regEmail, false),
      };

      const activeErrors = {};
      for (const [k, v] of Object.entries(errors)) {
        if (v) activeErrors[k] = v;
      }

      if (Object.keys(activeErrors).length > 0) {
        setRegFieldErrors(activeErrors);
        setBackError("Please correct the errors before registering.");
        const firstKey = Object.keys(activeErrors)[0];
        const el = document.getElementById(`reg-${firstKey}`);
        if (el) el.focus();
        return;
      }

      setBackBusy(true);
      try {
        const { access_token } = await api.register(
          regUsername.trim(),
          regPassword,
          regEmail.trim() || undefined
        );
        await signIn(access_token);
        navigate("/", { replace: true });
      } catch (err) {
        setBackError(err.message || "Registration failed.");
      } finally {
        setBackBusy(false);
      }
    }
  }

  function flipToRegister() {
    setBackMode("register");
    setBackError("");
    setBackNotice("");
    setDebugUrl("");
    setRegFieldErrors({});
    if (loginUsername && !regUsername) {
      setRegUsername(loginUsername);
    }
    setShowRegPassword(false);
    setIsFlipped(true);
  }

  function flipToForgot() {
    setBackMode("forgot");
    setBackError("");
    setBackNotice("");
    setDebugUrl("");
    setForgotError("");
    if (loginUsername && !forgotUsername) {
      setForgotUsername(loginUsername);
    }
    setIsFlipped(true);
  }

  function flipToLogin() {
    setLoginError("");
    setLoginFieldErrors({});
    setShowLoginPassword(false);
    setIsFlipped(false);
  }

  return (
    <div className="auth-split-wrapper">
      {/* Top right theme toggle */}
      <div className="auth-theme-toggle-dock">
        <ThemeToggle />
      </div>

      <div className="auth-split-container">
        {/* =========================================================================
            LEFT COLUMN: Modern Workday & Attendance Showcase (No Logos, No Photos)
           ========================================================================= */}
        <section className="auth-hero-showcase" aria-label="Workplace overview and live stats">
          {/* Subtle Cybernetic Grid & Ambient Light Glows */}
          <div className="auth-hero-glow-orb auth-hero-glow-1" aria-hidden="true" />
          <div className="auth-hero-glow-orb auth-hero-glow-2" aria-hidden="true" />
          <div className="auth-hero-mesh-overlay" aria-hidden="true" />

          {/* Top Bar of Left Showcase */}
          <div className="auth-hero-topbar">
            <div className="auth-hero-brand-pill">
              <span className="auth-hero-brand-icon" aria-hidden="true">🏢</span>
              <span className="auth-hero-brand-name">PORTAL WORKSPACE</span>
            </div>

            <div className="auth-live-status-pill" title="System operational & tracking active">
              <span className="live-status-dot" aria-hidden="true" />
              <span>Live attendance</span>
            </div>
          </div>

          {/* Floating Glass Dynamic Cards (Top Row) */}
          <div className="auth-hero-floating-row">
            <div className="auth-glass-widget" title="Current system date">
              <div className="auth-glass-widget-icon" aria-hidden="true">
                <CalendarIcon />
              </div>
              <div className="auth-glass-widget-content">
                <span className="auth-glass-widget-label">Today</span>
                <strong className="auth-glass-widget-value">{currentDateFormatted || "23 Oct, 2026"}</strong>
              </div>
            </div>

            <div className="auth-glass-widget" title="Live clock synchronization">
              <div className="auth-glass-widget-icon clock" aria-hidden="true">
                <ClockIcon />
              </div>
              <div className="auth-glass-widget-content">
                <span className="auth-glass-widget-label">Current time</span>
                <strong className="auth-glass-widget-value mono">{currentTime || "03:16:07 PM"}</strong>
              </div>
            </div>
          </div>

          {/* Main Hero Graphic: Digital Network Core */}
          <div className="auth-hero-central-canvas" aria-hidden="true">
            <div className="auth-digital-sphere">
              <div className="sphere-ring ring-1" />
              <div className="sphere-ring ring-2" />
              <div className="sphere-ring ring-3" />
              <div className="sphere-core" />
              <div className="sphere-particle p-1" />
              <div className="sphere-particle p-2" />
              <div className="sphere-particle p-3" />
              <div className="sphere-particle p-4" />
            </div>

            {/* Floating Status Glass Badge (Right side of canvas) */}
            <div className="auth-floating-badge badge-right">
              <div className="auth-badge-icon-wrap" aria-hidden="true">
                <ShieldCheckIcon />
              </div>
              <div>
                <span className="auth-badge-sub">Check-in status</span>
                <span className="auth-badge-main verified">Verified</span>
              </div>
            </div>

            {/* Floating Attendance Verified Banner (Bottom center) */}
            <div className="auth-floating-banner">
              <div className="auth-banner-check" aria-hidden="true">
                <CheckMarkIcon />
              </div>
              <div>
                <span className="auth-banner-sub">Attendance verified</span>
                <span className="auth-banner-main">Welcome back!</span>
              </div>
            </div>
          </div>

          {/* Hero Typography & Mission Statement */}
          <div className="auth-hero-typography">
            <span className="auth-hero-overline">WELCOME TO YOUR WORKDAY</span>
            <h1 className="auth-hero-title">
              Your attendance <br />
              <span className="auth-hero-gradient-text">beautifully</span> <br />
              connected.
            </h1>
            <p className="auth-hero-desc">
              A secure place to check in, stay on time, and keep your employee records connected with payroll.
            </p>
          </div>

          {/* Bottom 4-Column Feature Strip */}
          <div className="auth-hero-features-grid">
            <div className="auth-feature-card">
              <div className="auth-feature-icon" aria-hidden="true">
                <ShieldIcon />
              </div>
              <div className="auth-feature-info">
                <strong>Secure attendance</strong>
                <span>Your data is protected</span>
              </div>
            </div>

            <div className="auth-feature-card">
              <div className="auth-feature-icon" aria-hidden="true">
                <ClockScanIcon />
              </div>
              <div className="auth-feature-info">
                <strong>Real-time tracking</strong>
                <span>Live clock-in updates</span>
              </div>
            </div>

            <div className="auth-feature-card">
              <div className="auth-feature-icon" aria-hidden="true">
                <ChartIcon />
              </div>
              <div className="auth-feature-info">
                <strong>Insightful reports</strong>
                <span>Track and improve</span>
              </div>
            </div>

            <div className="auth-feature-card">
              <div className="auth-feature-icon" aria-hidden="true">
                <UsersIcon />
              </div>
              <div className="auth-feature-info">
                <strong>Team connected</strong>
                <span>Stronger together</span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            RIGHT COLUMN: Clean Elevated Workspace Authentication Card
           ========================================================================= */}
        <section className="auth-card-stage" aria-label="Sign in form">
          <div className="auth-flip-container">
            <div className={`auth-flip-card ${isFlipped ? "is-flipped" : ""}`}>

              {/* ---------------- FRONT FACE: SIGN IN ---------------- */}
              <form
                className="auth-card-face auth-card-front"
                onSubmit={handleLoginSubmit}
                aria-hidden={isFlipped}
                noValidate
              >
                <div className="auth-card-inner">
                  {/* Card Header matching reference image */}
                  <div className="auth-form-header">
                    <div className="auth-header-top-row">
                      <span className="auth-system-category">HR MANAGEMENT SYSTEM</span>
                      <span className="auth-badge-encrypted">
                        <span className="lock-dot" aria-hidden="true">🔒</span>
                        <span>Secure & Encrypted</span>
                      </span>
                    </div>

                    <div className="auth-greeting-tag">{greeting}</div>
                    <h2 className="auth-heading">Sign in to your workspace</h2>
                    <p className="auth-subheading">Your attendance, leave and workday—all in one place.</p>
                    <div className="auth-accent-bar" aria-hidden="true" />
                  </div>

                  {/* Prominent Session Timeout / Security Notification Banner */}
                  {loginNotice && (
                    <div className="auth-status-banner warning" role="alert">
                      <div className="auth-status-banner-icon" aria-hidden="true">!</div>
                      <div className="auth-status-banner-content">
                        <strong>Authentication status</strong>
                        <span>{loginNotice}</span>
                      </div>
                      <button
                        type="button"
                        className="auth-status-dismiss"
                        onClick={() => setLoginNotice("")}
                        aria-label="Dismiss notice"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Standard Form Error */}
                  {loginError && (
                    <div className="auth-status-banner error" role="alert">
                      <div className="auth-status-banner-icon" aria-hidden="true">✕</div>
                      <div className="auth-status-banner-content">
                        <strong>Sign in failed</strong>
                        <span>{loginError}</span>
                      </div>
                      <button
                        type="button"
                        className="auth-status-dismiss"
                        onClick={() => setLoginError("")}
                        aria-label="Dismiss error"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Work Email / Username Input */}
                  <div className="auth-field-group">
                    <label htmlFor="login-username" className="auth-field-label">
                      Work email or Employee ID <span className="req-star">*</span>
                    </label>
                    <div className={`auth-input-wrapper ${loginFieldErrors.username ? "has-error" : ""}`}>
                      <span className="auth-input-icon" aria-hidden="true">
                        <MailIcon />
                      </span>
                      <input
                        id="login-username"
                        type="text"
                        value={loginUsername}
                        onChange={handleLoginUsernameChange}
                        autoComplete="username"
                        placeholder="name@company.com or username"
                        required
                        disabled={isFlipped}
                        tabIndex={isFlipped ? -1 : 0}
                        autoFocus={!isFlipped}
                        className="auth-input-control"
                        aria-invalid={Boolean(loginFieldErrors.username)}
                        aria-describedby={loginFieldErrors.username ? "login-username-err" : undefined}
                      />
                    </div>
                    <FieldError error={loginFieldErrors.username} id="login-username-err" />
                  </div>

                  {/* Password Input */}
                  <div className="auth-field-group">
                    <label htmlFor="login-password" className="auth-field-label">
                      Password <span className="req-star">*</span>
                    </label>
                    <div className={`auth-input-wrapper ${loginFieldErrors.password ? "has-error" : ""}`}>
                      <span className="auth-input-icon" aria-hidden="true">
                        <LockKeyIcon />
                      </span>
                      <input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={handleLoginPasswordChange}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        required
                        disabled={isFlipped}
                        tabIndex={isFlipped ? -1 : 0}
                        className="auth-input-control"
                        aria-invalid={Boolean(loginFieldErrors.password)}
                        aria-describedby={loginFieldErrors.password ? "login-password-err" : undefined}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                        disabled={isFlipped}
                        tabIndex={isFlipped ? -1 : 0}
                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
                        title={showLoginPassword ? "Hide password" : "Show password"}
                      >
                        <PasswordToggleIcon visible={showLoginPassword} />
                      </button>
                    </div>
                    <FieldError error={loginFieldErrors.password} id="login-password-err" />
                  </div>

                  {/* Remember Me & Forgot Password Row */}
                  <div className="auth-options-row">
                    <label className="auth-remember-label">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        disabled={isFlipped}
                        tabIndex={isFlipped ? -1 : 0}
                      />
                      <span>Remember me</span>
                    </label>

                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={flipToForgot}
                      disabled={isFlipped}
                      tabIndex={isFlipped ? -1 : 0}
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Primary Vibrant Submit Button */}
                  <button
                    type="submit"
                    className="auth-btn-primary"
                    disabled={loginBusy || isFlipped}
                    tabIndex={isFlipped ? -1 : 0}
                  >
                    <span>{loginBusy ? "Signing in..." : "Sign In"}</span>
                    {!loginBusy && <span className="auth-btn-arrow" aria-hidden="true">→</span>}
                  </button>

                  {/* Subtle OR Divider */}
                  <div className="auth-divider">
                    <span>OR</span>
                  </div>

                  {/* Single Sign-on / Alternative Action */}
                  <button
                    type="button"
                    className="auth-btn-microsoft"
                    disabled={isFlipped}
                    tabIndex={isFlipped ? -1 : 0}
                    onClick={() => {
                      setLoginNotice("SSO is integrated with your organizational email. Please sign in above.");
                    }}
                  >
                    <MicrosoftLogoIcon />
                    <span>Sign in with Microsoft</span>
                  </button>

                  {/* Switch to Account Registration */}
                  <div className="auth-create-account-wrap">
                    <span className="muted small">No account yet? </span>
                    <button
                      type="button"
                      className="flip-toggle-btn"
                      disabled={isFlipped}
                      tabIndex={isFlipped ? -1 : 0}
                      onClick={flipToRegister}
                    >
                      <span>Create Account</span>
                      <span className="flip-icon" aria-hidden="true">↻</span>
                    </button>
                  </div>
                </div>

                {/* Footer Status Line matching reference */}
                <div className="auth-card-bottom-footer">
                  <div className="auth-status-indicator-line">
                    <span className="dot-pulse" aria-hidden="true" />
                    <span>System secure</span>
                    <span className="sep">•</span>
                    <span>Secure access</span>
                    <span className="sep">•</span>
                    <span>{currentDayLine || "Friday, Oct 23, 2026"}</span>
                  </div>
                  <p className="auth-legal-notice">
                    By continuing, you agree to our <strong>Terms &amp; Conditions</strong> and <strong>Privacy Policy</strong>.
                  </p>
                </div>
              </form>

              {/* ---------------- BACK FACE: REGISTER / FORGOT PASSWORD ---------------- */}
              <form
                className="auth-card-face auth-card-back"
                onSubmit={handleBackSubmit}
                aria-hidden={!isFlipped}
                noValidate
              >
                <div className="auth-card-inner">
                  <div className="auth-form-header">
                    <div className="auth-header-top-row">
                      <span className="auth-system-category">HR MANAGEMENT SYSTEM</span>
                      <span className="auth-badge-encrypted">
                        <span className="lock-dot" aria-hidden="true">🔒</span>
                        <span>Secure & Encrypted</span>
                      </span>
                    </div>

                    <div className="auth-greeting-tag">
                      {backMode === "register" ? "SELF SERVICE" : "ACCOUNT RECOVERY"}
                    </div>
                    <h2 className="auth-heading">
                      {backMode === "register" ? "Create your account" : "Reset your password"}
                    </h2>
                    <p className="auth-subheading">
                      {backMode === "register"
                        ? "Register to access your employee portal, payslips, and attendance."
                        : "Enter your username or email address and we'll send reset instructions."}
                    </p>
                    <div className="auth-accent-bar" aria-hidden="true" />
                  </div>

                  {backError && (
                    <div className="auth-status-banner error" role="alert">
                      <div className="auth-status-banner-icon" aria-hidden="true">✕</div>
                      <div className="auth-status-banner-content">
                        <strong>Error</strong>
                        <span>{backError}</span>
                      </div>
                    </div>
                  )}

                  {backNotice && (
                    <div className="auth-status-banner success" role="alert">
                      <div className="auth-status-banner-icon" aria-hidden="true">✓</div>
                      <div className="auth-status-banner-content">
                        <strong>Success</strong>
                        <span>{backNotice}</span>
                        {debugUrl && (
                          <div style={{ marginTop: "6px" }}>
                            <a href={debugUrl} className="link small" style={{ wordBreak: "break-all" }}>
                              Open reset link directly
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {backMode === "register" ? (
                    <>
                      <div className="auth-field-group">
                        <label htmlFor="reg-username" className="auth-field-label">
                          Username <span className="req-star">*</span>
                        </label>
                        <div className={`auth-input-wrapper ${regFieldErrors.username ? "has-error" : ""}`}>
                          <span className="auth-input-icon" aria-hidden="true">👤</span>
                          <input
                            id="reg-username"
                            value={regUsername}
                            onChange={handleRegUsernameChange}
                            onBlur={handleRegUsernameBlur}
                            autoComplete="username"
                            required
                            placeholder="Pick a unique username"
                            disabled={!isFlipped}
                            tabIndex={!isFlipped ? -1 : 0}
                            className="auth-input-control"
                          />
                        </div>
                        <FieldError error={regFieldErrors.username} id="reg-username-err" />
                      </div>

                      <div className="auth-field-group">
                        <label htmlFor="reg-email" className="auth-field-label">
                          Work Email <span className="muted small">(optional)</span>
                        </label>
                        <div className={`auth-input-wrapper ${regFieldErrors.email ? "has-error" : ""}`}>
                          <span className="auth-input-icon" aria-hidden="true">✉️</span>
                          <input
                            id="reg-email"
                            type="email"
                            value={regEmail}
                            onChange={handleRegEmailChange}
                            onBlur={handleRegEmailBlur}
                            autoComplete="email"
                            placeholder="you@company.com"
                            disabled={!isFlipped}
                            tabIndex={!isFlipped ? -1 : 0}
                            className="auth-input-control"
                          />
                        </div>
                        <FieldError error={regFieldErrors.email} id="reg-email-err" />
                      </div>

                      <div className="auth-field-group">
                        <label htmlFor="reg-password" className="auth-field-label">
                          Password <span className="req-star">*</span>
                        </label>
                        <div className={`auth-input-wrapper ${regFieldErrors.password ? "has-error" : ""}`}>
                          <span className="auth-input-icon" aria-hidden="true">🔒</span>
                          <input
                            id="reg-password"
                            type={showRegPassword ? "text" : "password"}
                            value={regPassword}
                            onChange={handleRegPasswordChange}
                            onBlur={handleRegPasswordBlur}
                            autoComplete="new-password"
                            required
                            placeholder="At least 6 characters"
                            disabled={!isFlipped}
                            tabIndex={!isFlipped ? -1 : 0}
                            className="auth-input-control"
                          />
                          <button
                            type="button"
                            className="auth-password-toggle"
                            onClick={() => setShowRegPassword((prev) => !prev)}
                            disabled={!isFlipped}
                            tabIndex={!isFlipped ? -1 : 0}
                            aria-label={showRegPassword ? "Hide password" : "Show password"}
                          >
                            <PasswordToggleIcon visible={showRegPassword} />
                          </button>
                        </div>
                        <FieldError error={regFieldErrors.password} id="reg-password-err" />
                      </div>

                      <button
                        type="submit"
                        className="auth-btn-primary"
                        disabled={backBusy || !isFlipped}
                        tabIndex={!isFlipped ? -1 : 0}
                      >
                        <span>{backBusy ? "Creating Account..." : "Register Now"}</span>
                        {!backBusy && <span className="auth-btn-arrow" aria-hidden="true">→</span>}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="auth-field-group">
                        <label htmlFor="forgot-username" className="auth-field-label">
                          Username or Email <span className="req-star">*</span>
                        </label>
                        <div className={`auth-input-wrapper ${forgotError ? "has-error" : ""}`}>
                          <span className="auth-input-icon" aria-hidden="true">✉️</span>
                          <input
                            id="forgot-username"
                            value={forgotUsername}
                            onChange={handleForgotUsernameChange}
                            autoComplete="username"
                            required
                            placeholder="Enter username or registered email"
                            disabled={!isFlipped}
                            tabIndex={!isFlipped ? -1 : 0}
                            className="auth-input-control"
                          />
                        </div>
                        <FieldError error={forgotError} id="forgot-username-err" />
                      </div>

                      <button
                        type="submit"
                        className="auth-btn-primary"
                        disabled={backBusy || !isFlipped}
                        tabIndex={!isFlipped ? -1 : 0}
                      >
                        <span>{backBusy ? "Sending link..." : "Send Reset Link"}</span>
                        {!backBusy && <span className="auth-btn-arrow" aria-hidden="true">→</span>}
                      </button>
                    </>
                  )}

                  <div className="auth-create-account-wrap">
                    <button
                      type="button"
                      className="flip-toggle-btn"
                      disabled={!isFlipped}
                      tabIndex={!isFlipped ? -1 : 0}
                      onClick={flipToLogin}
                    >
                      <span className="flip-icon" aria-hidden="true">←</span>
                      <span>Back to Sign In</span>
                    </button>
                  </div>
                </div>

                <div className="auth-card-bottom-footer">
                  <div className="auth-status-indicator-line">
                    <span className="dot-pulse" aria-hidden="true" />
                    <span>System secure</span>
                    <span className="sep">•</span>
                    <span>256-bit SSL</span>
                  </div>
                </div>
              </form>

            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// =========================================================================
// Clean Vector SVG Icons
// =========================================================================

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function CheckMarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ClockScanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 15 15" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function LockKeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function MicrosoftLogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function PasswordToggleIcon({ visible }) {
  if (visible) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
