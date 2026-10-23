import { useState, useEffect } from "react";
import { api } from "../api";

const PRESET_MINUTES = [5, 10, 15, 30, 45, 60, 120];

export default function SessionTimeoutModal({ onClose, onSaved }) {
  const [minutes, setMinutes] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .getSessionConfig()
      .then((cfg) => {
        if (!mounted || !cfg) return;
        setMinutes(Number(cfg.timeout_minutes) || 15);
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Failed to load current session config.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const val = Number(minutes);
    if (!Number.isFinite(val) || val < 1 || val > 1440) {
      setError("Please specify a timeout between 1 and 1440 minutes.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.updateSessionConfig(val);
      const updatedMins = res.timeout_minutes;
      try {
        localStorage.setItem("portal_session_timeout", String(updatedMins));
        localStorage.setItem("session_last_active", String(Date.now()));
      } catch {}

      // Broadcast update to all active components and browser tabs
      window.dispatchEvent(
        new CustomEvent("session-timeout-policy-updated", {
          detail: { timeout_minutes: updatedMins },
        })
      );

      setSuccess(`Session timeout successfully updated to ${updatedMins} minutes!`);
      if (onSaved) onSaved(updatedMins);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || "Failed to update session timeout.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-card session-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "520px" }}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.4rem" }} aria-hidden="true">⏱️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Session Timeout Management</h3>
              <span className="muted small">Universal web & mobile inactivity security</span>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {error && <div className="alert error">{error}</div>}
            {success && <div className="alert success">{success}</div>}

            <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Configure how long any user (<strong>Admin</strong>, <strong>Manager</strong>, or <strong>User</strong>)
              can remain idle on desktop or mobile before being automatically logged out.
            </p>

            <div className="session-preset-group">
              <label className="form-label" style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
                Quick Presets:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {PRESET_MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn ${Number(minutes) === m ? "primary" : "ghost"}`}
                    style={{ padding: "6px 12px", fontSize: "0.85rem", borderRadius: "8px" }}
                    onClick={() => {
                      setMinutes(m);
                      setError("");
                    }}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="session-timeout-input" className="form-label" style={{ fontWeight: 600 }}>
                Custom Duration (Minutes):
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                <input
                  id="session-timeout-input"
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  required
                  className="filter-input"
                  style={{ width: "140px", fontSize: "1rem", padding: "8px 12px" }}
                  value={minutes}
                  onChange={(e) => {
                    setMinutes(e.target.value);
                    setError("");
                  }}
                  disabled={loading || saving}
                />
                <span className="muted small">minutes ({Number(minutes) > 60 ? `${(Number(minutes) / 60).toFixed(1)} hrs` : `${minutes} min`})</span>
              </div>
            </div>

            <div
              style={{
                background: "var(--surface-alt, #1e293b)",
                border: "1px solid var(--border, #334155)",
                borderRadius: "8px",
                padding: "12px",
                fontSize: "0.82rem",
                color: "var(--muted, #94a3b8)",
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, color: "var(--text, #f8fafc)", marginBottom: "4px" }}>
                <span>🛡️</span> Security Enforcement Rules:
              </div>
              <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                <li>A prominent <strong>60-second warning dialog</strong> appears before logout.</li>
                <li>User activity (mouse, keystrokes, touches, scrolls) keeps the session alive.</li>
                <li>On mobile phones, returning from lock screen/background past the limit triggers instant logout.</li>
                <li>Applies universally across all authenticated roles.</li>
              </ul>
            </div>
          </div>

          <div className="modal-actions" style={{ padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={loading || saving}>
              {saving ? "Saving Policy..." : "Save Session Policy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

