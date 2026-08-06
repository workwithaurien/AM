/**
 * drawer.js — side panel for detail views (e.g. Employee detail).
 * Usage: Drawer.open({ title, tabs: [{id,label,render}], footerHtml })
 */
const Drawer = (() => {
  function open({ title, tabs, footerHtml = "", avatarHtml = "" }) {
    close();
    const overlay = Utils.el(`<div class="drawer-overlay" id="activeDrawerOverlay"></div>`);
    const drawer = Utils.el(`
      <aside class="drawer" id="activeDrawer" role="dialog" aria-label="${Utils.escapeHtml(title)}">
        <div class="drawer-head">
          <div class="drawer-title">
            ${avatarHtml ? `<div class="drawer-avatar">${avatarHtml}</div>` : ""}
            <h3>${Utils.escapeHtml(title)}</h3>
          </div>
          <button class="close-x" aria-label="Close">\u2715</button>
        </div>
        <div class="drawer-body">
          <div class="tabs" id="drawerTabs">
            ${tabs.map((t, i) => `<button class="tab-btn ${i === 0 ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`).join("")}
          </div>
          <div id="drawerTabBody"></div>
        </div>
        ${footerHtml ? `<div class="modal-foot">${footerHtml}</div>` : ""}
      </aside>
    `);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    function showTab(id) {
      drawer.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
      const tab = tabs.find(t => t.id === id);
      drawer.querySelector("#drawerTabBody").innerHTML = tab.render();
    }
    drawer.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
    showTab(tabs[0].id);

    overlay.addEventListener("click", close);
    drawer.querySelector(".close-x").addEventListener("click", close);
    return drawer;
  }
  function close() {
    document.getElementById("activeDrawerOverlay")?.remove();
    document.getElementById("activeDrawer")?.remove();
  }
  return { open, close };
})();
