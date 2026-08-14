/**
 * dashboard.js — overview cards + quick actions.
 */
const PageDashboard = (() => {
  async function render(mount) {
    // CEO gets a completely different, company-wide master dashboard —
    // see renderCeoOverview — instead of the "my own attendance/salary"
    // view every Admin/Employee/Freelancer gets below.
    if (Auth.isCeo()) return renderCeoOverview(mount);

    const user = Auth.getUser();
    const res = await Api.call("getDashboard");
    if (!res.ok) { mount.innerHTML = errorState(res.error); return; }

    const { announcements, salary, reportSubmittedToday, todayAttendance, todaysTask } = res;
    const isAdmin = Auth.isAdmin();
    // Freelancers are paid a manually-set amount each cycle, not via
    // Present-Days attendance tracking — no Login/Logout/Break, no
    // Attendance Summary/Working Hours stats, no Apply Leave/Log
    // Overtime (both feed the Present-Days math they don't use).
    const isFreelancer = user.employmentType === "Freelancer";
    const earnedTillDate = salary.isFreelancer
      ? salary.monthlySalary
      : Math.round(salary.monthlySalary / salary.totalWorkingDays * salary.presentDays);
    const loggedIn = !!todayAttendance.loginTime;
    const loggedOut = !!todayAttendance.logoutTime;
    // Older deployed backends (before upgradeEMS) won't send Break Start/
    // End — falls back to "no break yet" instead of crashing.
    const onBreak = !!todayAttendance.breakStart && !todayAttendance.breakEnd;
    const breakDone = !!todayAttendance.breakStart && !!todayAttendance.breakEnd;
    // Older deployed backends (before upgradeEMS) won't send these — fall
    // back instead of crashing the whole dashboard on a missing field.
    const teamAttendanceToday = res.teamAttendanceToday || { present: 0, total: 0 };
    const pendingApprovals = res.pendingApprovals ?? 0;

    // Admin manages the team rather than doing their own day-to-day work,
    // so the task-link and work-report stat cards (both employee-only
    // concerns) drop out of their view entirely.
    const attendanceLoginCard = `
      <div class="card">
        <div class="card-label">Login / Logout</div>
        <div class="card-sub" id="attendanceStatus">${attendanceStatusText(todayAttendance)}</div>
        <button class="btn clock-btn" id="attendanceBtn" style="margin-top:10px" ${loggedOut ? "disabled" : ""}>
          ${loggedIn ? "Logout" : "Login"}
        </button>
        ${loggedIn ? `
        <div class="card-sub" style="margin-top:10px">${breakStatusText(todayAttendance)}</div>
        <button class="btn secondary clock-btn" id="breakBtn" style="margin-top:6px" ${breakDone || loggedOut ? "disabled" : ""}>
          ${onBreak ? "End Break" : "Take Break"}
        </button>` : ""}
      </div>`;
    const topCardsHtml = isAdmin
      ? `<div class="grid grid-4">
          ${attendanceLoginCard}
          ${Card.stat({ label: "Attendance Summary", value: salary.presentDays + "/" + salary.totalWorkingDays, sub: "Present days this month" })}
          ${Card.stat({ label: "Today's Working Hours", value: workingHours(todayAttendance), sub: "Auto-tracked from Login/Logout" })}
          ${Card.stat({ label: "Salary Earned Till Date", value: Utils.currency(earnedTillDate), sub: "Based on attendance" })}
        </div>`
      : isFreelancer
      ? `<div class="grid grid-3">
          ${Card.stat({
            label: "Today's Task Drive Link",
            value: todaysTask
              ? `<a href="${Utils.escapeHtml(todaysTask.url)}" target="_blank" rel="noopener">Open</a>`
              : "None assigned",
            sub: todaysTask ? Utils.escapeHtml(todaysTask.title) : "See Drive tab for all links"
          })}
          ${Card.stat({ label: "Amount Owed (This Cycle)", value: Utils.currency(earnedTillDate), sub: "Set by admin — not attendance-based" })}
          ${Card.stat({
            label: "Work Report",
            value: reportSubmittedToday
              ? `<span class="text-success">Submitted</span>`
              : `<span class="text-danger">Pending</span>`,
            sub: "For today"
          })}
        </div>`
      : `<div class="grid grid-3">
          ${attendanceLoginCard}
          ${Card.stat({ label: "Attendance Summary", value: salary.presentDays + "/" + salary.totalWorkingDays, sub: "Present days this month" })}
          ${Card.stat({
            label: "Today's Task Drive Link",
            value: todaysTask
              ? `<a href="${Utils.escapeHtml(todaysTask.url)}" target="_blank" rel="noopener">Open</a>`
              : "None assigned",
            sub: todaysTask ? Utils.escapeHtml(todaysTask.title) : "See Drive tab for all links"
          })}
        </div>
        <div class="grid grid-3" style="margin-top:14px">
          ${Card.stat({ label: "Today's Working Hours", value: workingHours(todayAttendance), sub: "Auto-tracked from Login/Logout" })}
          ${Card.stat({ label: "Salary Earned Till Date", value: Utils.currency(earnedTillDate), sub: "Based on attendance" })}
          ${Card.stat({
            label: "Work Report",
            value: reportSubmittedToday
              ? `<span class="text-success">Submitted</span>`
              : `<span class="text-danger">Pending</span>`,
            sub: "For today"
          })}
        </div>`;

    mount.innerHTML = `
      ${topCardsHtml}

      ${isAdmin ? `
      <div class="grid grid-2" style="margin-top:14px">
        ${Card.stat({ label: "Team Attendance Today", value: `${teamAttendanceToday.present}/${teamAttendanceToday.total}`, sub: "Employees present today" })}
        ${Card.stat({ label: "Pending Approvals", value: String(pendingApprovals), sub: "Leave / advance salary requests" })}
      </div>` : ""}

      <div class="section-head"><h2>Company Announcements</h2></div>
      <div class="announce-list">
        ${announcements.map(a => `
          <div class="announce-item">
            <div class="a-title">${Utils.escapeHtml(a.title)}</div>
            <div class="a-date">${Utils.formatDate(a.date)}</div>
          </div>`).join("")}
      </div>

      <div class="quick-actions">
        ${isAdmin ? "" : `<button class="btn" id="qaReport">Submit Work Report</button>`}
        ${isFreelancer ? "" : `<button class="btn secondary" id="qaLeave">Apply Leave</button>`}
        <button class="btn secondary" id="qaAdvance">Request Advance Salary</button>
        ${isAdmin || isFreelancer ? "" : `<button class="btn secondary" id="qaOvertime">Log Overtime</button>`}
      </div>
    `;

    document.getElementById("attendanceBtn")?.addEventListener("click", () => markAttendance(loggedIn ? "logout" : "login"));
    document.getElementById("breakBtn")?.addEventListener("click", () => markBreak(onBreak ? "end" : "start"));
    document.getElementById("qaReport")?.addEventListener("click", () => (window.location.hash = "#work-reports"));
    document.getElementById("qaLeave")?.addEventListener("click", openApplyLeaveModal);
    document.getElementById("qaAdvance").addEventListener("click", openRequestAdvanceModal);
    document.getElementById("qaOvertime")?.addEventListener("click", openLogOvertimeModal);
  }

  /** CEO's master dashboard — company-wide figures (team & attendance,
   *  payroll & financials, the approvals queue with Admin-submitted
   *  requests called out since only the CEO can decide those, and a
   *  conduct pulse-check), not "my own" numbers like everyone else's
   *  Dashboard shows. */
  async function renderCeoOverview(mount) {
    const res = await Api.call("getCeoOverview");
    if (!res.ok) { mount.innerHTML = errorState(res.error); return; }
    const { announcements, team, payroll, approvals, conduct } = res;

    const nameListHtml = (names, emptyText) =>
      names.length ? names.map(n => Utils.escapeHtml(n)).join(", ") : emptyText;
    // "Not Closed Out This Month" reads as an alarm if it just lists
    // everyone — which it will, for most of the month, since Close Out
    // Month is normally a once-a-month, end-of-month action. Cap the
    // names shown so it doesn't look like a growing problem all month.
    const truncatedNameListHtml = (names, emptyText, max = 5) => {
      if (!names.length) return emptyText;
      const shown = names.slice(0, max).map(n => Utils.escapeHtml(n)).join(", ");
      const rest = names.length - max;
      return rest > 0 ? `${shown}, and ${rest} more` : shown;
    };

    mount.innerHTML = `
      <div class="grid grid-3">
        ${Card.stat({ label: "Total Staff", value: String(team.totalStaff), sub: "Employees + Admins" })}
        ${Card.stat({ label: "Pending Approvals", value: String(approvals.pendingTotal), sub: "Leave / advance / overtime, company-wide" })}
        ${Card.stat({ label: "Awaiting Your Approval", value: String(approvals.awaitingYourApproval.length), sub: "Submitted by an Admin — only you can decide" })}
      </div>

      <div class="section-head"><h2>Team &amp; Attendance</h2></div>
      <div class="grid grid-4">
        ${Card.stat({ label: "Present", value: `${team.presentToday}/${team.attendanceEligibleTotal}`, sub: "Freelancers excluded" })}
        ${Card.stat({ label: "Absent", value: String(team.absentToday), sub: nameListHtml(team.absentNames, "") })}
        ${Card.stat({ label: "On Leave", value: String(team.onLeaveToday), sub: nameListHtml(team.onLeaveNames, "") })}
        ${Card.stat({ label: "Not Marked", value: String(team.notMarkedToday) })}
      </div>
      <div class="card" style="margin-top:14px">
        <div class="card-label">Headcount by Employment Type</div>
        <div class="btn-row" style="margin-top:10px">
          ${Object.keys(team.byType).map(t => Badge.render(`${t}: ${team.byType[t]}`, "neutral")).join("")}
        </div>
      </div>

      <div class="section-head"><h2>Payroll &amp; Financials</h2></div>
      <div class="grid grid-3">
        ${Card.stat({ label: "Total Monthly Payroll", value: Utils.currency(payroll.totalMonthlyPayroll), sub: "Sum of everyone's Monthly Salary" })}
        ${Card.stat({ label: "Advances Outstanding", value: Utils.currency(payroll.totalAdvancesOutstanding), sub: "Across all staff" })}
        ${Card.stat({ label: "Not Closed Out This Month", value: String(payroll.notClosedOutNames.length), sub: truncatedNameListHtml(payroll.notClosedOutNames, "Everyone's closed out") })}
      </div>

      <div class="section-head"><h2>Approvals Queue</h2></div>
      ${approvals.awaitingYourApproval.length ? `
        <div class="approval-list">
          ${approvals.awaitingYourApproval.map(r => `
            <div class="approval-row clickable" data-open-approval="${r.kind.toLowerCase()}" style="cursor:pointer">
              <div><strong>${Utils.escapeHtml(r.name)}</strong> — ${Utils.escapeHtml(r.kind)}</div>
              <div class="card-sub">${Utils.formatDate(r.date)} · click to review</div>
            </div>`).join("")}
        </div>
      ` : `<div class="card-sub">Nothing from an Admin awaiting your approval right now.</div>`}

      <div class="section-head"><h2>Conduct Pulse-Check</h2></div>
      <div class="grid grid-2" style="align-items:start">
        <div class="card">
          <div class="card-label">Warning Limit</div>
          ${conduct.atWarningLimit.length || conduct.nearWarningLimit.length ? `
            <div class="btn-row" style="margin-top:10px">
              ${conduct.atWarningLimit.map(w => Badge.render(`${Utils.escapeHtml(w.name)}: at limit (3 of 3)`, "danger")).join("")}
              ${conduct.nearWarningLimit.map(w => Badge.render(`${Utils.escapeHtml(w.name)}: ${w.count} of 3`, "warning")).join("")}
            </div>` : `<div class="card-sub" style="margin-top:6px">No one is close to the 3-warning limit.</div>`}
        </div>
        <div>
          ${DataTable.render(
            [{ key: "type", label: "Type" }, { key: "name", label: "Employee" }, { key: "subject", label: "Subject" }, { key: "date", label: "Date" }],
            conduct.recentLetters.map(l => ({
              type: Badge.render(l.type, l.type === "Warning" ? "danger" : "success"),
              name: Utils.escapeHtml(l.name),
              subject: Utils.escapeHtml(l.subject),
              date: Utils.formatDate(l.date)
            })),
            { emptyText: "No warning or appreciation letters issued yet." }
          )}
        </div>
      </div>

      <div class="section-head"><h2>Company Announcements</h2></div>
      <div class="announce-list">
        ${announcements.map(a => `
          <div class="announce-item">
            <div class="a-title">${Utils.escapeHtml(a.title)}</div>
            <div class="a-date">${Utils.formatDate(a.date)}</div>
          </div>`).join("")}
      </div>
    `;

    // Deep-links into the matching "Approve X" modal on the Employees
    // page (see employees.js's render(), which reads this query param)
    // instead of just dropping the CEO on the page to go find it themselves.
    mount.querySelectorAll("[data-open-approval]").forEach(row => {
      row.addEventListener("click", () => {
        window.location.hash = `#employees?open=${row.dataset.openApproval}`;
      });
    });
  }

  function openApplyLeaveModal() {
    const bodyHtml = `
      <form id="leaveForm">
        <div class="grid grid-2">
          <div class="field"><label>From</label><input class="input" type="date" name="from" required /></div>
          <div class="field"><label>To</label><input class="input" type="date" name="to" required /></div>
        </div>
        <div class="grid grid-2">
          <div class="field"><label>Type</label>
            <select class="input" name="type">
              <option>Casual Leave</option>
              <option>Sick Leave</option>
              <option>Paid Leave</option>
              <option>Unpaid Leave</option>
            </select></div>
          <div class="field"><label>Duration</label>
            <select class="input" name="duration" id="leaveDuration">
              <option value="Full Day">Full Day</option>
              <option value="Half Day">Half Day (0.5)</option>
            </select></div>
        </div>
        <div class="field"><label>Reason</label>
          <textarea class="input" name="reason" rows="2"></textarea></div>
      </form>`;
    const footerHtml = `
      <button class="btn secondary" type="button" id="leaveCancel">Cancel</button>
      <button class="btn" type="submit" form="leaveForm">Submit</button>`;
    const overlay = Modal.open({ title: "Apply Leave", bodyHtml, footerHtml });

    // Half Day only ever applies to one date — lock "To" to "From" so the
    // request can't span a range while marked Half Day.
    const fromInput = overlay.querySelector('[name="from"]');
    const toInput = overlay.querySelector('[name="to"]');
    const durationSelect = overlay.querySelector("#leaveDuration");
    const syncHalfDay = () => {
      if (durationSelect.value === "Half Day") {
        toInput.value = fromInput.value;
        toInput.disabled = true;
      } else {
        toInput.disabled = false;
      }
    };
    durationSelect.addEventListener("change", syncHalfDay);
    fromInput.addEventListener("change", syncHalfDay);

    overlay.querySelector("#leaveCancel").addEventListener("click", Modal.close);
    overlay.querySelector("#leaveForm").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      // FormData omits disabled fields, but a locked Half Day "To" is
      // already forced equal to "From" via syncHalfDay above.
      const payload = Object.fromEntries(fd.entries());
      if (durationSelect.value === "Half Day") payload.to = payload.from;
      if (payload.to < payload.from) { Toast.show("'To' date can't be before 'From' date", "error"); return; }
      const res = await Api.call("applyLeave", payload);
      if (res.ok) {
        Toast.show("Leave application submitted", "success");
        Modal.close();
      } else {
        Toast.show(res.error || "Could not submit leave application", "error");
      }
    });
  }

  function openRequestAdvanceModal() {
    const bodyHtml = `
      <form id="advForm">
        <div class="field"><label>Amount</label><input class="input" type="number" min="1" name="amount" required /></div>
        <div class="field"><label>Reason</label><textarea class="input" name="reason" rows="2"></textarea></div>
      </form>`;
    const footerHtml = `
      <button class="btn secondary" type="button" id="advCancel">Cancel</button>
      <button class="btn" type="submit" form="advForm">Submit</button>`;
    const overlay = Modal.open({ title: "Request Advance Salary", bodyHtml, footerHtml });
    overlay.querySelector("#advCancel").addEventListener("click", Modal.close);
    overlay.querySelector("#advForm").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const res = await Api.call("requestAdvance", { amount: fd.get("amount"), reason: fd.get("reason") });
      if (res.ok) {
        Toast.show("Advance salary request submitted", "success");
        Modal.close();
      } else {
        Toast.show(res.error || "Could not submit advance request", "error");
      }
    });
  }

  /** Overtime is reported in days (0.5/1/1.5/2...), same scale as a
   *  half/full-day Leave — once an admin approves it, computeSalary_
   *  adds that value straight into that month's Present Days. */
  function openLogOvertimeModal() {
    const bodyHtml = `
      <form id="otForm">
        <div class="grid grid-2">
          <div class="field"><label>Date</label><input class="input" type="date" name="date" value="${Utils.todayIso()}" required /></div>
          <div class="field"><label>Overtime Days</label><input class="input" type="number" name="value" step="0.5" min="0.5" placeholder="e.g. 0.5, 1, 1.5, 2" required /></div>
        </div>
        <div class="field"><label>Reason</label>
          <textarea class="input" name="reason" rows="2" placeholder="What did the extra time go toward?"></textarea></div>
      </form>`;
    const footerHtml = `
      <button class="btn secondary" type="button" id="otCancel">Cancel</button>
      <button class="btn" type="submit" form="otForm">Submit</button>`;
    const overlay = Modal.open({ title: "Log Overtime", bodyHtml, footerHtml });
    overlay.querySelector("#otCancel").addEventListener("click", Modal.close);
    overlay.querySelector("#otForm").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const res = await Api.call("requestOvertime", { date: fd.get("date"), value: fd.get("value"), reason: fd.get("reason") });
      if (res.ok) {
        Toast.show("Overtime submitted for approval", "success");
        Modal.close();
      } else {
        Toast.show(res.error || "Could not submit overtime", "error");
      }
    });
  }

  async function markAttendance(type) {
    const res = await Api.call("markAttendance", { type });
    if (res.ok) {
      Toast.show(type === "login" ? "Logged in for the day" : "Logged out for the day", "success");
      render(document.getElementById("content"));
    } else {
      Toast.show(res.error || "Could not update attendance", "error");
    }
  }

  async function markBreak(type) {
    const res = await Api.call("markBreak", { type });
    if (res.ok) {
      Toast.show(type === "start" ? "Break started" : "Break ended", "success");
      render(document.getElementById("content"));
    } else {
      Toast.show(res.error || "Could not update break", "error");
    }
  }

  function attendanceStatusText(a) {
    if (a.logoutTime) return `Logged in ${a.loginTime} \u2192 out ${a.logoutTime}`;
    if (a.loginTime) return `Logged in at ${a.loginTime}`;
    return "Not logged in yet today";
  }

  /** 1 hour of break is allowed per day, one window (start once, end
   *  once) \u2014 mirrors Login/Logout's own toggle-then-lock pattern. */
  function breakStatusText(a) {
    if (a.breakEnd) return `Break taken ${a.breakStart} \u2192 ${a.breakEnd}`;
    if (a.breakStart) return `On break since ${a.breakStart}`;
    return "No break taken yet";
  }

  function workingHours(a) {
    if (!a.loginTime) return "0h 0m";
    if (!a.logoutTime) return "In progress";
    const [inH, inM] = a.loginTime.split(":").map(Number);
    const [outH, outM] = a.logoutTime.split(":").map(Number);
    let mins = (outH * 60 + outM) - (inH * 60 + inM);
    if (mins < 0) mins = 0;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  function errorState(msg) {
    return `<div class="empty-state"><div class="big">Error</div>${Utils.escapeHtml(msg)}</div>`;
  }

  return { render };
})();
