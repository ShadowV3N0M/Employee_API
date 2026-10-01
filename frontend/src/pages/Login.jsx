import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [debugUrl, setDebugUrl] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setDebugUrl("");
    setBusy(true);

    try {
      if (mode === "forgot") {
        const res = await api.forgotPassword(username);
        setNotice(res.message);
        if (res.debug_url) {
          setDebugUrl(res.debug_url);
        }
      } else {
        const { access_token } =
          mode === "login"
            ? await api.login(username, password)
            : await api.register(username, password, email);

        await signIn(access_token);
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>Employee Management</h1>
        <p className="muted">
          {mode === "login"
            ? "Sign in to continue"
            : mode === "register"
              ? "Create an account"
              : "Reset your password"}
        </p>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}
        {debugUrl && (
          <div className="alert info" style={{ wordBreak: "break-all" }}>
            <strong>Dev Reset Link:</strong><br />
            <a href={debugUrl}>{debugUrl}</a>
          </div>
        )}

        <label>
          {mode === "forgot" ? "Username or Email" : "Username"}
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </label>

        {mode === "register" && (
          <label>
            Email (optional)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </label>
        )}

        {mode !== "forgot" && (
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>
        )}

        <button className="btn primary block" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Register"
                : "Send Reset Link"}
        </button>

        {mode === "login" && (
          <p className="small right" style={{ marginTop: "8px" }}>
            <button
              type="button"
              className="link"
              onClick={() => {
                setMode("forgot");
                setError("");
                setNotice("");
                setDebugUrl("");
              }}
            >
              Forgot password?
            </button>
          </p>
        )}

        {mode === "register" && (
          <p className="muted small">
            New accounts start as plain users. An admin can promote you to
            manager or admin.
          </p>
        )}

        <p className="muted small center">
          {mode === "login" && (
            <>
              No account yet?{" "}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode("register");
                  setError("");
                  setNotice("");
                }}
              >
                Register
              </button>
            </>
          )}

          {mode === "register" && (
            <>
              Already registered?{" "}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setNotice("");
                }}
              >
                Sign in
              </button>
            </>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              className="link"
              onClick={() => {
                setMode("login");
                setError("");
                setNotice("");
              }}
            >
              ← Back to Sign in
            </button>
          )}
        </p>
      </form>
    </div>
  );
}
