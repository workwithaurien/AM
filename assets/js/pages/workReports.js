/**
 * workReports.js — matches the "WorkReports" sheet schema:
 * ID | Date | Client Name | Employee Name | Work Type | Given | Completed | Rejected | Remark | Submitted At
 */
const PageWorkReports = (() => {
  const COLUMNS = [
    { key: "date", label: "Date" },
    { key: "clientName", label: "Client Name" },
    { key: "employeeName", label: "Employee Name" },
    { key: "workType", label: "Work Type" },
    { key: "given", label: "Given" },
    { key: "completed", label: "Completed" },
    { key: "rejected", label: "Rejected" },
    { key: "remark", label: "Remark" }
  ];
  const WORK_TYPES = ["Image Creatives", "Video Creatives", "Long Form Videos", "Short Form Videos", "Finding Influencers", "Others"];

  let allReports = [];
  let searchTerm = "";
  let dateFilter = "";
  let employeeFilter = "";

  async function render(mount) {
    const isAdmin = Auth.isAdmin();
    const res = await Api.call("getWorkReports");
    if (!res.ok) { mount.innerHTML = `<div class="empty-state">${res.error}</div>`; return; }
    // Newest first, so the most recent reports are easiest to find.
    allReports = res.reports.slice().sort((a, b) => b.date.localeCompare(a.date));

    // Admin sees everyone's reports, so give them a precise employee
    // filter too — not just the free-text client/employee search. Sourced
    // from the real employee directory (not just names seen in reports)
    // so an employee with zero reports still shows up, e.g. to confirm
    // they haven't submitted anything.
    let employeeOptions = [];
    if (isAdmin) {
      const empRes = await Api.call("getEmployees");
      employeeOptions = empRes.ok ? empRes.employees.map(e => e.name).sort() : [];
    }

    mount.innerHTML = `
      <div class="toolbar">
        <input class="input" style="max-width:240px" id="wrSearch" placeholder="Search client or employee..." value="${Utils.escapeHtml(searchTerm)}" />
        ${isAdmin ? `
          <select class="input" style="max-width:200px" id="wrEmployee">
            <option value="">All Employees</option>
            ${employeeOptions.map(name => `<option value="${Utils.escapeHtml(name)}" ${name === employeeFilter ? "selected" : ""}>${Utils.escapeHtml(name)}</option>`).join("")}
          </select>` : ""}
        <input class="input" type="date" style="max-width:170px" id="wrDate" value="${dateFilter}" />
        <div class="grow"></div>
        ${isAdmin ? "" : `<button class="btn" id="wrAddBtn">+ Submit Report</button>`}
      </div>
      <div id="wrTableHost"></div>
    `;

    document.getElementById("wrSearch").addEventListener("input", Utils.debounce(e => {
      searchTerm = e.target.value; renderTable();
    }, 200));
    document.getElementById("wrDate").addEventListener("change", e => {
      dateFilter = e.target.value; renderTable();
    });
    document.getElementById("wrEmployee")?.addEventListener("change", e => {
      employeeFilter = e.target.value; renderTable();
    });
    document.getElementById("wrAddBtn")?.addEventListener("click", () => openReportModal(null));

    renderTable();
  }

  function filtered() {
    return allReports.filter(r => {
      const term = searchTerm.toLowerCase();
      const matchesTerm = !term ||
        r.clientName.toLowerCase().includes(term) ||
        r.employeeName.toLowerCase().includes(term);
      const matchesDate = !dateFilter || r.date === dateFilter;
      const matchesEmployee = !employeeFilter || r.employeeName === employeeFilter;
      return matchesTerm && matchesDate && matchesEmployee;
    });
  }

  function renderTable() {
    const rawRows = filtered();
    const rows = rawRows.map(r => ({
      date: Utils.formatDate(r.date),
      clientName: Utils.escapeHtml(r.clientName),
      employeeName: Utils.escapeHtml(r.employeeName),
      workType: Badge.render(r.workType, "neutral"),
      given: r.given,
      completed: r.completed,
      rejected: r.rejected > 0 ? Badge.render(r.rejected, "danger") : Badge.render("0", "success"),
      remark: Utils.escapeHtml(r.remark || "—")
    }));
    const host = document.getElementById("wrTableHost");
    host.innerHTML = DataTable.render(COLUMNS, rows, {
      emptyText: "No work reports match your filters.",
      onRowClick: true // just for the "clickable" row style — actual handler wired below
    });
    // Click a row to edit that report — every report shown to the current
    // viewer is already one they're allowed to edit (getWorkReports_ only
    // ever returns an employee's own reports; admins see everyone's and
    // can edit anyone's), so no per-row permission check is needed here.
    DataTable.bindRowClicks(host, rawRows, openReportModal);
  }

  /** Shared by "+ Submit Report" and clicking a row to edit one.
   *  existing === null → new report (Submit); existing === a report
   *  object → editing it in place (Save Changes). Employee Name is
   *  always read-only — locked to whoever originally filed it. */
  function openReportModal(existing) {
    const user = Auth.getUser();
    const isEdit = !!existing;
    const isKnownType = existing && WORK_TYPES.includes(existing.workType);
    const initialWorkType = isEdit ? (isKnownType ? existing.workType : "Others") : WORK_TYPES[0];
    const initialOtherValue = isEdit && !isKnownType ? existing.workType : "";

    const bodyHtml = `
      <form id="wrForm">
        <div class="field"><label>Date</label>
          <input class="input" type="date" name="date" value="${isEdit ? existing.date : Utils.todayIso()}" required /></div>
        <div class="field"><label>Client Name</label>
          <input class="input" type="text" name="clientName" value="${isEdit ? Utils.escapeHtml(existing.clientName) : ""}" required /></div>
        <div class="field"><label>Employee Name</label>
          <input class="input" type="text" name="employeeName" value="${Utils.escapeHtml(isEdit ? existing.employeeName : user.name)}" readonly />
          <span class="card-sub" style="margin-top:-2px">${isEdit ? "Not editable" : "Filled automatically from your login — not editable"}</span></div>
        <div class="field"><label>Work Type</label>
          <select class="input" name="workType" id="wrWorkType">
            ${WORK_TYPES.map(v => `<option value="${v}" ${v === initialWorkType ? "selected" : ""}>${v}</option>`).join("")}
          </select></div>
        <div class="field" id="wrWorkTypeOtherField" style="display:${initialWorkType === "Others" ? "" : "none"}">
          <label>Please specify</label>
          <input class="input" type="text" name="workTypeOther" id="wrWorkTypeOther" placeholder="e.g. Podcast Editing" value="${Utils.escapeHtml(initialOtherValue)}" ${initialWorkType === "Others" ? "required" : ""} /></div>
        <div class="grid grid-3">
          <div class="field"><label>Given</label><input class="input" type="number" min="0" name="given" value="${isEdit ? existing.given : 0}" required /></div>
          <div class="field"><label>Completed</label><input class="input" type="number" min="0" name="completed" value="${isEdit ? existing.completed : 0}" required /></div>
          <div class="field"><label>Rejected</label><input class="input" type="number" min="0" name="rejected" value="${isEdit ? existing.rejected : 0}" required /></div>
        </div>
        <div class="field"><label>Remark</label>
          <textarea class="input" name="remark" rows="2">${isEdit ? Utils.escapeHtml(existing.remark || "") : ""}</textarea></div>
      </form>
    `;
    const footerHtml = `
      <button class="btn secondary" id="wrCancel" type="button">Cancel</button>
      <button class="btn" id="wrSubmit" type="submit" form="wrForm">${isEdit ? "Save Changes" : "Submit"}</button>
    `;
    const overlay = Modal.open({ title: isEdit ? "Edit Work Report" : "Submit Work Report", bodyHtml, footerHtml });
    overlay.querySelector("#wrCancel").addEventListener("click", Modal.close);

    // "Others" swaps in a free-text field — the typed value is what
    // actually gets saved as Work Type, not the literal word "Others".
    const workTypeSelect = overlay.querySelector("#wrWorkType");
    const otherField = overlay.querySelector("#wrWorkTypeOtherField");
    const otherInput = overlay.querySelector("#wrWorkTypeOther");
    workTypeSelect.addEventListener("change", () => {
      const isOther = workTypeSelect.value === "Others";
      otherField.style.display = isOther ? "" : "none";
      otherInput.required = isOther;
    });

    overlay.querySelector("#wrForm").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      if (payload.workType === "Others") payload.workType = payload.workTypeOther.trim();
      delete payload.workTypeOther;
      delete payload.employeeName; // never sent — locked server-side too
      ["given", "completed", "rejected"].forEach(k => (payload[k] = Number(payload[k])));
      if (isEdit) payload.id = existing.id;
      const res = await Api.call(isEdit ? "updateWorkReport" : "submitWorkReport", payload);
      if (res.ok) {
        Toast.show(isEdit ? "Work report updated" : "Work report submitted", "success");
        Modal.close();
        render(document.getElementById("content"));
      } else {
        Toast.show(res.error || `Could not ${isEdit ? "update" : "submit"} report`, "error");
      }
    });
  }

  return { render };
})();
