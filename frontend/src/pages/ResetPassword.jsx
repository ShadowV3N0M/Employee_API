import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import FieldError from "../components/FieldError";
import { validatePassword, validateConfirmPassword } from "../validation";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
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

  const handleNewPasswordChange = (e) => {
    setNewPassword(e.target.value);
    if (fieldErrors.newPassword) {
      setFieldErrors((prev) => ({ ...prev, newPassword: "" }));
    }
    if (confirmPassword && fieldErrors.confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
    }
    if (error) setError("");
  };

  const handleNewPasswordBlur = () => {
    const err = validatePassword(newPassword, 6);
    setFieldErrors((prev) => ({ ...prev, newPassword: err }));
  };

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value);
    if (fieldErrors.confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
    }
    if (error) setError("");
  };

  const handleConfirmPasswordBlur = () => {
    const err = validateConfirmPassword(confirmPassword, newPassword);
    setFieldErrors((prev) => ({ ...prev, confirmPassword: err }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const errors = {
      newPassword: validatePassword(newPassword, 6),
      confirmPassword: validateConfirmPassword(confirmPassword, newPassword),
    };

    const activeErrors = {};
    if (errors.newPassword) activeErrors.newPassword = errors.newPassword;
    if (errors.confirmPassword) activeErrors.confirmPassword = errors.confirmPassword;

    if (Object.keys(activeErrors).length > 0) {
      setFieldErrors(activeErrors);
      const firstId = activeErrors.newPassword ? "reset-new-password" : "reset-confirm-password";
      const el = document.getElementById(firstId);
      if (el) el.focus();
      return;
    }

    setBusy(true);
    try {
      const res = await api.resetPassword(token, newPassword);
      setSuccess(res.message || "Password reset successfully!");
    } catch (err) {
      setError(err.message || "Failed to reset password.");
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
      <form className="card login-card" onSubmit={handleSubmit} noValidate>
        <h1>Set New Password</h1>
        {username && <p className="muted">Resetting password for <strong>{username}</strong></p>}

        {error && <div className="alert error" role="alert">{error}</div>}
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
              <span>New Password <span className="required-asterisk">*</span></span>
              <input
                id="reset-new-password"
                type="password"
                value={newPassword}
                onChange={handleNewPasswordChange}
                onBlur={handleNewPasswordBlur}
                autoComplete="new-password"
                required
                minLength={6}
                autoFocus
                className={fieldErrors.newPassword ? "input-error" : ""}
                aria-invalid={Boolean(fieldErrors.newPassword)}
                aria-describedby={fieldErrors.newPassword ? "reset-new-password-error" : undefined}
              />
              <FieldError error={fieldErrors.newPassword} id="reset-new-password-error" />
            </label>

            <label>
              <span>Confirm New Password <span className="required-asterisk">*</span></span>
              <input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                onBlur={handleConfirmPasswordBlur}
                autoComplete="new-password"
                required
                minLength={6}
                className={fieldErrors.confirmPassword ? "input-error" : ""}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={fieldErrors.confirmPassword ? "reset-confirm-password-error" : undefined}
              />
              <FieldError error={fieldErrors.confirmPassword} id="reset-confirm-password-error" />
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
