/**
 * drive.js — company Drive link cards.
 */
const PageDrive = (() => {
  async function render(mount) {
    // These links are only ever edited directly in the DriveLinks sheet
    // (no in-app mutation), so they're safe to cache for the rest of
    // this session instead of refetching on every visit.
    let links = State.get("driveLinks");
    if (!links) {
      const res = await Api.call("getDriveLinks");
      if (!res.ok) { mount.innerHTML = `<div class="empty-state">${res.error}</div>`; return; }
      links = res.links;
      State.set("driveLinks", links);
    }

    mount.innerHTML = `
      <div class="grid grid-4">
        ${links.map(l => `
          <div class="drive-card" data-url="${Utils.escapeHtml(l.url)}">
            <div class="drive-icon">${Utils.escapeHtml(l.icon)}</div>
            <div class="d-title">${Utils.escapeHtml(l.title)}</div>
            <div class="d-open">Open in Drive \u2197</div>
          </div>`).join("")}
      </div>
    `;
    mount.querySelectorAll(".drive-card").forEach(card => {
      card.addEventListener("click", () => window.open(card.dataset.url, "_blank", "noopener"));
    });
  }
  return { render };
})();
