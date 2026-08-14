/**
 * auth.js — session storage + role guarding.
 * Session normally lives in sessionStorage (cleared when the tab
 * closes). Checking "Remember me" at login instead stores it in
 * localStorage, so it survives closing the browser — but the server
 * side session (CacheService, in Code.gs) still hard-caps at 6 hours
 * regardless of which storage is used; api.js detects that expiry and
 * bounces back to a clean login (see its "Not authenticated" handling).
 */
const Auth = (() => {
  const KEY = "ems_session";

  function setSession(user, token, remember) {
    const data = JSON.stringify({ user, token });
    if (remember) {
      localStorage.setItem(KEY, data);
      sessionStorage.removeItem(KEY);
    } else {
      sessionStorage.setItem(KEY, data);
      localStorage.removeItem(KEY);
    }
  }
  function getSession() {
    try {
      const raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function getUser() { return getSession()?.user || null; }
  function getToken() { return getSession()?.token || null; }
  function isLoggedIn() { return !!getSession(); }
  // CEO gets every Admin capability (Employees page, all approvals,
  // Settings) plus the exclusive right to approve/reject/delete a
  // request an Admin submitted — see isCeo() and employees.js's
  // approval modals for that extra check.
  function isAdmin() { return getUser()?.role === "admin" || getUser()?.role === "ceo"; }
  function isCeo() { return getUser()?.role === "ceo"; }
  function logout() {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
    if (typeof State !== "undefined") State.clear(); // don't leak cached data to the next login on this browser
    window.location.href = "index.html";
  }
  /** Call at the top of app.html — bounces signed-out users back to login.
   *  Returns false when redirecting, so the caller can stop further setup
   *  instead of relying on navigation happening synchronously. */
  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = "index.html";
      return false;
    }
    return true;
  }

  return { setSession, getUser, getToken, isLoggedIn, isAdmin, isCeo, logout, requireAuth };
})();
