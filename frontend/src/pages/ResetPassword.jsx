import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No reset token provided in URL.");
      setValidating(false);
      return;
    }

    api
      .verifyResetToken(token)
      .then((res) => {
        setTokenValid(true);
        if (res.username) setUsername(res.username);
      })
      .catch((err) => {
        setError(err.message || "Invalid or expired reset token.");
      })
      .finally(() => setValidating(false));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await api.resetPassword(token, newPassword);
      setSuccess(res.message || "Password reset successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (validating) {
    return (
      <div className="login-wrap">
        <div className="card login-card center-note">Verifying reset token…</div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>Set New Password</h1>
        {username && <p className="muted">Resetting password for <strong>{username}</strong></p>}

        {error && <div className="alert error">{error}</div>}
        {success && (
          <div className="alert success">
            {success}
            <div style={{ marginTop: "12px" }}>
              <Link to="/login" className="btn primary small">
                Go to Sign in
              </Link>
            </div>
          </div>
        )}

        {!success && tokenValid && (
          <>
            <label>
              New Password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
                autoFocus
              />
            </label>

            <label>
              Confirm New Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </label>

            <button className="btn primary block" disabled={busy}>
              {busy ? "Saving…" : "Update Password"}
            </button>
          </>
        )}

        {(!tokenValid || !success) && (
          <p className="muted small center" style={{ marginTop: "16px" }}>
            <Link to="/login" className="link">
              ← Back to Sign in
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
