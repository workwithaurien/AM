/**
 * loader.js — skeleton block shown while a page fetches data, plus a
 * global overlay shown while any Api.call is in flight (wired in from
 * api.js) so every button click gets a loading indicator, not just page
 * navigation.
 */
const Loader = (() => {
  function skeletonBlock() {
    return `
      <div class="grid grid-3" style="margin-bottom:14px">
        ${[1,2,3].map(() => `<div class="card skeleton" style="height:88px"></div>`).join("")}
      </div>
      <div class="skeleton" style="height:220px;border-radius:14px"></div>
    `;
  }
  function spinner() {
    return `<div class="spinner"></div>`;
  }

  let activeCount = 0;
  let showTimer = null;
  let overlayEl = null;

  function ensureOverlay() {
    if (!overlayEl) {
      overlayEl = document.createElement("div");
      overlayEl.id = "globalLoader";
      overlayEl.innerHTML = `<div class="spinner lg"></div>`;
      document.body.appendChild(overlayEl);
    }
    return overlayEl;
  }

  /** Call before starting a request; pairs with hide(). Waits 150ms before
   *  actually showing so quick requests don't cause a loading-state flash. */
  function show() {
    activeCount++;
    if (activeCount === 1) {
      showTimer = setTimeout(() => ensureOverlay().classList.add("show"), 150);
    }
  }
  function hide() {
    activeCount = Math.max(0, activeCount - 1);
    if (activeCount === 0) {
      clearTimeout(showTimer);
      if (overlayEl) overlayEl.classList.remove("show");
    }
  }

  return { skeletonBlock, spinner, show, hide };
})();
