import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal";

export default function ChangePasswordModal({ onClose, onSuccess }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!oldPassword) {
      setError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (oldPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setBusy(true);
    try {
      const res = await api.changePassword(oldPassword, newPassword);
      setSuccess(res.message || "Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (onSuccess) onSuccess("Password changed successfully!");
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setError(err.message || "Failed to change password. Is your old password correct?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Change Account Password" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "8px 0" }}>
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <label>
          Current Password
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Enter current password"
            autoComplete="current-password"
            required
            autoFocus
          />
        </label>

        <label>
          New Password (min 6 characters)
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>

        <label>
          Confirm New Password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
            autoComplete="new-password"
            required
            minLength={6}
          />
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
