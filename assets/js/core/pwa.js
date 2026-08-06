/**
 * pwa.js — registers sw.js so the app can be installed (Chrome/Edge's
 * "Install app" prompt, iOS Safari's "Add to Home Screen"). No-op in
 * browsers without service worker support.
 */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
