/**
 * utils.js — shared formatters/helpers.
 */
const Utils = (() => {
  function currency(n) {
    return "\u20B9" + Number(n || 0).toLocaleString("en-IN");
  }
  function formatDate(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", opts);
  }
  /** Today's date as YYYY-MM-DD in the browser's local timezone — NOT
   *  new Date().toISOString(), which is UTC and rolls over to "tomorrow"
   *  or stays on "yesterday" depending on the viewer's UTC offset. */
  function todayIso() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }
  function initials(name = "") {
    return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  }
  /** Avatar content for a circular avatar container: the user's photo
   *  (uploaded to GitHub by hand, URL stored in the Users sheet) if set,
   *  falling back to initials — including if the photo URL 404s, via
   *  onerror. Caller supplies the sized circular wrapper (.avatar /
   *  .profile-avatar); this just fills it. */
  function avatarInner(user) {
    const fallback = initials(user?.name);
    if (user?.photoUrl) {
      return `<img class="avatar-img" src="${escapeHtml(user.photoUrl)}" alt="${escapeHtml(user.name || "")}" onerror="this.outerHTML='${escapeHtml(fallback)}'" />`;
    }
    return fallback;
  }
  function debounce(fn, wait = 250) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }
  function escapeHtml(str = "") {
    return String(str).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  return { currency, formatDate, todayIso, initials, avatarInner, debounce, escapeHtml, el };
})();
