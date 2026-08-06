/**
 * badge.js — status pill. tone: success | warning | danger | neutral
 */
const Badge = (() => {
  function render(text, tone = "neutral") {
    return `<span class="badge ${tone}">${Utils.escapeHtml(text)}</span>`;
  }
  return { render };
})();
