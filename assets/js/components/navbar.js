/**
 * navbar.js — topbar with notifications (announcements dropdown, with a
 * red dot for unread + per-item "mark as read"), gear (admin), avatar,
 * and an explicitly-labeled Logout button.
 */
const Navbar = (() => {
  const BELL_SVG = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 8a5 5 0 0 1 10 0c0 3.5 1.2 4.8 1.5 5.5h-13C3.8 12.8 5 11.5 5 8Z" />
    <path d="M8.2 16a1.8 1.8 0 0 0 3.6 0" />
  </svg>`;
  const GEAR_SVG = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="2.6" />
    <path d="M10 3.5v1.6M10 14.9v1.6M16.5 10h-1.6M5.1 10H3.5M14.6 5.4l-1.1 1.1M6.5 13.5l-1.1 1.1M14.6 14.6l-1.1-1.1M6.5 6.5 5.4 5.4" />
  </svg>`;
  const HAMBURGER_SVG = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <path d="M3 6h14M3 10h14M3 14h14" />
  </svg>`;

  let notifItems = []; // unified feed: announcements + (admin-only) pending employee requests

  function render() {
    const user = Auth.getUser();
    const el = document.getElementById("topbar");
    el.innerHTML = `
      <div class="topbar-left">
        <button class="hamburger-btn" id="hamburgerBtn" aria-label="Toggle menu">${HAMBURGER_SVG}</button>
        <div class="topbar-title" id="topbarTitle">Dashboard</div>
      </div>
      <div class="topbar-right">
        <div style="position:relative">
          <button class="icon-btn" id="notifBtn" title="Notifications">${BELL_SVG}<span class="notif-dot" id="notifDot"></span></button>
          <div class="notif-panel" id="notifPanel" hidden></div>
        </div>
        ${Auth.isAdmin() ? `<button class="icon-btn" id="gearBtn" title="Settings">${GEAR_SVG}</button>` : ""}
        <div class="icon-btn avatar" id="avatarBtn" title="${Utils.escapeHtml(user.name)} — view profile">
          ${Utils.avatarInner(user)}
        </div>
        <button class="logout-btn" id="logoutBtn">Logout</button>
      </div>
    `;
    const gear = document.getElementById("gearBtn");
    if (gear) gear.addEventListener("click", () => (window.location.hash = "#settings"));
    document.getElementById("avatarBtn").addEventListener("click", () => (window.location.hash = "#profile"));
    document.getElementById("logoutBtn").addEventListener("click", () => {
      if (confirm("Log out of Aurien Media EMS?")) Auth.logout();
    });
    document.getElementById("notifBtn").addEventListener("click", toggleNotifications);
    document.addEventListener("click", closeNotificationsOnOutsideClick);

    loadNotifications(); // populate the dot + panel content right away, not just on click
  }

  function readKey() {
    const uid = Auth.getUser()?.uid || "anon";
    return `ems_notifs_read_${uid}`;
  }
  function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(readKey())) || []); } catch { return new Set(); }
  }
  function markRead(key) {
    const set = getReadSet();
    set.add(key);
    localStorage.setItem(readKey(), JSON.stringify([...set]));
  }

  async function loadNotifications() {
    const res = await Api.call("getDashboard");
    if (!res.ok) return;

    // Announcements has no ID column, but title+date is unique enough for
    // a broadcast list like this.
    const items = (res.announcements || []).map(a => ({
      key: `ann_${a.title}__${a.date}`,
      title: a.title,
      sub: Utils.formatDate(a.date),
      route: null,
      priority: 0
    }));

    // Admin/CEO-only: new employee requests show up as notifications too,
    // not just the passive "Pending Approvals" count on the dashboard.
    // For a CEO viewer, one submitted by an Admin is the one thing only
    // they can decide (see canDecideRequestFrom_) — called out with a
    // distinct title and deep-linked straight to the right approval
    // modal (see employees.js).
    if (Auth.isAdmin()) {
      const isCeo = Auth.isCeo();
      items.push(...(res.pendingRequests || []).map(r => {
        const forCeo = isCeo && r.fromAdmin;
        return {
          key: r.key,
          title: forCeo ? `Needs your approval — ${r.kind}, ${r.name}` : `${r.kind} request — ${r.name}`,
          sub: `Applied ${Utils.formatDate(r.date)} · review in Employees`,
          route: forCeo ? `employees?open=${r.kind.toLowerCase()}` : "employees",
          priority: forCeo ? 1 : 0
        };
      }));
    }

    // Sorted so the one thing only the CEO can decide always surfaces
    // first, ahead of ordinary announcements/requests — not just
    // ordered relative to other pending requests.
    items.sort((a, b) => b.priority - a.priority);
    notifItems = items;
    renderPanel();
    updateDot();
  }

  function updateDot() {
    const read = getReadSet();
    const hasUnread = notifItems.some(n => !read.has(n.key));
    document.getElementById("notifDot")?.classList.toggle("show", hasUnread);
  }

  function renderPanel() {
    const panel = document.getElementById("notifPanel");
    if (!panel) return;
    if (!notifItems.length) {
      panel.innerHTML = `<div class="notif-empty">No announcements yet.</div>`;
      return;
    }
    const read = getReadSet();
    const unread = notifItems.filter(n => !read.has(n.key));
    if (!unread.length) {
      panel.innerHTML = `<div class="notif-empty">You're all caught up.</div>`;
      return;
    }
    panel.innerHTML = unread.map(n => `
        <div class="notif-item ${n.route ? "clickable" : ""}" data-route="${n.route || ""}">
          <div>
            <div class="notif-title">${Utils.escapeHtml(n.title)}</div>
            <div class="notif-date">${Utils.escapeHtml(n.sub)}</div>
          </div>
          <button class="notif-clear" data-key="${Utils.escapeHtml(n.key)}" title="Mark as read">✕</button>
        </div>`).join("");
    panel.querySelectorAll(".notif-item[data-route]").forEach(row => {
      if (!row.dataset.route) return;
      row.addEventListener("click", () => {
        window.location.hash = "#" + row.dataset.route;
        document.getElementById("notifPanel").hidden = true;
      });
    });
    panel.querySelectorAll("[data-key]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        markRead(btn.dataset.key);
        renderPanel(); // the cleared item drops out of the list entirely, not just dims
        updateDot();
      });
    });
  }

  function toggleNotifications(e) {
    e.stopPropagation();
    const panel = document.getElementById("notifPanel");
    const opening = panel.hidden;
    panel.hidden = !opening;
    if (opening) loadNotifications(); // refresh in case new announcements landed
  }

  function closeNotificationsOnOutsideClick(e) {
    const panel = document.getElementById("notifPanel");
    if (!panel || panel.hidden) return;
    if (!panel.contains(e.target) && e.target.id !== "notifBtn") panel.hidden = true;
  }

  return { render };
})();
