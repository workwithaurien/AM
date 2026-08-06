/**
 * modal.js — centered overlay for short forms.
 * Usage: Modal.open({ title, bodyHtml, onMount, footerHtml })
 */
const Modal = (() => {
  function open({ title, bodyHtml, onMount = null, footerHtml = "", wide = false, xl = false }) {
    close(); // only one at a time
    const overlay = Utils.el(`
      <div class="overlay" id="activeModal">
        <div class="modal${xl ? " xl" : wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-label="${Utils.escapeHtml(title)}">
          <div class="modal-head">
            <h3>${Utils.escapeHtml(title)}</h3>
            <button class="close-x" aria-label="Close">\u2715</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="modal-foot">${footerHtml}</div>` : ""}
        </div>
      </div>
    `);
    document.body.appendChild(overlay);
    overlay.querySelector(".close-x").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", escHandler);
    if (onMount) onMount(overlay);
    return overlay;
  }
  function escHandler(e) { if (e.key === "Escape") close(); }
  function close() {
    document.getElementById("activeModal")?.remove();
    document.removeEventListener("keydown", escHandler);
  }
  return { open, close };
})();
