/**
 * letterDoc.js — opens a formatted, printable Warning/Appreciation letter
 * in a new tab (letterhead, warning-number badge, subject, body, issued
 * by, signature line) with a "Download as PDF" button that uses the
 * browser's native print-to-PDF (window.print()) — no external library
 * or server-side rendering needed, and it works identically everywhere
 * a browser does.
 */
const LetterDoc = (() => {
  const ACCENT = "#002147"; // matches theme-color in index.html/app.html

  /** Opens window.open() synchronously (inside the click handler) so
   *  popup blockers don't kill it, then fills it in once Settings
   *  (for the letterhead's company name) comes back. */
  function open(letter, employee) {
    const win = window.open("", "_blank");
    if (!win) { alert("Please allow pop-ups for this site to view/download the letter."); return; }
    win.document.write("<p style=\"font-family:sans-serif;padding:40px;color:#666\">Loading letter…</p>");
    win.document.close();

    Api.call("getSettings").then(res => {
      const companyName = res.ok && res.companyName ? res.companyName : "Aurien Media";
      win.document.open();
      win.document.write(html(letter, employee, companyName));
      win.document.close();
    });
  }

  function ordinal(n) {
    n = Number(n);
    if (!n) return "";
    const rem100 = n % 100;
    if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function html(letter, employee, companyName) {
    const isWarning = letter.type === "Warning";
    const heading = isWarning
      ? `${ordinal(letter.warningNumber)} Warning Letter`
      : `${esc(letter.type)} Letter`;
    const badgeHtml = isWarning
      ? `<div class="badge warning">Warning ${esc(letter.warningNumber)} of 3</div>`
      : letter.type === "Appreciation"
        ? `<div class="badge appreciation">Appreciation</div>`
        : "";
    const bodyHtml = esc(letter.message).split(/\n+/).map(p => `<p>${p}</p>`).join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${heading} — ${esc(employee.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; background: #f4f5f7; }
  .toolbar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e2e4e9; padding: 14px 24px; display: flex; justify-content: flex-end; gap: 10px; }
  .toolbar button { font-family: -apple-system, Segoe UI, sans-serif; font-size: 14px; font-weight: 600; padding: 9px 18px; border-radius: 8px; border: none; cursor: pointer; background: ${ACCENT}; color: #fff; }
  .sheet { max-width: 760px; margin: 32px auto; background: #fff; padding: 56px 64px; box-shadow: 0 1px 4px rgba(0,0,0,.12); border-top: 6px solid ${ACCENT}; }
  .letterhead { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid ${ACCENT}; padding-bottom: 14px; margin-bottom: 28px; }
  .letterhead .company { font-size: 22px; font-weight: 700; color: ${ACCENT}; letter-spacing: .3px; }
  .letterhead .date { font-size: 13px; color: #666; font-family: -apple-system, Segoe UI, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 6px; }
  .badge { display: inline-block; font-family: -apple-system, Segoe UI, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; padding: 4px 12px; border-radius: 999px; margin-bottom: 18px; }
  .badge.warning { background: #fdeceb; color: #b3261e; }
  .badge.appreciation { background: #e8f5ec; color: #1e7a3d; }
  .to-block { font-family: -apple-system, Segoe UI, sans-serif; font-size: 13.5px; color: #444; margin-bottom: 26px; line-height: 1.6; }
  .to-block .k { color: #888; }
  .subject { font-weight: 700; margin-bottom: 20px; font-size: 15px; }
  .body p { font-size: 15px; line-height: 1.75; margin: 0 0 14px; }
  .sign-block { margin-top: 56px; font-family: -apple-system, Segoe UI, sans-serif; font-size: 13.5px; }
  .sign-block .line { width: 220px; border-top: 1px solid #999; margin-top: 46px; padding-top: 6px; color: #444; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .sheet { box-shadow: none; margin: 0; max-width: none; border-top: none; padding: 0; }
  }
</style>
</head>
<body>
  <div class="toolbar no-print"><button onclick="window.print()">Download as PDF</button></div>
  <div class="sheet">
    <div class="letterhead">
      <div class="company">${esc(companyName)}</div>
      <div class="date">${esc(Utils_formatDate(letter.date))}</div>
    </div>
    ${badgeHtml}
    <h1>${heading}</h1>
    <div class="to-block">
      <div><span class="k">To:</span> ${esc(employee.name)} (${esc(employee.uid)})</div>
      <div><span class="k">Designation:</span> ${esc(employee.designation || "Employee")}${employee.department ? ` &middot; ${esc(employee.department)}` : ""}</div>
    </div>
    <div class="subject">Subject: ${esc(letter.subject)}</div>
    <div class="body">${bodyHtml}</div>
    <div class="sign-block">
      <div class="line">${esc(letter.issuedBy)}<br/>Issued by</div>
    </div>
  </div>
</body>
</html>`;
  }

  /** The new tab is a standalone document with no access to the app's
   *  Utils module, so dates are formatted with this tiny local copy of
   *  Utils.formatDate's "D Mon YYYY" behavior instead. */
  function Utils_formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  return { open };
})();
