/**
 * StaffPortal - Service Worker (v2.6)
 * High-performance offline caching, stale-while-revalidate for API queries,
 * and resilient SPA navigation fallback.
 */

const CACHE_VERSION = "ems-shell-v2.6";
const API_CACHE_VERSION = "ems-api-v2.6";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable.png",
  "/apple-touch-icon.png",
];

// Read-only API endpoints eligible for offline caching
const CACHEABLE_API_PATHS = [
  "/auth/me",
  "/auth/session-config",
  "/employees",
  "/departments",
  "/holidays",
  "/holidays/announcements",
  "/holidays/business-days",
  "/attendance/today",
  "/attendance/roster",
  "/attendance/team-live",
  "/profile/me",
  "/analytics/summary",
  "/notifications",
];

// Install Event - Pre-cache core app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Pre-caching partial failure:", err);
      });
    })
  );
  // Do not automatically skipWaiting; let client decide or on user action
});

// Activate Event - Clean up stale legacy caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_VERSION && key !== API_CACHE_VERSION) {
            console.log("[SW] Removing outdated cache:", key);
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Check if an API endpoint is safe for offline caching
function isCacheableApiRequest(url) {
  const path = url.pathname;
  return CACHEABLE_API_PATHS.some((allowedPath) => path.startsWith(allowedPath));
}

// Fetch Event - Dynamic routing strategy based on request destination
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-HTTP/HTTPS schemes (e.g., chrome-extension://)
  if (!url.protocol.startsWith("http")) return;

  // 1. NON-GET REQUESTS (POST, PUT, DELETE, PATCH)
  if (request.method !== "GET") {
    // If the browser is definitely offline, respond early with helpful JSON error
    if (!self.navigator.onLine) {
      event.respondWith(
        new Response(
          JSON.stringify({
            detail: "You are currently offline. Actions and data modifications require an active network connection.",
            offline: true,
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
      return;
    }
    // Otherwise let write requests hit network directly without caching
    return;
  }

  // 2. SPA NAVIGATION REQUESTS (HTML page visits/reloads)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match("/index.html").then((cachedIndex) => {
            return cachedIndex || caches.match("/");
          });
        })
    );
    return;
  }

  // 3. API READ REQUESTS (FastAPI backend calls)
  const isApiCall =
    url.port === "8000" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/employees") ||
    url.pathname.startsWith("/departments") ||
    url.pathname.startsWith("/attendance") ||
    url.pathname.startsWith("/holidays") ||
    url.pathname.startsWith("/profile") ||
    url.pathname.startsWith("/reports") ||
    url.pathname.startsWith("/analytics") ||
    url.pathname.startsWith("/notifications") ||
    url.pathname.startsWith("/sync");

  if (isApiCall) {
    // Stale-While-Revalidate / Network-First with Cache fallback
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // If valid response and endpoint is cacheable, mirror in API cache
          if (networkResponse && networkResponse.ok && isCacheableApiRequest(url)) {
            const clone = networkResponse.clone();
            caches.open(API_CACHE_VERSION).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Network failed: attempt to retrieve cached response
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            // Append offline notice header
            const newHeaders = new Headers(cachedResponse.headers);
            newHeaders.set("X-EMS-Offline", "true");
            newHeaders.set("X-EMS-Cache-Time", new Date().toISOString());

            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: newHeaders,
            });
          }

          // If not in cache, return an informative JSON error
          return new Response(
            JSON.stringify({
              detail: "You are offline and this data has not been cached yet. Please reconnect to access this record.",
              offline: true,
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json", "X-EMS-Offline": "true" },
            }
          );
        })
    );
    return;
  }

  // 4. STATIC ASSETS (JS, CSS, SVGs, Images, Web Fonts)
  // Cache-First strategy with network refresh
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Optionally revalidate in background for non-hashed assets
        if (!url.pathname.includes("/assets/")) {
          fetch(request).then((freshResponse) => {
            if (freshResponse && freshResponse.ok) {
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, freshResponse));
            }
          }).catch(() => {});
        }
        return cachedResponse;
      }

      // If not in cache, fetch from network and store
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || !networkResponse.ok) {
            return networkResponse;
          }
          const clone = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(request, clone);
          });
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback for image assets
          if (request.destination === "image") {
            return caches.match("/favicon.svg");
          }
        });
    })
  );
});

// Client Communication Channel
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "CLEAR_API_CACHE") {
    caches.delete(API_CACHE_VERSION).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    });
  }
});

