import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import ThemeToggle from "../components/ThemeToggle";

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  // Flip State: false = Front (Sign in), true = Back (Register or Forgot Password)
  const [isFlipped, setIsFlipped] = useState(false);
  const [backMode, setBackMode] = useState("register"); // "register" | "forgot"

  // Front Form State (Login)
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // Back Form State (Register / Forgot Password)
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [forgotUsername, setForgotUsername] = useState("");
  const [backError, setBackError] = useState("");
  const [backNotice, setBackNotice] = useState("");
  const [debugUrl, setDebugUrl] = useState("");
  const [backBusy, setBackBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError("");
    setLoginBusy(true);

    try {
      const { access_token } = await api.login(loginUsername, loginPassword);
      await signIn(access_token);
      navigate("/", { replace: true });
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleBackSubmit(e) {
    e.preventDefault();
    setBackError("");
    setBackNotice("");
    setDebugUrl("");
    setBackBusy(true);

    try {
      if (backMode === "forgot") {
        const res = await api.forgotPassword(forgotUsername);
        setBackNotice(res.message);
        if (res.debug_url) {
          setDebugUrl(res.debug_url);
        }
      } else {
        const { access_token } = await api.register(regUsername, regPassword, regEmail);
        await signIn(access_token);
        navigate("/", { replace: true });
      }
    } catch (err) {
      setBackError(err.message);
    } finally {
      setBackBusy(false);
    }
  }

  function flipToRegister() {
    setBackMode("register");
    setBackError("");
    setBackNotice("");
    setDebugUrl("");
    if (loginUsername && !regUsername) {
      setRegUsername(loginUsername);
    }
    setIsFlipped(true);
  }

  function flipToForgot() {
    setBackMode("forgot");
    setBackError("");
    setBackNotice("");
    setDebugUrl("");
    if (loginUsername && !forgotUsername) {
      setForgotUsername(loginUsername);
    }
    setIsFlipped(true);
  }

  function flipToLogin() {
    setLoginError("");
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
          >
            <div className="auth-card-content">
              <div>
                <h1>Employee Management</h1>
                <p className="muted">Sign in to continue</p>
              </div>

              {loginError && <div className="alert error">{loginError}</div>}

              <label>
                Username
                <input
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  autoComplete="username"
                  required
                  disabled={isFlipped}
                  tabIndex={isFlipped ? -1 : 0}
                  autoFocus={!isFlipped}
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={isFlipped}
                  tabIndex={isFlipped ? -1 : 0}
                />
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
          >
            <div className="auth-card-content">
              <div>
                <h1>Employee Management</h1>
                <p className="muted">
                  {backMode === "register" ? "Create your account" : "Reset your password"}
                </p>
              </div>

              {backError && <div className="alert error">{backError}</div>}
              {backNotice && <div className="alert success">{backNotice}</div>}
              {debugUrl && (
                <div className="alert info" style={{ wordBreak: "break-all" }}>
                  <strong>Dev Reset Link:</strong><br />
                  <a href={debugUrl}>{debugUrl}</a>
                </div>
              )}

              {backMode === "register" ? (
                <>
                  <label>
                    Username
                    <input
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      autoComplete="username"
                      required
                      disabled={!isFlipped}
                      tabIndex={!isFlipped ? -1 : 0}
                    />
                  </label>

                  <label>
                    Email (optional)
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="user@example.com"
                      disabled={!isFlipped}
                      tabIndex={!isFlipped ? -1 : 0}
                    />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      disabled={!isFlipped}
                      tabIndex={!isFlipped ? -1 : 0}
                    />
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
                    Username or Email
                    <input
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      autoComplete="username"
                      required
                      disabled={!isFlipped}
                      tabIndex={!isFlipped ? -1 : 0}
                    />
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
