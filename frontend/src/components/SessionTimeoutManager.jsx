import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";

const STORAGE_LAST_ACTIVE_KEY = "session_last_active";
const STORAGE_TIMEOUT_KEY = "portal_session_timeout";
const DEFAULT_TIMEOUT_MINUTES = 15;
const DEFAULT_WARNING_SECONDS = 60;

export default function SessionTimeoutManager() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [timeoutMinutes, setTimeoutMinutes] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_TIMEOUT_KEY);
      const parsed = parseInt(stored, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MINUTES;
    } catch {
      return DEFAULT_TIMEOUT_MINUTES;
    }
  });

  const [warningSeconds, setWarningSeconds] = useState(DEFAULT_WARNING_SECONDS);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_TIMEOUT_MINUTES * 60);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const lastActiveRef = useRef(Date.now());
  const throttleTimerRef = useRef(0);

  // Sync initial configuration from server
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    api
      .getSessionConfig()
      .then((cfg) => {
        if (!mounted || !cfg) return;
        const mins = Number(cfg.timeout_minutes) || DEFAULT_TIMEOUT_MINUTES;
        setTimeoutMinutes(mins);
        setWarningSeconds(Number(cfg.warning_seconds) || DEFAULT_WARNING_SECONDS);
        try {
          localStorage.setItem(STORAGE_TIMEOUT_KEY, String(mins));
        } catch {}
      })
      .catch(() => {
        // Fallback to current state / default
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  // Record user activity across all devices (Desktop web, touch screens, mobile)
  const recordActivity = useCallback(() => {
    const now = Date.now();
    // Throttle localStorage writes to at most once every 2 seconds
    if (now - throttleTimerRef.current > 2000) {
      throttleTimerRef.current = now;
      lastActiveRef.current = now;
      try {
        localStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(now));
      } catch {}
    } else {
      lastActiveRef.current = now;
    }
  }, []);

  // Listen for storage events (cross-tab synchronization) and custom policy events
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_LAST_ACTIVE_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10);
        if (Number.isFinite(remoteTime) && remoteTime > lastActiveRef.current) {
          lastActiveRef.current = remoteTime;
          setShowWarningModal(false);
        }
      } else if (e.key === STORAGE_TIMEOUT_KEY && e.newValue) {
        const remoteMins = parseInt(e.newValue, 10);
        if (Number.isFinite(remoteMins) && remoteMins > 0) {
          setTimeoutMinutes(remoteMins);
        }
      }
    };

    const handlePolicyUpdate = (e) => {
      if (e.detail?.timeout_minutes) {
        const newMins = Number(e.detail.timeout_minutes);
        setTimeoutMinutes(newMins);
        lastActiveRef.current = Date.now();
        setShowWarningModal(false);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("session-timeout-policy-updated", handlePolicyUpdate);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("session-timeout-policy-updated", handlePolicyUpdate);
    };
  }, []);

  // Set initial lastActive on mount or login
  useEffect(() => {
    if (!user) return;
    const now = Date.now();
    lastActiveRef.current = now;
    try {
      localStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(now));
    } catch {}
  }, [user]);

  // Main countdown ticker and inactivity detector
  useEffect(() => {
    if (!user) {
      setShowWarningModal(false);
      return;
    }

    const checkInterval = setInterval(() => {
      // Check stored timestamp in case another tab recorded activity
      let effectiveLastActive = lastActiveRef.current;
      try {
        const stored = localStorage.getItem(STORAGE_LAST_ACTIVE_KEY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (Number.isFinite(parsed) && parsed > effectiveLastActive) {
            effectiveLastActive = parsed;
            lastActiveRef.current = parsed;
          }
        }
      } catch {}

      const now = Date.now();
      const elapsedSeconds = Math.floor((now - effectiveLastActive) / 1000);
      const totalAllowedSeconds = timeoutMinutes * 60;
      const remaining = totalAllowedSeconds - elapsedSeconds;

      setRemainingSeconds(remaining > 0 ? remaining : 0);

      if (remaining <= 0) {
        // Session expired: force logout immediately
        clearInterval(checkInterval);
        setShowWarningModal(false);
        try {
          localStorage.removeItem(STORAGE_LAST_ACTIVE_KEY);
        } catch {}
        logout();
        navigate(`/login?reason=timeout&minutes=${timeoutMinutes}`, { replace: true });
      } else if (remaining <= warningSeconds) {
        setShowWarningModal(true);
      } else if (showWarningModal) {
        setShowWarningModal(false);
      }
    }, 1000);

    return () => {
      clearInterval(checkInterval);
    };
  }, [user, timeoutMinutes, warningSeconds, showWarningModal, logout, navigate]);

  // Instant mobile/visibility check: When app is restored from phone lock or background tab
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        let effectiveLastActive = lastActiveRef.current;
        try {
          const stored = localStorage.getItem(STORAGE_LAST_ACTIVE_KEY);
          if (stored) {
            const parsed = parseInt(stored, 10);
            if (Number.isFinite(parsed)) effectiveLastActive = parsed;
          }
        } catch {}

        const elapsedSeconds = Math.floor((Date.now() - effectiveLastActive) / 1000);
        if (elapsedSeconds >= timeoutMinutes * 60) {
          logout();
          navigate(`/login?reason=timeout&minutes=${timeoutMinutes}`, { replace: true });
        } else {
          recordActivity();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [user, timeoutMinutes, logout, navigate, recordActivity]);

  // Bind activity listeners across Desktop & Mobile touch devices
  useEffect(() => {
    if (!user) return;

    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "touchstart",
      "touchmove",
      "touchend",
      "scroll",
      "wheel",
      "click",
    ];

    const onUserAction = () => {
      if (!showWarningModal) {
        recordActivity();
      }
    };

    events.forEach((evt) => {
      window.addEventListener(evt, onUserAction, { passive: true });
    });

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, onUserAction);
      });
    };
  }, [user, showWarningModal, recordActivity]);

  // Handler: "Stay Signed In" button in modal
  const handleStaySignedIn = async () => {
    setRefreshing(true);
    const now = Date.now();
    lastActiveRef.current = now;
    try {
      localStorage.setItem(STORAGE_LAST_ACTIVE_KEY, String(now));
    } catch {}

    try {
      await api.refreshSession();
    } catch (err) {
      console.warn("Session refresh ping:", err);
    } finally {
      setRefreshing(false);
      setShowWarningModal(false);
      setRemainingSeconds(timeoutMinutes * 60);
    }
  };

  // Handler: "Log Out Now"
  const handleManualLogout = () => {
    setShowWarningModal(false);
    logout();
    navigate("/login", { replace: true });
  };

  if (!user || !showWarningModal) return null;

  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / warningSeconds) * 100));

  return (
    <div
      className="session-timeout-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-desc"
    >
      <div className="session-timeout-card">
        <div className="session-timeout-header">
          <div className="session-timeout-icon-pulse" aria-hidden="true">
            ⏳
          </div>
          <div>
            <h3 id="session-timeout-title" className="session-timeout-title">
              Session Timeout Warning
            </h3>
            <span className="session-timeout-sub">Automatic Security Logout</span>
          </div>
        </div>

        <div className="session-timeout-body">
          <p id="session-timeout-desc" className="session-timeout-message">
            You have been inactive. For your account security, you will be automatically signed out in:
          </p>

          <div className="session-countdown-display">
            <span className="session-countdown-number">{remainingSeconds}</span>
            <span className="session-countdown-label">seconds remaining</span>
          </div>

          <div className="session-progress-bar-wrap" aria-hidden="true">
            <div
              className={`session-progress-bar-fill ${remainingSeconds <= 15 ? "urgent" : ""}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="session-timeout-note">
            Role: <strong>{user.role}</strong> &bull; Configured Session Limit: <strong>{timeoutMinutes} minutes</strong>
          </p>
        </div>

        <div className="session-timeout-actions">
          <button
            type="button"
            className="btn secondary"
            onClick={handleManualLogout}
            disabled={refreshing}
          >
            Sign Out Now
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleStaySignedIn}
            disabled={refreshing}
            autoFocus
          >
            {refreshing ? "Extending..." : "Stay Signed In"}
          </button>
        </div>
      </div>
    </div>
  );
}

