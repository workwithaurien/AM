/**
 * sw.js — minimal app-shell cache so the login/dashboard shell can
 * install as a PWA and open instantly on repeat visits. Only handles
 * same-origin GET requests (HTML/CSS/JS/images); every API call to the
 * Apps Script backend is cross-origin and left completely untouched —
 * this never caches or intercepts live data.
 */
const CACHE_NAME = "aurien-ems-shell-v1";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./app.html",
  "./manifest.json",
  "./assets/css/tokens.css",
  "./assets/css/base.css",
  "./assets/css/layout.css",
  "./assets/css/components.css",
  "./assets/css/pages.css",
  "./assets/images/icons/icon-192.png",
  "./assets/images/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  // Only same-origin GETs are ever cached — cross-origin (the Apps
  // Script API) and non-GET requests pass straight through to the network.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
