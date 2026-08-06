/**
 * app.js — bootstraps app.html: guards the route, renders chrome, starts router.
 */
(function bootstrap() {
  if (!Auth.requireAuth()) return;
  Sidebar.render();
  Navbar.render();
  Router.init();
  initMobileSidebar();
})();

/** Hamburger toggle for the off-canvas sidebar on small screens (see the
 *  max-width:900px rules in layout.css). Closes on: scrim click, picking
 *  a nav item, or Escape — desktop widths never show the hamburger or
 *  scrim at all, so this is a no-op there. */
function initMobileSidebar() {
  const shell = document.getElementById("appShell");
  const scrim = document.getElementById("sidebarScrim");
  const sidebar = document.getElementById("sidebar");

  const close = () => shell.classList.remove("sidebar-open");
  const toggle = () => shell.classList.toggle("sidebar-open");

  document.getElementById("hamburgerBtn").addEventListener("click", toggle);
  scrim.addEventListener("click", close);
  sidebar.addEventListener("click", e => { if (e.target.closest(".nav-item")) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}
