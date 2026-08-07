/**
 * workReports.js — matches the "WorkReports" sheet schema:
 * Date | Client Name | Employee Name | Work Type | Given | Completed | Rejected | Remark
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
    const isAdmin = Auth.getUser().role === "admin";
    const res = await Api.call("getWorkReports");
    if (!res.ok) { mount.innerHTML = `<div class="empty-state">${res.error}</div>`; return; }
    allReports = res.reports;

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
    document.getElementById("wrAddBtn")?.addEventListener("click", openSubmitModal);

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
    const rows = filtered().map(r => ({
      date: Utils.formatDate(r.date),
      clientName: Utils.escapeHtml(r.clientName),
      employeeName: Utils.escapeHtml(r.employeeName),
      workType: Badge.render(r.workType, "neutral"),
      given: r.given,
      completed: r.completed,
      rejected: r.rejected > 0 ? Badge.render(r.rejected, "danger") : Badge.render("0", "success"),
      remark: Utils.escapeHtml(r.remark || "—")
    }));
    document.getElementById("wrTableHost").innerHTML = DataTable.render(COLUMNS, rows, {
      emptyText: "No work reports match your filters."
    });
  }

  function openSubmitModal() {
    const user = Auth.getUser();
    const bodyHtml = `
      <form id="wrForm">
        <div class="field"><label>Date</label>
          <input class="input" type="date" name="date" value="${Utils.todayIso()}" required /></div>
        <div class="field"><label>Client Name</label>
          <input class="input" type="text" name="clientName" required /></div>
        <div class="field"><label>Employee Name</label>
          <input class="input" type="text" name="employeeName" value="${Utils.escapeHtml(user.name)}" readonly />
          <span class="card-sub" style="margin-top:-2px">Filled automatically from your login — not editable</span></div>
        <div class="field"><label>Work Type</label>
          <select class="input" name="workType" id="wrWorkType">
            ${WORK_TYPES.map(v => `<option value="${v}">${v}</option>`).join("")}
          </select></div>
        <div class="field" id="wrWorkTypeOtherField" style="display:none">
          <label>Please specify</label>
          <input class="input" type="text" name="workTypeOther" id="wrWorkTypeOther" placeholder="e.g. Podcast Editing" /></div>
        <div class="grid grid-3">
          <div class="field"><label>Given</label><input class="input" type="number" min="0" name="given" value="0" required /></div>
          <div class="field"><label>Completed</label><input class="input" type="number" min="0" name="completed" value="0" required /></div>
          <div class="field"><label>Rejected</label><input class="input" type="number" min="0" name="rejected" value="0" required /></div>
        </div>
        <div class="field"><label>Remark</label>
          <textarea class="input" name="remark" rows="2"></textarea></div>
      </form>
    `;
    const footerHtml = `
      <button class="btn secondary" id="wrCancel" type="button">Cancel</button>
      <button class="btn" id="wrSubmit" type="submit" form="wrForm">Submit</button>
    `;
    const overlay = Modal.open({ title: "Submit Work Report", bodyHtml, footerHtml });
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
      ["given", "completed", "rejected"].forEach(k => (payload[k] = Number(payload[k])));
      const res = await Api.call("submitWorkReport", payload);
      if (res.ok) {
        Toast.show("Work report submitted", "success");
        Modal.close();
        render(document.getElementById("content"));
      } else {
        Toast.show(res.error || "Could not submit report", "error");
      }
    });
  }

  return { render };
})();
