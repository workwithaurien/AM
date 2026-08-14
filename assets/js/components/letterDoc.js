/**
 * letterDoc.js — opens a formatted, printable Warning/Appreciation letter
 * in a new tab (branded letterhead, warning-number badge, subject, body,
 * signature block) with a "Download as PDF" button that uses the
 * browser's native print-to-PDF (window.print()) — no external library
 * or server-side rendering needed, and it works identically everywhere
 * a browser does.
 *
 * The tab is opened as a Blob URL rather than document.write()-ing into
 * about:blank, so it doesn't just sit there labeled "about:blank" in
 * the tab strip/history. A tiny "Loading…" blob is opened synchronously
 * (inside the click handler, so popup blockers don't kill it), then
 * swapped via win.location.href once Settings (for the letterhead's
 * company name) comes back.
 */
const LetterDoc = (() => {
  const NAVY = "#1A1A2E";
  const GOLD = "#D4930A";

  // The only three people who can sign a Warning/Appreciation letter —
  // hardcoded per the brief, not sheet-driven. employees.js's "Issued
  // By" dropdown reads this same list, so there's exactly one place to
  // update if the set of signatories ever changes.
  const SIGNATORIES = [
    { name: "Rohit Shah", title: "Founder & CEO", company: "Aurien Media" },
    { name: "Yashvi Joshi", title: "CEO's EA", company: "Aurien Media" },
    { name: "Tarun Sinha", title: "Chief Operating Officer", company: "Aurien Media" }
  ];

  function open(letter, employee) {
    const loadingUrl = blobUrl("<p style=\"font-family:sans-serif;padding:40px;color:#666\">Loading letter…</p>");
    const win = window.open(loadingUrl, "_blank");
    if (!win) { alert("Please allow pop-ups for this site to view/download the letter."); return; }

    // Resolved against the app's own URL (not the new tab's) — this is
    // always a real, loadable path whether running locally or on
    // GitHub Pages under a subpath, unlike a plain relative src which
    // has no meaningful base once the logo is embedded in a blob doc.
    const logoUrl = new URL("assets/images/Logo.png", document.baseURI).href;

    Api.call("getSettings").then(res => {
      const companyName = res.ok && res.companyName ? res.companyName : "Aurien Media";
      win.location.href = blobUrl(html(letter, employee, companyName, logoUrl));
      URL.revokeObjectURL(loadingUrl);
    });
  }

  /** Blob URLs with a bare "text/html" MIME type have no declared
   *  charset, so without a <meta charset> tag in the HTML itself (the
   *  "Loading…" placeholder doesn't have one) the browser can fall back
   *  to Latin-1 and mangle any non-ASCII character — e.g. "…" turning
   *  into "â€¦". Declaring charset=utf-8 on the Blob itself fixes it
   *  for every caller, not just ones that remember to add the tag. */
  function blobUrl(htmlString) {
    return URL.createObjectURL(new Blob([htmlString], { type: "text/html;charset=utf-8" }));
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

  /** Name/Title/Company signature block for a known signatory; falls
   *  back to just the raw name for a letter issued before this dropdown
   *  existed (or by someone no longer in SIGNATORIES), same
   *  degrade-gracefully approach used elsewhere in this app. */
  function signatureHtml(issuedBy) {
    const s = SIGNATORIES.find(x => x.name === issuedBy);
    if (!s) return `<div class="sig-name">${esc(issuedBy)}</div>`;
    return `<div class="sig-name">${esc(s.name)}</div><div class="sig-role">${esc(s.title)}</div><div class="sig-company">${esc(s.company)}</div>`;
  }

  /** Returns two grid ITEMS (label, value), not a wrapping row div — the
   *  label/value columns come from .meta-block's own grid-template-
   *  columns, so every metaRow() call has to feed cells straight into
   *  that same grid for the rows to stack correctly instead of being
   *  auto-placed two-per-row. */
  function metaRow(label, value) {
    return `<span class="meta-label">${esc(label)}</span><span class="meta-value">${esc(value)}</span>`;
  }

  function html(letter, employee, companyName, logoUrl) {
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
    const metaHtml = [
      metaRow("To", employee.name),
      metaRow("Employee ID", employee.uid),
      metaRow("Designation", employee.designation || "Employee"),
      employee.department ? metaRow("Department", employee.department) : ""
    ].join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${heading} — ${esc(employee.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; background: #f4f5f7; }
  .toolbar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e2e4e9; padding: 14px 24px; display: flex; justify-content: flex-end; gap: 10px; }
  .toolbar button { font-family: -apple-system, Segoe UI, sans-serif; font-size: 14px; font-weight: 600; padding: 9px 18px; border-radius: 8px; border: none; cursor: pointer; background: ${NAVY}; color: #fff; }
  .sheet { max-width: 760px; margin: 32px auto; background: #fff; padding: 48px 64px 56px; box-shadow: 0 1px 4px rgba(0,0,0,.12); }

  .brand-row { display: flex; align-items: center; gap: 12px; }
  .brand-row img { width: 42px; height: 42px; flex-shrink: 0; }
  .brand-row .brand-name { font-size: 21px; font-weight: 700; color: ${NAVY}; letter-spacing: .3px; }
  .date-line { text-align: right; font-family: -apple-system, Segoe UI, sans-serif; font-size: 13px; color: #666; margin-top: -30px; }
  .accent-rule { border: none; border-top: 3px solid ${GOLD}; margin: 18px 0 26px; }

  h1 { font-size: 20px; margin: 0 0 16px; color: ${NAVY}; }
  .badge { display: inline-block; font-family: -apple-system, Segoe UI, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; padding: 4px 12px; border-radius: 999px; margin-bottom: 14px; }
  .badge.warning { background: #fdeceb; color: #b3261e; }
  .badge.appreciation { background: #e8f5ec; color: #1e7a3d; }

  .meta-block { font-family: -apple-system, Segoe UI, sans-serif; font-size: 13.5px; margin-bottom: 28px; display: grid; grid-template-columns: 130px 1fr; row-gap: 8px; column-gap: 14px; }
  .meta-label { font-weight: 700; color: ${GOLD}; text-transform: uppercase; font-size: 11.5px; letter-spacing: .4px; align-self: center; }
  .meta-value { color: #262626; }

  .subject { margin-bottom: 20px; font-size: 15px; }
  .subject-label { font-weight: 700; color: ${NAVY}; }

  .body p { font-size: 15px; line-height: 1.75; margin: 0 0 14px; }

  .sign-block { margin-top: 64px; font-family: -apple-system, Segoe UI, sans-serif; font-size: 13.5px; }
  .sign-block .sign-rule { width: 240px; border: none; border-top: 2px solid ${GOLD}; margin: 0 0 12px; }
  .sign-block .sig-name { font-weight: 700; color: ${NAVY}; font-size: 15px; }
  .sign-block .sig-role, .sign-block .sig-company { color: #666; margin-top: 2px; }

  @page { margin: 16mm 18mm; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .sheet { box-shadow: none; margin: 0; max-width: none; padding: 0; }
  }
</style>
</head>
<body>
  <div class="toolbar no-print"><button onclick="window.print()">Download as PDF</button></div>
  <div class="sheet">
    <div class="brand-row">
      <img src="${logoUrl}" alt="${esc(companyName)}" />
      <span class="brand-name">${esc(companyName)}</span>
    </div>
    <div class="date-line">${esc(Utils_formatDate(letter.date))}</div>
    <hr class="accent-rule" />

    ${badgeHtml}
    <h1>${heading}</h1>

    <div class="meta-block">${metaHtml}</div>

    <div class="subject"><span class="subject-label">Subject:</span> ${esc(letter.subject)}</div>
    <div class="body">${bodyHtml}</div>

    <div class="sign-block">
      <hr class="sign-rule" />
      ${signatureHtml(letter.issuedBy)}
    </div>
  </div>
</body>
</html>`;
  }

  /** The new tab is a standalone document with no access to the app's
   *  Utils module, so dates are formatted with this tiny local copy of
   *  Utils.formatDate's "D Mon YYYY" behavior instead — deliberately
   *  one fixed format, not the browser's locale-dependent default. */
  function Utils_formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  return { open, SIGNATORIES };
})();
