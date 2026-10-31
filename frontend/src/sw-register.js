/**
 * Service Worker Registration & Lifecycle Management
 * Handles progressive registration, update detection, and client reload.
 */

let registration = null;

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // Register after the page finishes initial render
  window.addEventListener("load", async () => {
    try {
      registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      // Handle updates if a worker is already waiting
      if (registration.waiting) {
        notifyUpdateAvailable(registration.waiting);
      }

      // Detect worker transitions during lifecycle
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New content is available because controller already exists
            notifyUpdateAvailable(newWorker);
          }
        });
      });

      // Listen for controllerchange to reload page when new SW takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      console.log("[PWA] Service Worker registered with scope:", registration.scope);
    } catch (err) {
      console.warn("[PWA] Service Worker registration failed:", err);
    }
  });
}

function notifyUpdateAvailable(worker) {
  // Dispatch custom DOM event for React components to display update toast/banner
  const event = new CustomEvent("ems:sw-update-available", {
    detail: {
      worker,
      update: () => {
        if (worker) {
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      },
    },
  });
  window.dispatchEvent(event);
}

export function promptUpdate() {
  if (registration && registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}

export function unregisterServiceWorker() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
  }
}

