/**
 * sidebar.js — nav items, filtered by role.
 */
const Sidebar = (() => {
  // Minimal single-stroke line icons (currentColor, so they inherit the
  // same hover/active color transitions the nav items already had).
  const ICONS = {
    dashboard: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.2" /><rect x="11.5" y="2.5" width="6" height="6" rx="1.2" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.2" /><rect x="11.5" y="11.5" width="6" height="6" rx="1.2" />
    </svg>`,
    "work-reports": `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 2.5h6.5l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" />
      <path d="M11.5 2.5v3h3" /><path d="M6.5 11h7M6.5 14h7M6.5 8h3.5" />
    </svg>`,
    salary: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v7M12.3 8.3c0-1-1-1.7-2.3-1.7s-2.2.6-2.2 1.6c0 2.2 4.4 1 4.4 3.1 0 1-1 1.7-2.2 1.7s-2.3-.7-2.3-1.7" />
    </svg>`,
    drive: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 5.5a1 1 0 0 1 1-1h4l1.5 2h7.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-10Z" />
    </svg>`,
    attendance: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.5" y="4" width="15" height="13.5" rx="1.5" /><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3" />
    </svg>`,
    employees: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="7" cy="7" r="2.6" /><circle cx="14.2" cy="8" r="2.2" />
      <path d="M2.5 17c0-3 2-4.8 4.5-4.8s4.5 1.8 4.5 4.8" /><path d="M12.6 12.6c2 .2 3.4 1.9 3.4 4.4" />
    </svg>`,
    profile: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="7" r="3.2" /><path d="M3.5 17c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    </svg>`,
    settings: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 3.5v1.6M10 14.9v1.6M16.5 10h-1.6M5.1 10H3.5M14.6 5.4l-1.1 1.1M6.5 13.5l-1.1 1.1M14.6 14.6l-1.1-1.1M6.5 6.5 5.4 5.4" />
    </svg>`
  };

  const NAV = [
    { id: "dashboard",     label: "Dashboard",    roles: ["employee", "admin", "ceo"] },
    { id: "work-reports",  label: "Work Reports",  roles: ["employee", "admin", "ceo"] },
    { id: "salary",        label: "Salary",        roles: ["employee", "admin", "ceo"] },
    { id: "drive",         label: "Drive",         roles: ["employee", "admin", "ceo"] },
    { id: "attendance",    label: "Attendance",    roles: ["employee", "admin", "ceo"] },
    { id: "employees",     label: "Employees",     roles: ["admin", "ceo"] },
    { id: "profile",       label: "Profile",       roles: ["employee", "admin", "ceo"] },
    { id: "settings",      label: "Settings",      roles: ["admin", "ceo"] }
  ];

  function render() {
    const user = Auth.getUser();
    const items = NAV.filter(n => n.roles.includes(user.role));
    const el = document.getElementById("sidebar");
    el.innerHTML = `
      <div class="sidebar-logo"><span class="dot"></span><span class="label">Aurien Media</span></div>
      <nav class="sidebar-nav" id="sidebarNav">
        ${items.map(n => `
          <button class="nav-item" data-route="${n.id}">
            <span class="ic">${ICONS[n.id]}</span><span class="label">${n.label}</span>
          </button>`).join("")}
      </nav>
      <div class="sidebar-footer">Employee Portal</div>
    `;
    el.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => (window.location.hash = "#" + btn.dataset.route));
    });
  }

  function setActive(routeId) {
    document.querySelectorAll("#sidebarNav .nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.route === routeId);
    });
  }

  return { render, setActive };
})();
