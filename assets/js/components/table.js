/**
 * table.js — renders a data table from columns + rows.
 * columns: [{ key, label }]   rows: [{ ...cellValuesAlreadyFormattedHtml }]
 */
const DataTable = (() => {
  function render(columns, rows, { emptyText = "No records yet.", onRowClick = null } = {}) {
    if (!rows.length) {
      return `<div class="table-wrap"><div class="table-empty">${Utils.escapeHtml(emptyText)}</div></div>`;
    }
    // A floor width scaled to column count — on a screen narrower than
    // this, the table overflows its wrapper and .table-wrap scrolls
    // horizontally instead of squeezing every column unreadably thin.
    const minWidth = Math.max(columns.length * 120, 420);
    return `
      <div class="table-wrap">
        <table class="data" style="min-width:${minWidth}px">
          <thead><tr>${columns.map(c => `<th>${Utils.escapeHtml(c.label)}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map((row, i) => `
              <tr class="${onRowClick ? "clickable" : ""}" data-row-index="${i}">
                ${columns.map(c => `<td>${row[c.key] ?? ""}</td>`).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  /** call after inserting HTML, to wire row clicks */
  function bindRowClicks(container, rows, onRowClick) {
    if (!onRowClick) return;
    container.querySelectorAll("tr[data-row-index]").forEach(tr => {
      tr.addEventListener("click", () => onRowClick(rows[Number(tr.dataset.rowIndex)]));
    });
  }

  return { render, bindRowClicks };
})();
