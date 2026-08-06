/**
 * auth.js — session storage + role guarding.
 * Session lives in sessionStorage (cleared when the tab closes) —
 * swap for localStorage if "remember me" across sessions is wanted.
 */
const Auth = (() => {
  const KEY = "ems_session";

  function setSession(user, token) {
    sessionStorage.setItem(KEY, JSON.stringify({ user, token }));
  }
  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
  }
  function getUser() { return getSession()?.user || null; }
  function getToken() { return getSession()?.token || null; }
  function isLoggedIn() { return !!getSession(); }
  function isAdmin() { return getUser()?.role === "admin"; }
  function logout() {
    sessionStorage.removeItem(KEY);
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

  return { setSession, getUser, getToken, isLoggedIn, isAdmin, logout, requireAuth };
})();
