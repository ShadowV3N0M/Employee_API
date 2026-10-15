import { useState, useEffect } from "react";

const CONSENT_STORAGE_KEY = "site_privacy_preferences";

export default function PrivacyNotice() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

  // Preference category states
  const [preferences, setPreferences] = useState({
    necessary: true, // Always required for system operation
    functional: true,
    analytics: true,
  });

  // Check consent status safely on mount
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" && window.localStorage
        ? localStorage.getItem(CONSENT_STORAGE_KEY)
        : null;

      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({
          necessary: true,
          functional: Boolean(parsed.functional),
          analytics: Boolean(parsed.analytics),
        });
        setVisible(false);
      } else {
        // First visit or reset: show notice banner after a short delay
        const timer = setTimeout(() => setVisible(true), 400);
        return () => clearTimeout(timer);
      }
    } catch {
      setVisible(false);
    }
  }, []);

  // Listen for global custom event to re-open privacy settings
  useEffect(() => {
    const handleOpen = () => setShowManageModal(true);
    window.addEventListener("open-privacy-preferences", handleOpen);
    window.addEventListener("open-cookie-preferences", handleOpen);
    return () => {
      window.removeEventListener("open-privacy-preferences", handleOpen);
      window.removeEventListener("open-cookie-preferences", handleOpen);
    };
  }, []);

  const saveConsent = (updatedPrefs, statusLabel) => {
    const consentPayload = {
      ...updatedPrefs,
      necessary: true,
      status: statusLabel,
      updated_at: new Date().toISOString(),
    };
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentPayload));
      }
    } catch {
      // Storage blocked or restricted by browser shields
    }
    setPreferences(updatedPrefs);
    setVisible(false);
    setShowManageModal(false);
    setShowDetails(false);

    try {
      window.dispatchEvent(
        new CustomEvent("privacy-consent-updated", { detail: consentPayload })
      );
    } catch {
      // Ignore
    }
  };

  const handleAcceptAll = () => {
    saveConsent({ necessary: true, functional: true, analytics: true }, "all_accepted");
  };

  const handleNecessaryOnly = () => {
    saveConsent({ necessary: true, functional: false, analytics: false }, "necessary_only");
  };

  const handleSaveCustom = () => {
    saveConsent(preferences, "custom_preferences");
  };

  return (
    <>
      {/* 1. Main Bottom Notice Banner */}
      {visible && (
        <aside
          className="privacy-notice-banner"
          role="region"
          aria-label="Privacy & Cookie Preferences Banner"
        >
          <div className="privacy-notice-container">
            <div className="privacy-notice-content">
              <div className="privacy-notice-title-wrap">
                <span className="privacy-notice-icon" aria-hidden="true">🍪</span>
                <h3 className="privacy-notice-title">Cookie & Privacy Preferences</h3>
              </div>
              <p className="privacy-notice-desc">
                We use strictly necessary cookies and local storage tokens to keep you securely signed in,
                enforce HTTPS encrypted sessions, and maintain system integrity. With your permission, we also
                use functional and analytics storage to remember your theme settings and improve portal speed.
              </p>

              {/* Collapsible Category Preferences Accordion */}
              {showDetails && (
                <div className="privacy-categories-list">
                  <div className="privacy-category-card">
                    <div className="privacy-category-header">
                      <div>
                        <strong className="privacy-category-name">Strictly Necessary</strong>
                        <span className="privacy-badge-locked">Always Active</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        aria-label="Strictly necessary cookies (always active)"
                      />
                    </div>
                    <p className="privacy-category-text">
                      Required for basic portal security, CSRF protection, HTTPS session routing, and authentication tokens (<code>emp_token</code>).
                    </p>
                  </div>

                  <div className="privacy-category-card">
                    <div className="privacy-category-header">
                      <div>
                        <strong className="privacy-category-name">Preferences & Functionality</strong>
                        <span className="privacy-badge-optional">Optional</span>
                      </div>
                      <input
                        id="privacy-pref-functional"
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={(e) =>
                          setPreferences((p) => ({ ...p, functional: e.target.checked }))
                        }
                      />
                    </div>
                    <label htmlFor="privacy-pref-functional" className="privacy-category-text">
                      Saves your visual preferences, active dark/light mode choice (<code>emp_theme</code>), and sidebar collapse state across sessions.
                    </label>
                  </div>

                  <div className="privacy-category-card">
                    <div className="privacy-category-header">
                      <div>
                        <strong className="privacy-category-name">Performance & Analytics</strong>
                        <span className="privacy-badge-optional">Optional</span>
                      </div>
                      <input
                        id="privacy-pref-analytics"
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) =>
                          setPreferences((p) => ({ ...p, analytics: e.target.checked }))
                        }
                      />
                    </div>
                    <label htmlFor="privacy-pref-analytics" className="privacy-category-text">
                      Helps measure API response times, detect rendering bottlenecks, and assess overall system reliability.
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="privacy-notice-actions">
              {showDetails ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveCustom}
                  >
                    Save Preferences
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowDetails(false)}
                  >
                    Back
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAcceptAll}
                  >
                    Accept All
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleNecessaryOnly}
                  >
                    Necessary Only
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost privacy-btn-customize"
                    onClick={() => setShowDetails(true)}
                  >
                    Customize
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* 2. Persistent Floating Trigger Button */}
      {!visible && (
        <button
          type="button"
          className="privacy-floating-trigger"
          onClick={() => setShowManageModal(true)}
          title="Cookie & Privacy Settings"
          aria-label="Manage cookie and privacy settings"
        >
          <span className="privacy-trigger-icon" aria-hidden="true">🍪</span>
          <span className="privacy-trigger-text">Cookie Settings</span>
        </button>
      )}

      {/* 3. Manage Preferences Modal Dialog */}
      {showManageModal && (
        <div className="modal-backdrop" onClick={() => setShowManageModal(false)}>
          <div
            className="modal-card privacy-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-modal-title"
          >
            <div className="modal-header">
              <div className="privacy-notice-title-wrap">
                <span className="privacy-notice-icon" aria-hidden="true">🍪</span>
                <h3 id="privacy-modal-title" className="privacy-notice-title">
                  Manage Privacy & Cookie Preferences
                </h3>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowManageModal(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="modal-body privacy-modal-body">
              <p className="privacy-modal-intro">
                You can review or adjust your cookie and storage preferences at any time. Strictly necessary cookies
                cannot be deactivated as they are required for security and core functionality.
              </p>

              <div className="privacy-categories-list">
                <div className="privacy-category-card">
                  <div className="privacy-category-header">
                    <div>
                      <strong className="privacy-category-name">Strictly Necessary</strong>
                      <span className="privacy-badge-locked">Always Active</span>
                    </div>
                    <input type="checkbox" checked={true} disabled aria-label="Strictly necessary" />
                  </div>
                  <p className="privacy-category-text">
                    Core JWT authentication (<code>emp_token</code>), session security, and HTTPS transport routing.
                  </p>
                </div>

                <div className="privacy-category-card">
                  <div className="privacy-category-header">
                    <div>
                      <strong className="privacy-category-name">Preferences & Functionality</strong>
                      <span className="privacy-badge-optional">Optional</span>
                    </div>
                    <input
                      id="modal-privacy-pref-functional"
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) =>
                        setPreferences((p) => ({ ...p, functional: e.target.checked }))
                      }
                    />
                  </div>
                  <label htmlFor="modal-privacy-pref-functional" className="privacy-category-text">
                    Remembers your chosen theme mode (<code>emp_theme</code>) and layout customizations.
                  </label>
                </div>

                <div className="privacy-category-card">
                  <div className="privacy-category-header">
                    <div>
                      <strong className="privacy-category-name">Performance & Analytics</strong>
                      <span className="privacy-badge-optional">Optional</span>
                    </div>
                    <input
                      id="modal-privacy-pref-analytics"
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) =>
                        setPreferences((p) => ({ ...p, analytics: e.target.checked }))
                      }
                    />
                  </div>
                  <label htmlFor="modal-privacy-pref-analytics" className="privacy-category-text">
                    Aggregates anonymous performance telemetry and page load speed measurements.
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-actions privacy-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={handleNecessaryOnly}>
                Reject All Non-Essential
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleAcceptAll}>
                Accept All
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveCustom}>
                Save My Choices
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

