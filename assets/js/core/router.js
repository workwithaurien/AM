/**
 * router.js — minimal hash router for app.html.
 * Swaps the #content mount using each page module's render()/init(),
 * so navigation never triggers a full page reload.
 */
const Router = (() => {
  const routes = {
    dashboard:    { title: "Dashboard",    page: () => PageDashboard,   adminOnly: false },
    "work-reports": { title: "Work Reports", page: () => PageWorkReports, adminOnly: false },
    salary:       { title: "Salary",       page: () => PageSalary,      adminOnly: false },
    drive:        { title: "Drive",        page: () => PageDrive,       adminOnly: false },
    attendance:   { title: "Attendance",   page: () => PageAttendance,  adminOnly: false },
    employees:    { title: "Employees",    page: () => PageEmployees,   adminOnly: true  },
    profile:      { title: "Profile",      page: () => PageProfile,     adminOnly: false },
    settings:     { title: "Settings",     page: () => PageSettings,    adminOnly: true  }
  };

  function currentRoute() {
    const hash = (window.location.hash || "#dashboard").replace("#", "");
    return routes[hash] ? hash : "dashboard";
  }

  async function render() {
    const routeId = currentRoute();
    const route = routes[routeId];

    if (route.adminOnly && !Auth.isAdmin()) {
      window.location.hash = "#dashboard";
      return;
    }

    document.getElementById("topbarTitle").textContent = route.title;
    Sidebar.setActive(routeId);

    const mount = document.getElementById("content");
    mount.innerHTML = Loader.skeletonBlock();

    const mod = route.page();
    await mod.render(mount);
  }

  function init() {
    window.addEventListener("hashchange", render);
    // Setting the hash when it's currently empty fires a "hashchange" event
    // (which will call render() itself) — call it directly only when that
    // event won't fire, otherwise the first page load renders twice.
    if (!window.location.hash) window.location.hash = "#dashboard";
    else render();
  }

  return { init, currentRoute, routes };
})();
