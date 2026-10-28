import { useState, useEffect } from "react";
import { useAuth } from "../auth";

export default function SessionIdleBadge() {
  const { user } = useAuth();
  const [remaining, setRemaining] = useState(null);
  const [total, setTotal] = useState(15 * 60);
  const [extendedNotice, setExtendedNotice] = useState(false);

  useEffect(() => {
    if (!user) {
      setRemaining(null);
      return;
    }

    const handleTick = (e) => {
      if (e.detail) {
        setRemaining(e.detail.remaining);
        if (e.detail.total) setTotal(e.detail.total);
      }
    };

    window.addEventListener("session-timer-tick", handleTick);
    return () => {
      window.removeEventListener("session-timer-tick", handleTick);
    };
  }, [user]);

  if (!user || remaining === null) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const formattedTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const isUrgent = remaining <= 60;

  const handleQuickExtend = (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("session-extend-request"));
    setExtendedNotice(true);
    setTimeout(() => setExtendedNotice(false), 2000);
  };

  return (
    <button
      type="button"
      className={`session-idle-pill ${isUrgent ? "urgent" : ""}`}
      onClick={handleQuickExtend}
      title="Inactivity idle countdown — Click to extend session immediately"
      aria-label={`Session idle timer: ${formattedTime} remaining. Click to extend session.`}
    >
      <span className="session-idle-icon" aria-hidden="true">
        {extendedNotice ? "✓" : isUrgent ? "⚠️" : "⏳"}
      </span>
      <span className="session-idle-text">
        {extendedNotice ? "Extended" : formattedTime}
      </span>
    </button>
  );
}

