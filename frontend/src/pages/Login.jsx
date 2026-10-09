import { useState } from "react";
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

  // Front Form State (Login)
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [loginError, setLoginError] = useState("");
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
      errors.username = "Username is required.";
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
        setBackNotice(res.message);
        if (res.debug_url) {
          setDebugUrl(res.debug_url);
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
    <div className="login-wrap">
      <div style={{ position: "absolute", top: "20px", right: "20px" }}>
        <ThemeToggle />
      </div>

      <div className="auth-flip-container">
        <div className={`auth-flip-card ${isFlipped ? "is-flipped" : ""}`}>
          
          {/* ==================== FRONT FACE: Sign In ==================== */}
          <form
            className="card auth-card-face auth-card-front"
            onSubmit={handleLoginSubmit}
            aria-hidden={isFlipped}
            noValidate
          >
            <div className="auth-card-content">
              <div>
                <h1>Employee Management</h1>
                <p className="muted">Sign in to continue</p>
              </div>

              {loginError && <div className="alert error" role="alert">{loginError}</div>}

              <label>
                <span>Username <span className="required-asterisk">*</span></span>
                <input
                  id="login-username"
                  value={loginUsername}
                  onChange={handleLoginUsernameChange}
                  autoComplete="username"
                  required
                  disabled={isFlipped}
                  tabIndex={isFlipped ? -1 : 0}
                  autoFocus={!isFlipped}
                  className={loginFieldErrors.username ? "input-error" : ""}
                  aria-invalid={Boolean(loginFieldErrors.username)}
                  aria-describedby={loginFieldErrors.username ? "login-username-error" : undefined}
                />
                <FieldError error={loginFieldErrors.username} id="login-username-error" />
              </label>

              <label>
                <span>Password <span className="required-asterisk">*</span></span>
                <div className="password-input-wrap">
                  <input
                    id="login-password"
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={handleLoginPasswordChange}
                    autoComplete="current-password"
                    required
                    disabled={isFlipped}
                    tabIndex={isFlipped ? -1 : 0}
                    placeholder="Enter your password"
                    className={loginFieldErrors.password ? "input-error" : ""}
                    aria-invalid={Boolean(loginFieldErrors.password)}
                    aria-describedby={loginFieldErrors.password ? "login-password-error" : undefined}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    disabled={isFlipped}
                    tabIndex={isFlipped ? -1 : 0}
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                    title={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    <PasswordToggleIcon visible={showLoginPassword} />
                  </button>
                </div>
                <FieldError error={loginFieldErrors.password} id="login-password-error" />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="link"
                  disabled={isFlipped}
                  tabIndex={isFlipped ? -1 : 0}
                  onClick={flipToForgot}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className="btn primary block"
                disabled={loginBusy || isFlipped}
                tabIndex={isFlipped ? -1 : 0}
              >
                {loginBusy ? "Please wait…" : "Sign in"}
              </button>
            </div>

            <div className="auth-card-footer">
              <p className="muted small">
                No account yet?{" "}
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
              </p>
            </div>
          </form>

          {/* ==================== BACK FACE: Register / Forgot Password ==================== */}
          <form
            className="card auth-card-face auth-card-back"
            onSubmit={handleBackSubmit}
            aria-hidden={!isFlipped}
            noValidate
          >
            <div className="auth-card-content">
              <div>
                <h1>Employee Management</h1>
                <p className="muted">
                  {backMode === "register" ? "Create your account" : "Reset your password"}
                </p>
              </div>

              {backError && <div className="alert error" role="alert">{backError}</div>}
              {backNotice && (
                <div className="alert success">
                  {backNotice}
                  {debugUrl && (
                    <div style={{ marginTop: "8px", fontSize: "0.82rem" }}>
                      <strong>Demo link: </strong>
                      <a href={debugUrl} style={{ wordBreak: "break-all" }}>
                        Click to reset password
                      </a>
                    </div>
                  )}
                </div>
              )}

              {backMode === "register" ? (
                <>
                  <label>
                    <span>Username <span className="required-asterisk">*</span></span>
                    <input
                      id="reg-username"
                      value={regUsername}
                      onChange={handleRegUsernameChange}
                      onBlur={handleRegUsernameBlur}
                      autoComplete="username"
                      required
                      minLength={3}
                      placeholder="Choose a username"
                      disabled={!isFlipped}
                      tabIndex={!isFlipped ? -1 : 0}
                      className={regFieldErrors.username ? "input-error" : ""}
                      aria-invalid={Boolean(regFieldErrors.username)}
                      aria-describedby={regFieldErrors.username ? "reg-username-error" : undefined}
                    />
                    <FieldError error={regFieldErrors.username} id="reg-username-error" />
                  </label>

                  <label>
                    <span>Email (optional)</span>
                    <input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      onChange={handleRegEmailChange}
                      onBlur={handleRegEmailBlur}
                      placeholder="user@example.com"
                      disabled={!isFlipped}
                      tabIndex={!isFlipped ? -1 : 0}
                      className={regFieldErrors.email ? "input-error" : ""}
                      aria-invalid={Boolean(regFieldErrors.email)}
                      aria-describedby={regFieldErrors.email ? "reg-email-error" : undefined}
                    />
                    <FieldError error={regFieldErrors.email} id="reg-email-error" />
                  </label>

                  <label>
                    <span>Password <span className="required-asterisk">*</span></span>
                    <div className="password-input-wrap">
                      <input
                        id="reg-password"
                        type={showRegPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={handleRegPasswordChange}
                        onBlur={handleRegPasswordBlur}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        disabled={!isFlipped}
                        tabIndex={!isFlipped ? -1 : 0}
                        placeholder="Choose a password (min 6 chars)"
                        className={regFieldErrors.password ? "input-error" : ""}
                        aria-invalid={Boolean(regFieldErrors.password)}
                        aria-describedby={regFieldErrors.password ? "reg-password-error" : undefined}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowRegPassword((prev) => !prev)}
                        disabled={!isFlipped}
                        tabIndex={!isFlipped ? -1 : 0}
                        aria-label={showRegPassword ? "Hide password" : "Show password"}
                        title={showRegPassword ? "Hide password" : "Show password"}
                      >
                        <PasswordToggleIcon visible={showRegPassword} />
                      </button>
                    </div>
                    <FieldError error={regFieldErrors.password} id="reg-password-error" />
                  </label>

                  <button
                    type="submit"
                    className="btn primary block"
                    disabled={backBusy || !isFlipped}
                    tabIndex={!isFlipped ? -1 : 0}
                  >
                    {backBusy ? "Please wait…" : "Register"}
                  </button>

                  <p className="muted small">
                    New accounts start as plain users. An admin can promote you to manager or admin.
                  </p>
                </>
              ) : (
                <>
                  <label>
                    <span>Username or Email <span className="required-asterisk">*</span></span>
                    <input
                      id="forgot-username"
                      value={forgotUsername}
                      onChange={handleForgotUsernameChange}
                      autoComplete="username"
                      required
                      placeholder="Enter username or email address"
                      disabled={!isFlipped}
                      tabIndex={!isFlipped ? -1 : 0}
                      className={forgotError ? "input-error" : ""}
                      aria-invalid={Boolean(forgotError)}
                      aria-describedby={forgotError ? "forgot-username-error" : undefined}
                    />
                    <FieldError error={forgotError} id="forgot-username-error" />
                  </label>

                  <button
                    type="submit"
                    className="btn primary block"
                    disabled={backBusy || !isFlipped}
                    tabIndex={!isFlipped ? -1 : 0}
                  >
                    {backBusy ? "Please wait…" : "Send Reset Link"}
                  </button>

                  <p className="muted small">
                    Enter your username or registered email address and we'll send password reset instructions.
                  </p>
                </>
              )}
            </div>

            <div className="auth-card-footer">
              <p className="muted small">
                {backMode === "register" ? (
                  <>
                    Already registered?{" "}
                    <button
                      type="button"
                      className="flip-toggle-btn"
                      disabled={!isFlipped}
                      tabIndex={!isFlipped ? -1 : 0}
                      onClick={flipToLogin}
                    >
                      <span>Sign in</span>
                      <span className="flip-icon" aria-hidden="true">↺</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="flip-toggle-btn"
                    disabled={!isFlipped}
                    tabIndex={!isFlipped ? -1 : 0}
                    onClick={flipToLogin}
                  >
                    <span className="flip-icon" aria-hidden="true">←</span>
                    <span>Back to Sign in</span>
                  </button>
                )}
              </p>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}

function PasswordToggleIcon({ visible }) {
  if (visible) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
