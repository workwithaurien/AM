/**
 * toast.js — transient notifications. Usage: Toast.show("Saved", "success")
 */
const Toast = (() => {
  function ensureHost() {
    let host = document.getElementById("toastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "toastHost";
      document.body.appendChild(host);
    }
    return host;
  }
  function show(message, type = "neutral", duration = 2800) {
    const host = ensureHost();
    const node = Utils.el(`<div class="toast ${type}">${Utils.escapeHtml(message)}</div>`);
    host.appendChild(node);
    setTimeout(() => node.remove(), duration);
  }
  return { show };
})();
