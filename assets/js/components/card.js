/**
 * card.js — generic stat card used across Dashboard/Salary.
 * Usage: Card.stat({label, value, sub})
 */
const Card = (() => {
  function stat({ label, value, sub = "" }) {
    return `
      <div class="card">
        <div class="card-label">${Utils.escapeHtml(label)}</div>
        <div class="card-value">${value}</div>
        ${sub ? `<div class="card-sub">${sub}</div>` : ""}
      </div>`;
  }
  return { stat };
})();
