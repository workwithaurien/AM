/**
 * api.js — single fetch wrapper for the Apps Script backend.
 *
 * All dummy/test data now lives in the Google Sheet itself (seeded by
 * apps-script/Setup.gs), not in this file — so nothing here works
 * until APPS_SCRIPT_URL below points at a deployed Web App. See
 * README.md for the deployment steps.
 */
const Api = (() => {
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzCTB4o1bHLrZ4-JJG_AD5QnSJmnjcdf91fUhZ_rlhOCYkSHYTixJ4MnLRaviWEG7Kv/exec";

  async function call(action, payload = {}) {
    if (APPS_SCRIPT_URL.startsWith("PASTE_")) {
      return { ok: false, error: "Backend not configured yet — set APPS_SCRIPT_URL in assets/js/core/api.js (see README.md)." };
    }
    // Loader is optional — index.html loads it too, but guard anyway so
    // Api.call never breaks if a page ever doesn't include it.
    if (typeof Loader !== "undefined") Loader.show();
    try {
      // Apps Script Web Apps expect text/plain to avoid a CORS preflight.
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, token: Auth.getToken(), ...payload })
      });
      if (!res.ok) return { ok: false, error: "Network error (" + res.status + ")" };
      const data = await res.json();
      // Apps Script sessions cap out at 6 hours (CacheService's hard
      // limit) — when that expires server-side, sessionStorage still
      // thinks the browser is logged in, so every page would otherwise
      // just sit on raw "Not authenticated" error text forever with no
      // way back. Force a clean re-login instead.
      if (!data.ok && data.error === "Not authenticated. Please log in again." && action !== "login") {
        sessionStorage.setItem("ems_login_notice", "Your session expired — please log in again.");
        Auth.logout();
      }
      return data;
    } catch (err) {
      return { ok: false, error: err.message || "Request failed" };
    } finally {
      if (typeof Loader !== "undefined") Loader.hide();
    }
  }

  return { call };
})();
