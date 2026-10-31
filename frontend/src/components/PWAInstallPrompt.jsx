import { useState, useEffect } from "react";

/**
 * PWAInstallPrompt Component
 * Captures the `beforeinstallprompt` event across Android, Chrome, Edge, and desktop browsers,
 * and handles iOS Safari Add-to-Home-Screen instructions.
 */
export default function PWAInstallPrompt({ variant = "banner" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("pwa_install_dismissed") === "true";
    } catch {
      return false;
    }
  });
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if running in standalone display mode (already installed)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(Boolean(isStandaloneMode));
    };

    // Check if iOS
    const checkIOS = () => {
      const ua = window.navigator.userAgent.toLowerCase();
      const isApple = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
      setIsIOS(isApple);
    };

    checkStandalone();
    checkIOS();

    // Listen for the Chrome/Edge/Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Also make it globally triggerable
      window.__pwaInstallPrompt = e;
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      window.__pwaInstallPrompt = null;
      console.log("[PWA] StaffPortal installed successfully!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        console.log("[PWA] User accepted install prompt");
        setDeferredPrompt(null);
      } else {
        console.log("[PWA] User dismissed install prompt");
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("pwa_install_dismissed", "true");
    } catch {
      // Storage access restricted
    }
  };

  // If already running standalone, do not display anything
  if (isStandalone) {
    return null;
  }

  // Header button variant (compact pill for navigation bar)
  if (variant === "button") {
    if (!deferredPrompt && !isIOS) return null;

    return (
      <button
        type="button"
        className="btn-pwa-install-header"
        onClick={handleInstallClick}
        title="Install StaffPortal to your device for offline access"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))",
          border: "1px solid rgba(139, 92, 246, 0.35)",
          color: "var(--text-primary, #ffffff)",
          padding: "6px 12px",
          borderRadius: "8px",
          fontSize: "0.82rem",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <span style={{ fontSize: "0.95rem" }}>📲</span>
        <span className="pwa-install-btn-label">Install App</span>
      </button>
    );
  }

  // Floating banner variant (bottom right non-intrusive prompt)
  if (dismissed || (!deferredPrompt && !isIOS)) {
    return null;
  }

  return (
    <div
      className="pwa-install-banner"
      style={{
        position: "fixed",
        bottom: "85px",
        right: "24px",
        zIndex: 9998,
        maxWidth: "360px",
        background: "var(--card-bg, #111827)",
        border: "1px solid rgba(139, 92, 246, 0.3)",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 20px 35px -10px rgba(0, 0, 0, 0.6), 0 0 20px rgba(99, 102, 241, 0.15)",
        backdropFilter: "blur(12px)",
        animation: "fadeInSlideUp 0.3s ease-out",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <img
          src="/icon.svg"
          alt="StaffPortal App Icon"
          style={{ width: "42px", height: "42px", borderRadius: "10px", flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary, #ffffff)" }}>
            Install StaffPortal App
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary, #94a3b8)", marginTop: "2px" }}>
            Add to home screen for instant offline access and workday punches.
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install banner"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-secondary, #94a3b8)",
            cursor: "pointer",
            fontSize: "1.1rem",
            padding: "0",
            lineHeight: "1",
          }}
        >
          ✕
        </button>
      </div>

      {showIOSGuide ? (
        <div
          style={{
            background: "rgba(99, 102, 241, 0.1)",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "0.8rem",
            color: "var(--text-primary, #ffffff)",
            lineHeight: "1.4",
          }}
        >
          To install on iOS: Tap the <strong>Share</strong> button (⎋) in Safari toolbar, then scroll down and tap <strong>Add to Home Screen (+)</strong>.
        </div>
      ) : (
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              background: "transparent",
              border: "1px solid var(--border-color, #334155)",
              color: "var(--text-secondary, #94a3b8)",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "0.82rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={handleInstallClick}
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none",
              color: "#ffffff",
              borderRadius: "8px",
              padding: "6px 14px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.35)",
            }}
          >
            Install
          </button>
        </div>
      )}
    </div>
  );
}

