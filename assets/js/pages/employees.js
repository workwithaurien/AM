/**
 * employees.js — admin directory with detail drawer + quick actions.
 */
const PageEmployees = (() => {
  let all = [];

  async function render(mount) {
    const res = await Api.call("getEmployees");
    if (!res.ok) { mount.innerHTML = `<div class="empty-state">${res.error}</div>`; return; }
    all = res.employees;

    mount.innerHTML = `
      <div class="emp-page">
        <div class="toolbar">
          <input class="input" style="max-width:260px" id="empSearch" placeholder="Search employees..." />
          <div class="grow"></div>
          <button class="btn" id="empAddBtn">+ Add Employee</button>
        </div>
        <div class="grid grid-4" id="empGrid"></div>
      </div>
      <div class="bottom-actions">
        <button class="btn secondary" id="baAssignTask">Assign Task</button>
        <button class="btn secondary" id="baApproveLeaves">Approve Leaves</button>
        <button class="btn secondary" id="baAttendance">Attendance</button>
      </div>
    `;

    document.getElementById("empAddBtn").addEventListener("click", openAddEmployeeModal);
    document.getElementById("empSearch").addEventListener("input", Utils.debounce(e => renderGrid(e.target.value), 200));
    document.getElementById("baAssignTask").addEventListener("click", () => openAssignDailyTaskModal());
    document.getElementById("baApproveLeaves").addEventListener("click", openApproveLeavesModal);
    document.getElementById("baAttendance").addEventListener("click", openAttendanceViewModal);

    renderGrid("");
  }

  function renderGrid(term) {
    const list = all.filter(e => e.name.toLowerCase().includes(term.toLowerCase()));
    const grid = document.getElementById("empGrid");
    grid.innerHTML = list.map((e, i) => `
      <div class="emp-card" data-index="${i}">
        <div class="e-top">
          <div class="emp-avatar">${Utils.avatarInner(e)}</div>
          <div>
            <div class="emp-name">${Utils.escapeHtml(e.name)}</div>
            <div class="emp-role">${Utils.escapeHtml(e.designation)}</div>
          </div>
        </div>
        <div class="emp-details">
          <div><span class="k">Department</span><span class="v">${Utils.escapeHtml(e.department || "—")}</span></div>
          <div><span class="k">Employment</span><span class="v">${Utils.escapeHtml(e.employmentType)}</span></div>
        </div>
        <div class="emp-details">
          <div><span class="k">Login</span><span class="v">${Utils.escapeHtml(e.todayLoginTime || "—")}</span></div>
          <div><span class="k">Break</span><span class="v">${Utils.escapeHtml(e.todayBreakStart || "—")}</span></div>
          <div><span class="k">Break Over</span><span class="v">${Utils.escapeHtml(e.todayBreakEnd || "—")}</span></div>
          <div><span class="k">Logout</span><span class="v">${Utils.escapeHtml(e.todayLogoutTime || "—")}</span></div>
          <div><span class="k">Report</span><span class="v">${Utils.escapeHtml(e.todayReportTime || "—")}</span></div>
        </div>
        <div class="emp-meta">
          ${Badge.render(e.status, e.status === "Active" ? "success" : "neutral")}
          ${Badge.render(e.attendanceToday, e.attendanceToday === "Present" ? "success" : e.attendanceToday === "Absent" ? "danger" : "neutral")}
          ${Badge.render(e.reportSubmittedToday ? "Reported" : "No Report", e.reportSubmittedToday ? "success" : "warning")}
          ${e.onBreak ? Badge.render("ON BREAK", "warning") : ""}
        </div>
        ${e.pendingRequestsCount > 0 ? `
          <div class="emp-pending">${e.pendingRequestsCount} Pending Request${e.pendingRequestsCount === 1 ? "" : "s"} — tap to review</div>` : ""}
      </div>`).join("") || `<div class="empty-state">No employees match "${Utils.escapeHtml(term)}".</div>`;

    grid.querySelectorAll(".emp-card").forEach(card => {
      card.addEventListener("click", () => openDrawer(list[Number(card.dataset.index)]));
    });
  }

  async function openDrawer(emp) {
    // Fetch this employee's real reports + salary + attendance history
    // before opening, so every drawer tab can render synchronously off
    // already-loaded data.
    const [reportsRes, salaryRes, attRes] = await Promise.all([
      Api.call("getWorkReports", { employeeName: emp.name }),
      Api.call("getSalary", { uid: emp.uid }),
      Api.call("getAttendanceCalendar", { uid: emp.uid })
    ]);
    const empReports = reportsRes.ok ? reportsRes.reports : [];
    const empSalary = salaryRes.ok ? salaryRes.salary : null;
    // Newest first, same convention as Work Reports.
    const empAttendance = (attRes.ok ? attRes.records : []).slice().sort((a, b) => b.date.localeCompare(a.date));

    const footerHtml = `<button class="btn ${emp.status === "Disabled" ? "" : "danger"} sm" id="statusBtn">${emp.status === "Disabled" ? "Enable Employee" : "Disable Employee"}</button>`;
    const drawer = Drawer.open({
      title: emp.name,
      avatarHtml: Utils.avatarInner(emp),
      footerHtml,
      tabs: [
        { id: "basic", label: "Basic Info", render: () => `
          <div class="info-list">
            <div><div class="k">Employee ID</div><div class="v">${Utils.escapeHtml(emp.uid)}</div></div>
            <div><div class="k">Designation</div><div class="v">${Utils.escapeHtml(emp.designation)}</div></div>
            <div><div class="k">Department</div><div class="v">${Utils.escapeHtml(emp.department || "—")}</div></div>
            <div><div class="k">Employment Type</div><div class="v">${Utils.escapeHtml(emp.employmentType)}</div></div>
            <div><div class="k">Status</div><div class="v">${Badge.render(emp.status, "success")}</div></div>
          </div>` },
        { id: "attendance", label: "Attendance", render: () => DataTable.render(
            [{ key: "date", label: "Date" }, { key: "status", label: "Status" }, { key: "loginTime", label: "Login" }, { key: "logoutTime", label: "Logout" }],
            empAttendance.map(r => ({
              date: Utils.formatDate(r.date),
              status: Badge.render(r.status, r.status === "Present" ? "success" : r.status === "Absent" ? "danger" : r.status === "Leave" ? "warning" : "neutral"),
              loginTime: r.loginTime || "—",
              logoutTime: r.logoutTime || "—"
            })),
            { emptyText: "No attendance records yet." }
          ) },
        { id: "salary", label: "Salary", render: () => empSalary ? `
            <div class="grid grid-2">
              ${Card.stat({ label: "Monthly Salary", value: Utils.currency(empSalary.monthlySalary) })}
              ${Card.stat({ label: "Advance Taken", value: Utils.currency(empSalary.advanceTaken) })}
            </div>
            <div style="margin-top:10px">
              ${Card.stat({ label: "Net Payable", value: Utils.currency(empSalary.monthlySalary - empSalary.advanceTaken) })}
            </div>
            <div class="card-sub" style="margin-top:10px">Present days &amp; real-time earnings use the same calculator as the employee's own Salary page.</div>
          ` : `<div class="card-sub">No salary record for this employee yet — use "Update Salary" below to create one.</div>` },
        { id: "reports", label: "Work Reports", render: () => DataTable.render(
            [{ key: "date", label: "Date" }, { key: "client", label: "Client" }, { key: "type", label: "Type" }],
            empReports.map(r => ({ date: Utils.formatDate(r.date), client: r.clientName, type: r.workType }))
          ) },
        { id: "documents", label: "Documents", render: () => emp.documentsFolderUrl
            ? `<a class="btn secondary sm" href="${Utils.escapeHtml(emp.documentsFolderUrl)}" target="_blank" rel="noopener">Open Documents Folder</a>`
            : `<div class="card-sub">No documents folder linked yet — add one from "Edit Details" below.</div>` }
      ]
    });

    const actionsHtml = `
      <div class="section-head" style="margin-top:0"><h2>Quick Actions</h2></div>
      <div class="btn-row">
        <button class="btn secondary sm" data-act="warning">Issue Warning</button>
        <button class="btn secondary sm" data-act="note">Performance Note</button>
        <button class="btn secondary sm" data-act="appreciation">Issue Appreciation</button>
        <button class="btn secondary sm" data-act="leave">Approve Leave${emp.pendingLeaveCount ? ` (${emp.pendingLeaveCount})` : ""}</button>
        <button class="btn secondary sm" data-act="advance">Approve Advance${emp.pendingAdvanceCount ? ` (${emp.pendingAdvanceCount})` : ""}</button>
        <button class="btn secondary sm" data-act="salary">Update Salary</button>
        <button class="btn secondary sm" data-act="details">Edit Details</button>
        <button class="btn secondary sm" data-act="dailyTask">Assign Daily Task</button>
      </div>`;
    drawer.querySelector(".drawer-body").insertAdjacentHTML("beforeend", actionsHtml);
    drawer.querySelectorAll("[data-act]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.act === "salary") { openUpdateSalaryModal(emp, empSalary); return; }
        if (btn.dataset.act === "details") { openEditDetailsModal(emp); return; }
        if (btn.dataset.act === "dailyTask") { openAssignDailyTaskModal(emp); return; }
        if (btn.dataset.act === "leave") { openApprovalsModal(emp, "leave"); return; }
        if (btn.dataset.act === "advance") { openApprovalsModal(emp, "advance"); return; }
        if (LETTER_TYPES[btn.dataset.act]) { openIssueLetterModal(emp, LETTER_TYPES[btn.dataset.act]); return; }
      });
    });
    drawer.querySelector("#statusBtn").addEventListener("click", async () => {
      const disabling = emp.status !== "Disabled";
      const verb = disabling ? "Disable" : "Enable";
      if (!confirm(`${verb} ${emp.name}? ${disabling ? "They will lose login access." : "They will regain login access."}`)) return;
      const res = await Api.call("setEmployeeStatus", { uid: emp.uid, status: disabling ? "Disabled" : "Active" });
      if (res.ok) {
        emp.status = disabling ? "Disabled" : "Active";
        const btn = drawer.querySelector("#statusBtn");
        btn.textContent = emp.status === "Disabled" ? "Enable Employee" : "Disable Employee";
        btn.classList.toggle("danger", emp.status !== "Disabled");
        Toast.show(`${emp.name} ${emp.status === "Disabled" ? "disabled" : "enabled"}`, "success");
      } else {
        Toast.show(res.error || "Could not update employee status", "error");
      }
    });
  }

  const LETTER_TYPES = { warning: "Warning", note: "Note", appreciation: "Appreciation" };

  /** Shared by Issue Warning / Performance Note / Issue Appreciation — all
   *  three just write a row to the Letters sheet with a different Type. */
  function openIssueLetterModal(emp, type) {
    const bodyHtml = `
      <form id="letterForm">
        <div class="field"><label>Message</label>
          <textarea class="input" name="message" rows="4" placeholder="What's this about?" required></textarea></div>
      </form>`;
    const footerHtml = `
      <button class="btn secondary" type="button" id="letterCancel">Cancel</button>
      <button class="btn" type="submit" form="letterForm">Issue</button>`;
    const overlay = Modal.open({ title: `${type} — ${emp.name}`, bodyHtml, footerHtml });
    overlay.querySelector("#letterCancel").addEventListener("click", Modal.close);
    overlay.querySelector("#letterForm").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const res = await Api.call("issueLetter", { uid: emp.uid, type, message: fd.get("message") });
      if (res.ok) {
        Toast.show(`${type} issued`, "success");
        Modal.close();
      } else {
        Toast.show(res.error || "Could not issue this", "error");
      }
    });
  }

  /** Shared by Approve Leave / Approve Advance — lists this employee's
   *  requests of that kind with Approve/Reject buttons on the pending
   *  ones, and just a status badge on ones already decided. */
  async function openApprovalsModal(emp, kind) {
    const isLeave = kind === "leave";
    const res = await Api.call(isLeave ? "getLeaves" : "getAdvanceRequests", { uid: emp.uid });
    const items = res.ok ? (isLeave ? res.leaves : res.requests) : [];

    const rowHtml = item => `
      <div class="approval-row">
        <div>
          <div>${isLeave
            ? `<strong>${Utils.escapeHtml(item.type)}</strong> (${item.duration === "Half Day" ? "Half Day" : "Full Day"}) — ${Utils.formatDate(item.from)} to ${Utils.formatDate(item.to)}`
            : `<strong>${Utils.currency(item.amount)}</strong>`}</div>
          <div class="card-sub">${Utils.escapeHtml(item.reason || "No reason given")}</div>
        </div>
        <div class="approval-actions">
          ${item.status === "Pending"
            ? `<button class="btn secondary sm" data-approve="${item.id}">Approve</button><button class="btn danger sm" data-reject="${item.id}">Reject</button>`
            : Badge.render(item.status, item.status === "Approved" ? "success" : "danger")}
        </div>
      </div>`;

    const bodyHtml = items.length
      ? `<div class="approval-list">${items.map(rowHtml).join("")}</div>`
      : `<div class="card-sub">No ${isLeave ? "leave" : "advance salary"} requests from ${Utils.escapeHtml(emp.name)} yet.</div>`;

    const overlay = Modal.open({ title: `${isLeave ? "Leave" : "Advance Salary"} Requests — ${emp.name}`, bodyHtml });

    const decide = async (id, status) => {
      const res2 = await Api.call(isLeave ? "approveLeave" : "approveAdvance", { id, status });
      if (res2.ok) {
        Toast.show(`Request ${status.toLowerCase()}`, "success");
        openApprovalsModal(emp, kind); // reopen with the refreshed list
      } else {
        Toast.show(res2.error || "Could not update the request", "error");
      }
    };
    overlay.querySelectorAll("[data-approve]").forEach(btn => btn.addEventListener("click", () => decide(btn.dataset.approve, "Approved")));
    overlay.querySelectorAll("[data-reject]").forEach(btn => btn.addEventListener("click", () => decide(btn.dataset.reject, "Rejected")));
  }

  /** Bottom-bar "Approve Leaves" — every employee's leave requests in one
   *  list (pending first), so admin doesn't need to open each card just
   *  to clear the queue. getLeaves with no uid returns everyone's when
   *  the caller is admin. */
  async function openApproveLeavesModal() {
    const res = await Api.call("getLeaves", {});
    const leaves = res.ok ? res.leaves : [];
    const nameFor = uid => (all.find(e => e.uid === uid) || {}).name || uid;
    const sorted = [...leaves].sort((a, b) => (a.status === "Pending" ? 0 : 1) - (b.status === "Pending" ? 0 : 1));

    const rowHtml = item => `
      <div class="approval-row">
        <div>
          <div><strong>${Utils.escapeHtml(nameFor(item.uid))}</strong> — ${Utils.escapeHtml(item.type)} (${item.duration}) — ${Utils.formatDate(item.from)} to ${Utils.formatDate(item.to)}</div>
          <div class="card-sub">${Utils.escapeHtml(item.reason || "No reason given")}</div>
        </div>
        <div class="approval-actions">
          ${item.status === "Pending"
            ? `<button class="btn secondary sm" data-approve="${item.id}">Approve</button><button class="btn danger sm" data-reject="${item.id}">Reject</button>`
            : Badge.render(item.status, item.status === "Approved" ? "success" : "danger")}
        </div>
      </div>`;

    const bodyHtml = sorted.length
      ? `<div class="approval-list">${sorted.map(rowHtml).join("")}</div>`
      : `<div class="card-sub">No leave requests yet.</div>`;
    const overlay = Modal.open({ title: "Leave Requests — All Employees", bodyHtml, wide: true });

    const decide = async (id, status) => {
      const res2 = await Api.call("approveLeave", { id, status });
      if (res2.ok) {
        Toast.show(`Request ${status.toLowerCase()}`, "success");
        openApproveLeavesModal(); // reopen with the refreshed list
      } else {
        Toast.show(res2.error || "Could not update the request", "error");
      }
    };
    overlay.querySelectorAll("[data-approve]").forEach(btn => btn.addEventListener("click", () => decide(btn.dataset.approve, "Approved")));
    overlay.querySelectorAll("[data-reject]").forEach(btn => btn.addEventListener("click", () => decide(btn.dataset.reject, "Rejected")));
  }

  /** Bottom-bar "Attendance" — pick any employee and browse their
   *  attendance month by month using the same calendar grid + legend as
   *  the employee's own Attendance page (Calendar.monthGrid), plus
   *  Present/Absent/Paid Leave totals for the month in view. */
  function openAttendanceViewModal() {
    let viewYear = new Date().getFullYear();
    let viewMonth = new Date().getMonth();
    let holidays = [];
    let holidaysLoaded = false;
    const cache = {}; // uid -> records, so browsing months doesn't re-fetch

    const bodyHtml = `
      <div class="field"><label>Employee</label>
        <select class="input" id="attEmp">
          <option value="">Select employee...</option>
          ${all.map(e => `<option value="${e.uid}">${Utils.escapeHtml(e.name)}</option>`).join("")}
        </select></div>
      <div id="attResult" style="margin-top:10px"><div class="card-sub">Select an employee to view their attendance.</div></div>
    `;
    const overlay = Modal.open({ title: "Employee Attendance", bodyHtml, xl: true });

    const renderCalendar = uid => {
      const records = cache[uid] || [];
      const inMonth = iso => {
        const d = new Date(iso + "T00:00:00");
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
      };
      const present = records.filter(r => r.status === "Present" && inMonth(r.date)).length;
      const absent = records.filter(r => r.status === "Absent" && inMonth(r.date)).length;
      const leave = records.filter(r => r.status === "Leave" && inMonth(r.date)).length;

      const wrap = overlay.querySelector("#attResult");
      wrap.innerHTML = `
        <div class="grid grid-3">
          ${Card.stat({ label: "Total Present", value: present })}
          ${Card.stat({ label: "Total Absent", value: absent })}
          ${Card.stat({ label: "Total Paid Leaves", value: leave })}
        </div>
        <div class="toolbar" style="margin:16px 0 0;justify-content:center">
          <div class="month-nav">
            <button class="icon-btn" id="attPrev" type="button">‹</button>
            <div class="m-label">${Calendar.monthLabel(viewYear, viewMonth)}</div>
            <button class="icon-btn" id="attNext" type="button">›</button>
          </div>
        </div>
        <div class="legend">
          <span class="legend-item"><span class="legend-dot present"></span>Present</span>
          <span class="legend-item"><span class="legend-dot absent"></span>Absent</span>
          <span class="legend-item"><span class="legend-dot leave"></span>Leave</span>
          <span class="legend-item"><span class="legend-dot holiday"></span>Holiday</span>
        </div>
        ${Calendar.monthGrid(viewYear, viewMonth, holidays, records)}
      `;
      wrap.querySelector("#attPrev").addEventListener("click", () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } renderCalendar(uid); });
      wrap.querySelector("#attNext").addEventListener("click", () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } renderCalendar(uid); });
    };

    const load = async () => {
      const uid = overlay.querySelector("#attEmp").value;
      const wrap = overlay.querySelector("#attResult");
      if (!uid) { wrap.innerHTML = `<div class="card-sub">Select an employee to view their attendance.</div>`; return; }
      wrap.innerHTML = `<div class="card-sub">Loading...</div>`;
      if (!cache[uid]) {
        const res = await Api.call("getAttendanceCalendar", { uid });
        if (!res.ok) { wrap.innerHTML = `<div class="empty-state">${res.error}</div>`; return; }
        cache[uid] = res.records;
      }
      if (!holidaysLoaded) {
        const holRes = await Api.call("getHolidays");
        holidays = holRes.ok ? holRes.holidays : [];
        holidaysLoaded = true;
      }
      viewYear = new Date().getFullYear();
      viewMonth = new Date().getMonth();
      renderCalendar(uid);
    };
    overlay.querySelector("#attEmp").addEventListener("change", load);
  }

  /** A small live calculator: edit Monthly Salary / Advance Taken and see
   *  the resulting Net Payable update immediately, then save to the sheet. */
  function openUpdateSalaryModal(emp, currentSalary) {
    const base = currentSalary || { monthlySalary: 0, advanceTaken: 0 };
    const bodyHtml = `
      <form id="salForm">
        <div class="field"><label>Monthly Salary</label>
          <input class="input" type="number" min="0" name="monthlySalary" value="${base.monthlySalary}" required /></div>
        <div class="field"><label>Advance Taken</label>
          <input class="input" type="number" min="0" name="advanceTaken" value="${base.advanceTaken}" required /></div>
        <div class="card">
          <div class="card-label">Net Payable Preview</div>
          <div class="card-value" id="salPreview">${Utils.currency(base.monthlySalary - base.advanceTaken)}</div>
          <div class="card-sub">Monthly salary − advance taken. Present-day proration is applied on the Salary page itself.</div>
        </div>
      </form>`;
    const footerHtml = `
      <button class="btn secondary" type="button" id="salCancel">Cancel</button>
      <button class="btn" type="submit" form="salForm">Save Salary</button>`;
    const overlay = Modal.open({ title: `Update Salary — ${emp.name}`, bodyHtml, footerHtml });

    const recalc = () => {
      const ms = Number(overlay.querySelector('[name="monthlySalary"]').value) || 0;
      const adv = Number(overlay.querySelector('[name="advanceTaken"]').value) || 0;
      overlay.querySelector("#salPreview").textContent = Utils.currency(ms - adv);
    };
    overlay.querySelectorAll("#salForm input").forEach(inp => inp.addEventListener("input", recalc));
    overlay.querySelector("#salCancel").addEventListener("click", Modal.close);
    overlay.querySelector("#salForm").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const res = await Api.call("updateSalary", {
        uid: emp.uid,
        monthlySalary: fd.get("monthlySalary"),
        advanceTaken: fd.get("advanceTaken")
      });
      if (res.ok) {
        Toast.show("Salary updated", "success");
        Modal.close();
      } else {
        Toast.show(res.error || "Could not update salary", "error");
      }
    });
  }

  const EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Intern"];

  /** Designation, Department, and Employment Type together — only Full
   *  Time gets the 1.5 paid-leave-days/month rule in the Salary
   *  calculation; Part Time and Intern Leave days stay unpaid. */
  function openEditDetailsModal(emp) {
    const bodyHtml = `
      <form id="detForm">
        <div class="field"><label>Designation</label>
          <input class="input" type="text" name="designation" value="${Utils.escapeHtml(emp.designation || "")}" placeholder="e.g. Video Editor" /></div>
        <div class="field"><label>Department</label>
          <input class="input" type="text" name="department" value="${Utils.escapeHtml(emp.department || "")}" placeholder="e.g. Creative" /></div>
        <div class="field"><label>Employment Type</label>
          <select class="input" name="employmentType">
            ${EMPLOYMENT_TYPES.map(t => `<option value="${t}" ${t === emp.employmentType ? "selected" : ""}>${t}</option>`).join("")}
          </select></div>
        <div class="field"><label>Documents Folder URL</label>
          <input class="input" type="url" name="documentsFolderUrl" value="${Utils.escapeHtml(emp.documentsFolderUrl || "")}" placeholder="e.g. Google Drive folder link" />
          <span class="card-sub" style="margin-top:-2px">Shown as an "Open Documents Folder" button on this employee's Documents tab.</span></div>
        <div class="card-sub">Only Full Time employees get the 1.5 paid leave days/month benefit when their salary is calculated — Part Time and Intern leave days aren't paid.</div>
      </form>`;
    const footerHtml = `
      <button class="btn secondary" type="button" id="detCancel">Cancel</button>
      <button class="btn" type="submit" form="detForm">Save</button>`;
    const overlay = Modal.open({ title: `Edit Details — ${emp.name}`, bodyHtml, footerHtml });
    overlay.querySelector("#detCancel").addEventListener("click", Modal.close);
    overlay.querySelector("#detForm").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        uid: emp.uid,
        designation: fd.get("designation"),
        department: fd.get("department"),
        employmentType: fd.get("employmentType"),
        documentsFolderUrl: fd.get("documentsFolderUrl")
      };
      const res = await Api.call("updateEmployeeDetails", payload);
      if (res.ok) {
        Object.assign(emp, {
          designation: payload.designation, department: payload.department,
          employmentType: payload.employmentType, documentsFolderUrl: payload.documentsFolderUrl
        });
        Toast.show("Details updated", "success");
        Modal.close();
      } else {
        Toast.show(res.error || "Could not update details", "error");
      }
    });
  }

  /** Admin assigns one Drive link "today's work" per employee per day —
   *  shows up as that employee's Dashboard "Today's Task Drive Link" card.
   *  Called with an employee (drawer quick action) or with none (Employees
   *  page bottom bar), which adds an employee picker to the form instead. */
  function openAssignDailyTaskModal(emp) {
    const pickerHtml = emp ? "" : `
      <div class="field"><label>Employee</label>
        <select class="input" name="uid" required>
          <option value="">Select employee...</option>
          ${all.map(e => `<option value="${e.uid}">${Utils.escapeHtml(e.name)}</option>`).join("")}
        </select></div>`;
    const bodyHtml = `
      <form id="taskForm">
        ${pickerHtml}
        <div class="field"><label>Date</label>
          <input class="input" type="date" name="date" value="${Utils.todayIso()}" required /></div>
        <div class="field"><label>Task Title</label>
          <input class="input" type="text" name="title" placeholder="e.g. Edit DeoDap Reel Batch 3" /></div>
        <div class="field"><label>Drive Link URL</label>
          <input class="input" type="url" name="url" placeholder="https://drive.google.com/..." required /></div>
      </form>`;
    const footerHtml = `
      <button class="btn secondary" type="button" id="taskCancel">Cancel</button>
      <button class="btn" type="submit" form="taskForm">Assign</button>`;
    const overlay = Modal.open({ title: emp ? `Assign Daily Task — ${emp.name}` : "Assign Daily Task", bodyHtml, footerHtml });
    overlay.querySelector("#taskCancel").addEventListener("click", Modal.close);
    overlay.querySelector("#taskForm").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const uid = emp ? emp.uid : fd.get("uid");
      if (!uid) { Toast.show("Select an employee", "error"); return; }
      const res = await Api.call("assignDailyTask", {
        uid,
        date: fd.get("date"),
        title: fd.get("title"),
        url: fd.get("url")
      });
      if (res.ok) {
        Toast.show("Task assigned", "success");
        Modal.close();
      } else {
        Toast.show(res.error || "Could not assign the task", "error");
      }
    });
  }

  /** Admin-only: appends a new Users row (+ zeroed SalaryBase row) and
   *  refreshes the grid. UID must not already be in use — enforced server-side. */
  function openAddEmployeeModal() {
    const bodyHtml = `
      <form id="addEmpForm">
        <div class="grid grid-2">
          <div class="field"><label>ID</label><input class="input" type="text" name="uid" placeholder="e.g. EMP002" required /></div>
          <div class="field"><label>Password</label><input class="input" type="text" name="password" required /></div>
        </div>
        <div class="field"><label>Name</label><input class="input" type="text" name="name" required /></div>
        <div class="field"><label>Email</label><input class="input" type="email" name="email" /></div>
        <div class="grid grid-2">
          <div class="field"><label>Designation</label><input class="input" type="text" name="designation" placeholder="e.g. Video Editor" /></div>
          <div class="field"><label>Department</label><input class="input" type="text" name="department" placeholder="e.g. Creative" /></div>
        </div>
        <div class="grid grid-2">
          <div class="field"><label>Role</label>
            <select class="input" name="role"><option value="employee">Employee</option><option value="admin">Admin</option></select></div>
          <div class="field"><label>Employment Type</label>
            <select class="input" name="employmentType">${EMPLOYMENT_TYPES.map(t => `<option value="${t}">${t}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label>Monthly Salary</label><input class="input" type="number" min="0" name="monthlySalary" value="0" /></div>
      </form>`;
    const footerHtml = `
      <button class="btn secondary" type="button" id="addEmpCancel">Cancel</button>
      <button class="btn" type="submit" form="addEmpForm">Add Employee</button>`;
    const overlay = Modal.open({ title: "Add Employee", bodyHtml, footerHtml });
    overlay.querySelector("#addEmpCancel").addEventListener("click", Modal.close);
    overlay.querySelector("#addEmpForm").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const res = await Api.call("createEmployee", Object.fromEntries(fd.entries()));
      if (res.ok) {
        Toast.show("Employee added", "success");
        Modal.close();
        render(document.getElementById("content"));
      } else {
        Toast.show(res.error || "Could not add employee", "error");
      }
    });
  }

  return { render };
})();
