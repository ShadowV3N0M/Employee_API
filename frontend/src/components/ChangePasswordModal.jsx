import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import FieldError from "./FieldError";
import { validatePassword, validateConfirmPassword } from "../validation";

export default function ChangePasswordModal({ onClose, onSuccess }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (error) setError("");
  };

  const handleOldPasswordChange = (e) => {
    setOldPassword(e.target.value);
    clearFieldError("oldPassword");
  };

  const handleOldPasswordBlur = () => {
    if (!oldPassword) {
      setFieldErrors((prev) => ({ ...prev, oldPassword: "Current Password is required." }));
    }
  };

  const handleNewPasswordChange = (e) => {
    setNewPassword(e.target.value);
    clearFieldError("newPassword");
    if (confirmPassword && fieldErrors.confirmPassword) {
      clearFieldError("confirmPassword");
    }
  };

  const handleNewPasswordBlur = () => {
    const err = validatePassword(newPassword, 6);
    let finalErr = err;
    if (!finalErr && oldPassword && newPassword === oldPassword) {
      finalErr = "New password must be different from your current password....";
    }
    setFieldErrors((prev) => ({ ...prev, newPassword: finalErr }));
  };

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value);
    clearFieldError("confirmPassword");
  };

  const handleConfirmPasswordBlur = () => {
    const err = validateConfirmPassword(confirmPassword, newPassword);
    setFieldErrors((prev) => ({ ...prev, confirmPassword: err }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const errors = {};
    if (!oldPassword) {
      errors.oldPassword = "Current Password is required......";
    }
    const newPassErr = validatePassword(newPassword, 6);
    if (newPassErr) {
      errors.newPassword = newPassErr;
    } else if (oldPassword && newPassword === oldPassword) {
      errors.newPassword = "New Password must be different from your current password.....";
    }

    const confirmErr = validateConfirmPassword(confirmPassword, newPassword);
    if (confirmErr) {
      errors.confirmPassword = confirmErr;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstKey = Object.keys(errors)[0];
      const el = document.getElementById(`field-${firstKey}`);
      if (el) el.focus();
      return;
    }

    setBusy(true);
    try {
      const res = await api.changePassword(oldPassword, newPassword);
      setSuccess(res.message || "Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFieldErrors({});
      if (onSuccess) onSuccess("Password changed successfully!");
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setError(err.message || "Failed to change password. Is your old password correct? Please enter your current password correctly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Change Account Password" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "8px 0" }} noValidate>
        {error && <div className="alert error" role="alert">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <label>
          <span>Current Password <span className="required-asterisk">*</span></span>
          <input
            id="field-oldPassword"
            type="password"
            value={oldPassword}
            onChange={handleOldPasswordChange}
            onBlur={handleOldPasswordBlur}
            placeholder="Enter current password"
            autoComplete="current-password"
            required
            autoFocus
            className={fieldErrors.oldPassword ? "input-error" : ""}
            aria-invalid={Boolean(fieldErrors.oldPassword)}
            aria-describedby={fieldErrors.oldPassword ? "field-oldPassword-error" : undefined}
          />
          <FieldError error={fieldErrors.oldPassword} id="field-oldPassword-error" />
        </label>

        <label>
          <span>New Password (min 6 characters) <span className="required-asterisk">*</span></span>
          <input
            id="field-newPassword"
            type="password"
            value={newPassword}
            onChange={handleNewPasswordChange}
            onBlur={handleNewPasswordBlur}
            placeholder="Enter new password"
            autoComplete="new-password"
            required
            minLength={6}
            className={fieldErrors.newPassword ? "input-error" : ""}
            aria-invalid={Boolean(fieldErrors.newPassword)}
            aria-describedby={fieldErrors.newPassword ? "field-newPassword-error" : undefined}
          />
          <FieldError error={fieldErrors.newPassword} id="field-newPassword-error" />
        </label>

        <label>
          <span>Confirm New Password <span className="required-asterisk">*</span></span>
          <input
            id="field-confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            onBlur={handleConfirmPasswordBlur}
            placeholder="Repeat new password"
            autoComplete="new-password"
            required
            minLength={6}
            className={fieldErrors.confirmPassword ? "input-error" : ""}
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={fieldErrors.confirmPassword ? "field-confirmPassword-error" : undefined}
          />
          <FieldError error={fieldErrors.confirmPassword} id="field-confirmPassword-error" />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Updating…" : "Update Password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
