import { useState, useEffect } from "react";

/**
 * OfflineIndicator Component
 * Alerts users when connection drops, indicates when working on cached data,
 * and notifies when an updated Service Worker version is available.
 */
export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(() => {
    return typeof window !== "undefined" && typeof navigator !== "undefined"
      ? !navigator.onLine
      : false;
  });

  const [showReconnected, setShowReconnected] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateHandler, setUpdateHandler] = useState(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    const handleSwUpdate = (e) => {
      if (e.detail && e.detail.update) {
        setUpdateAvailable(true);
        setUpdateHandler(() => e.detail.update);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("ems:sw-update-available", handleSwUpdate);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("ems:sw-update-available", handleSwUpdate);
    };
  }, []);

  const handleUpdateClick = () => {
    if (updateHandler) {
      updateHandler();
    } else {
      window.location.reload();
    }
  };

  if (!isOffline && !showReconnected && !updateAvailable) {
    return null;
  }

  return (
    <div
      className="pwa-toast-container"
      role="region"
      aria-label="Network and Application Status"
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        alignItems: "center",
        maxWidth: "92vw",
        pointerEvents: "none",
      }}
    >
      {/* 1. Offline Mode Toast */}
      {isOffline && (
        <div
          className="pwa-toast offline"
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 18px",
            borderRadius: "50px",
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95))",
            color: "#ffffff",
            boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(8px)",
            fontWeight: 500,
            fontSize: "0.88rem",
            animation: "fadeInSlideUp 0.3s ease-out",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>📡</span>
          <span>
            <strong>Offline Mode</strong> — Viewing cached employee records & attendance
          </span>
          <button
            onClick={() => window.location.reload()}
            title="Attempt to reconnect"
            style={{
              background: "rgba(255, 255, 255, 0.25)",
              border: "none",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              marginLeft: "4px",
              transition: "background 0.2s",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Reconnected Notice */}
      {showReconnected && !isOffline && (
        <div
          className="pwa-toast online"
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 18px",
            borderRadius: "50px",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))",
            color: "#ffffff",
            boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(8px)",
            fontWeight: 500,
            fontSize: "0.88rem",
            animation: "fadeInSlideUp 0.3s ease-out",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>⚡</span>
          <span>
            <strong>Back Online</strong> — Real-time synchronization active
          </span>
          <button
            onClick={() => setShowReconnected(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "1rem",
              padding: "0 4px",
              opacity: 0.8,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Service Worker Update Banner */}
      {updateAvailable && (
        <div
          className="pwa-toast update"
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 18px",
            borderRadius: "50px",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.95), rgba(79, 70, 229, 0.95))",
            color: "#ffffff",
            boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(8px)",
            fontWeight: 500,
            fontSize: "0.88rem",
            animation: "fadeInSlideUp 0.3s ease-out",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>🚀</span>
          <span>A new version of StaffPortal is available.</span>
          <button
            onClick={handleUpdateClick}
            style={{
              background: "#ffffff",
              border: "none",
              color: "#4338ca",
              padding: "5px 12px",
              borderRadius: "20px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
            }}
          >
            Update Now
          </button>
          <button
            onClick={() => setUpdateAvailable(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "1rem",
              opacity: 0.7,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

