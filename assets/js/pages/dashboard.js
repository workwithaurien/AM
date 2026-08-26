/**
 * dashboard.js — overview cards + quick actions.
 */
const PageDashboard = (() => {
  /** Same cache key/shape as attendance.js's own fetchHolidays — whichever
   *  page fetches first populates it for the other, since holidays rarely
   *  change within a session. */
  async function fetchHolidays() {
    const cached = State.get("holidays");
    if (cached) return cached;
    const res = await Api.call("getHolidays");
    if (res.ok) { State.set("holidays", res.holidays); return res.holidays; }
    return []; // don't block the whole Dashboard over a holidays fetch failure
  }

  async function render(mount) {
    // CEO gets a completely different, company-wide master dashboard —
    // see renderCeoOverview — instead of the "my own attendance/salary"
    // view every Admin/Employee/Freelancer gets below.
    if (Auth.isCeo()) return renderCeoOverview(mount);

    const user = Auth.getUser();
    const [res, holidays] = await Promise.all([Api.call("getDashboard"), fetchHolidays()]);
    if (!res.ok) { mount.innerHTML = errorState(res.error); return; }

    const { announcements, salary, reportSubmittedToday, todayAttendance, todaysTask } = res;
    const isAdmin = Auth.isAdmin();
    const todayIso = Utils.todayIso();
    // Sunday is already a paid day off that counts as Present
    // automatically for salary (see freeSundays_ in Code.gs) — same for
    // a company holiday — so there's nothing to clock in for. Enforced
    // again server-side in markAttendance_, this is just the UI half.
    const isPaidDayOff = new Date().getDay() === 0 || holidays.some(h => h.date === todayIso);
    // Freelancers are paid a manually-set amount each cycle, not via
    // Present-Days attendance tracking — no Login/Logout/Break, no
    // Attendance Summary/Working Hours stats, no Apply Leave/Log
    // Overtime (both feed the Present-Days math they don't use). Admins
    // DO use Present-Days (see the Attendance Summary card above) and
    // can already Apply Leave/Request Advance here, so Log Overtime is
    // available to them too — an Admin-submitted request just requires
    // CEO approval, same as Leave/Advance already do (canDecideRequestFrom_).
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
    const blockLogin = isPaidDayOff && !loggedIn;
    const attendanceLoginCard = `
      <div class="card">
        <div class="card-label">Login / Logout</div>
        <div class="card-sub" id="attendanceStatus">${blockLogin ? "Paid day off — no login needed" : attendanceStatusText(todayAttendance)}</div>
        <button class="btn clock-btn" id="attendanceBtn" style="margin-top:10px" ${loggedOut || blockLogin ? "disabled" : ""}>
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
        ${isFreelancer ? "" : `<button class="btn secondary" id="qaOvertime">Log Overtime</button>`}
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
    const { announcements, team, payroll, approvals, conduct, anomalies, recentActivity } = res;

    const nameListHtml = (names, emptyText) =>
      names.length ? names.map(n => Utils.escapeHtml(n)).join(", ") : emptyText;

    // One-line skim of everything that needs attention, so a quiet day
    // reads as a quiet day instead of making the CEO scan every card
    // below just to confirm nothing's pending.
    const attentionParts = [];
    if (approvals.pendingTotal > 0) attentionParts.push(`${approvals.pendingTotal} pending approval${approvals.pendingTotal === 1 ? "" : "s"}`);
    if (conduct.atWarningLimit.length) attentionParts.push(`${conduct.atWarningLimit.length} at warning limit`);
    if (conduct.nearWarningLimit.length) attentionParts.push(`${conduct.nearWarningLimit.length} near warning limit`);
    if (anomalies.advanceExceedsEarned.length) attentionParts.push(`${anomalies.advanceExceedsEarned.length} advance overage${anomalies.advanceExceedsEarned.length === 1 ? "" : "s"}`);
    if (anomalies.unmarkedAttendance.length) attentionParts.push(`${anomalies.unmarkedAttendance.length} attendance gap${anomalies.unmarkedAttendance.length === 1 ? "" : "s"}`);
    const payrollPct = payroll.totalMonthlyPayroll > 0 ? Math.round(payroll.totalEarnedTillDate / payroll.totalMonthlyPayroll * 100) : 0;
    const payrollLine = `Payroll ${payrollPct}% through the month (${Utils.currency(payroll.totalEarnedTillDate)} / ${Utils.currency(payroll.totalMonthlyPayroll)})`;
    const briefingHtml = attentionParts.length
      ? `${attentionParts.join(" · ")} · ${payrollLine}`
      : `All clear — nothing needs your attention right now. ${payrollLine}.`;

    // A nudge only in the last few days of the month — "not closed out"
    // is the normal state for most of the month, so this only fires
    // when it's actually time to act on it.
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const showCloseOutReminder = today.getDate() >= daysInMonth - 4 && payroll.notClosedOut.length > 0;

    mount.innerHTML = `
      <div class="card" style="margin-bottom:14px">
        <div class="card-sub">${briefingHtml}</div>
      </div>

      ${showCloseOutReminder ? `
      <div class="card" style="margin-bottom:14px;background:var(--warning-soft);border-left:3px solid var(--warning)">
        <div class="card-label">Month-End Reminder</div>
        <div class="card-sub">${payroll.notClosedOut.length} ${payroll.notClosedOut.length === 1 ? "person hasn't" : "people haven't"} been closed out yet this month — see "Not Closed Out This Month" below.</div>
      </div>` : ""}

      <div class="section-head"><h2>Team &amp; Attendance</h2></div>
      <div class="grid grid-4">
        ${Card.stat({ label: "Present", value: `${team.presentToday}/${team.attendanceEligibleTotal}` })}
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
        <div class="card clickable" id="payrollCard" style="cursor:pointer">
          <div class="card-label">Total Monthly Payroll</div>
          <div class="card-value">${Utils.currency(payroll.totalEarnedTillDate)} <span style="font-size:var(--fs-md);font-weight:400;color:var(--muted)">/ ${Utils.currency(payroll.totalMonthlyPayroll)}</span></div>
        </div>
        ${Card.stat({ label: "Advances Outstanding", value: Utils.currency(payroll.totalAdvancesOutstanding) })}
        <div class="card clickable" id="notClosedOutCard" style="cursor:pointer">
          <div class="card-label">Not Closed Out This Month</div>
          <div class="card-value">${payroll.notClosedOut.length}</div>
        </div>
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
              ${conduct.atWarningLimit.map(w => `<span class="clickable" style="cursor:pointer" data-issue-letter="${w.uid}" title="Click to issue a letter">${Badge.render(`${w.name}: at limit (3 of 3)`, "danger")}</span>`).join("")}
              ${conduct.nearWarningLimit.map(w => `<span class="clickable" style="cursor:pointer" data-issue-letter="${w.uid}" title="Click to issue a letter">${Badge.render(`${w.name}: ${w.count} of 3`, "warning")}</span>`).join("")}
            </div>` : `<div class="card-sub" style="margin-top:6px">No one is close to the 3-warning limit.</div>`}
        </div>
        <div id="recentLettersHost">
          ${DataTable.render(
            [{ key: "type", label: "Type" }, { key: "name", label: "Employee" }, { key: "subject", label: "Subject" }, { key: "date", label: "Date" }],
            conduct.recentLetters.map(l => ({
              type: Badge.render(l.type, l.type === "Warning" ? "danger" : "success"),
              name: Utils.escapeHtml(l.name),
              subject: Utils.escapeHtml(l.subject),
              date: Utils.formatDate(l.date)
            })),
            { emptyText: "No warning or appreciation letters issued yet.", onRowClick: true }
          )}
        </div>
      </div>

      ${anomalies.unmarkedAttendance.length || anomalies.advanceExceedsEarned.length ? `
      <div class="section-head"><h2>Anomalies</h2></div>
      <div class="grid grid-2" style="align-items:start">
        <div class="card">
          <div class="card-label">Advance Exceeds Earnings</div>
          ${anomalies.advanceExceedsEarned.length ? `
            <div class="approval-list" style="margin-top:10px">
              ${anomalies.advanceExceedsEarned.map(p => `
                <div class="approval-row clickable" style="cursor:pointer" data-open-drawer="${p.uid}">
                  <div><strong>${Utils.escapeHtml(p.name)}</strong></div>
                  <div class="card-sub">${Utils.currency(p.advanceTaken)} advance taken vs. ${Utils.currency(p.earned)} earned so far · click to review</div>
                </div>`).join("")}
            </div>` : `<div class="card-sub" style="margin-top:6px">Nobody's advance exceeds what they've earned so far.</div>`}
        </div>
        <div class="card">
          <div class="card-label">Attendance Gaps</div>
          ${anomalies.unmarkedAttendance.length ? `
            <div class="approval-list" style="margin-top:10px">
              ${anomalies.unmarkedAttendance.map(p => `
                <div class="approval-row clickable" style="cursor:pointer" data-open-drawer="${p.uid}">
                  <div><strong>${Utils.escapeHtml(p.name)}</strong></div>
                  <div class="card-sub">${p.count} days this month with no attendance marked at all · click to review</div>
                </div>`).join("")}
            </div>` : `<div class="card-sub" style="margin-top:6px">No attendance gaps this month.</div>`}
        </div>
      </div>` : ""}

      <div class="section-head"><h2>Recent Activity</h2></div>
      <div id="recentActivityHost">
        ${DataTable.render(
          [{ key: "when", label: "When" }, { key: "actor", label: "By" }, { key: "action", label: "Action" }, { key: "target", label: "Employee" }, { key: "details", label: "Details" }],
          recentActivity.map(r => ({
            when: r.timestamp, actor: Utils.escapeHtml(r.actorName), action: Utils.escapeHtml(r.action),
            target: Utils.escapeHtml(r.targetName), details: Utils.escapeHtml(r.details)
          })),
          { emptyText: "No activity logged yet." }
        )}
      </div>
      <button class="btn secondary sm" id="viewFullLogBtn" style="margin-top:10px">View Full Log</button>

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
    document.getElementById("payrollCard").addEventListener("click", () => openPayrollBreakdownModal(payroll.breakdown));
    // Click a recent Warning/Appreciation row to open the same
    // formatted, downloadable letter its own Profile page and the
    // Employees drawer's Letters tab use (see letterDoc.js).
    DataTable.bindRowClicks(
      document.getElementById("recentLettersHost"),
      conduct.recentLetters,
      letter => LetterDoc.open(letter, letter.employee)
    );
    document.getElementById("notClosedOutCard").addEventListener("click", () => openCloseOutModal(payroll.notClosedOut));
    // A warning-limit badge jumps straight to the Issue Letter form for
    // that employee (see employees.js's openDeepLinkedApprovalModal),
    // instead of making the CEO go find them in the Employees grid.
    mount.querySelectorAll("[data-issue-letter]").forEach(el => {
      el.addEventListener("click", () => {
        window.location.hash = `#employees?open=letter&uid=${el.dataset.issueLetter}&type=Warning`;
      });
    });
    // An anomaly row jumps straight to that employee's drawer to
    // investigate — same deep-link mechanism, opening the drawer
    // itself rather than a specific action, since what to do about an
    // anomaly varies (adjust salary, mark missed attendance, etc).
    mount.querySelectorAll("[data-open-drawer]").forEach(el => {
      el.addEventListener("click", () => {
        window.location.hash = `#employees?open=drawer&uid=${el.dataset.openDrawer}`;
      });
    });
    document.getElementById("viewFullLogBtn").addEventListener("click", openActivityLogModal);
  }

  /** Everything logActivity_ (Code.gs) has ever recorded — the
   *  dashboard's own "Recent Activity" table only shows the last few,
   *  this is the searchable full accountability trail. Filtering is
   *  client-side over the already-fetched list (fine at this team's
   *  action volume — see getActivityLog_'s own comment) rather than a
   *  server round-trip per keystroke. */
  async function openActivityLogModal() {
    const res = await Api.call("getActivityLog");
    if (!res.ok) { Toast.show(res.error || "Could not load activity log", "error"); return; }
    const log = res.log;
    const renderTable = term => DataTable.render(
      [{ key: "when", label: "When" }, { key: "actor", label: "By" }, { key: "action", label: "Action" }, { key: "target", label: "Employee" }, { key: "details", label: "Details" }],
      log
        .filter(r => !term || `${r.actorName} ${r.action} ${r.targetName} ${r.details}`.toLowerCase().includes(term.toLowerCase()))
        .map(r => ({
          when: r.timestamp, actor: Utils.escapeHtml(r.actorName), action: Utils.escapeHtml(r.action),
          target: Utils.escapeHtml(r.targetName), details: Utils.escapeHtml(r.details)
        })),
      { emptyText: "No matching activity." }
    );
    const bodyHtml = `
      <input class="input" id="activityLogSearch" placeholder="Search activity..." style="margin-bottom:10px" />
      <div id="activityLogTableHost">${renderTable("")}</div>
    `;
    const overlay = Modal.open({ title: `Activity Log (${log.length})`, bodyHtml, xl: true });
    overlay.querySelector("#activityLogSearch").addEventListener("input", Utils.debounce(e => {
      overlay.querySelector("#activityLogTableHost").innerHTML = renderTable(e.target.value);
    }, 150));
  }

  /** Lets the CEO close out each not-yet-closed-out employee straight
   *  from the dashboard instead of opening every employee's drawer one
   *  at a time. One "Close Out" button per person (not a single bulk
   *  action) — closing out is permanent (records this month's live
   *  present days/earnings as a locked SalaryHistory row and resets
   *  Advance Taken), so each one is still a deliberate, individually
   *  confirmed action, same as the drawer's own version of this. */
  function openCloseOutModal(list) {
    const bodyHtml = list.length
      ? `<div class="approval-list">
          ${list.map(p => `
            <div class="approval-row">
              <div>
                <div><strong>${Utils.escapeHtml(p.name)}</strong></div>
                <div class="card-sub">${p.isFreelancer ? "Freelancer — flat amount" : `${p.presentDays} of ${p.totalWorkingDays} days`} · ${Utils.currency(p.earned)} earned so far</div>
              </div>
              <button class="btn secondary sm" data-close-out="${p.uid}">Close Out</button>
            </div>`).join("")}
        </div>`
      : `<div class="card-sub">Everyone's already closed out this month.</div>`;
    // Bulk action only offered when there's more than one person left —
    // for a single person it'd just duplicate the row's own button.
    // Still a real confirm (not a second click of the same button) since
    // it commits every person listed at once, permanently.
    const footerHtml = list.length > 1 ? `<button class="btn danger" id="closeAllBtn">Close Out All (${list.length})</button>` : "";
    const overlay = Modal.open({ title: "Close Out Month", bodyHtml, footerHtml, wide: true });
    overlay.querySelectorAll("[data-close-out]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const uid = btn.dataset.closeOut;
        const person = list.find(p => p.uid === uid);
        if (!confirm(`Close out this month's salary for ${person.name}? This records their current present days and earnings as a permanent "Paid" entry in Salary History, and resets their Advance Taken to ₹0. This can't be undone.`)) return;
        const res = await Api.call("closeSalaryMonth", { uid });
        if (res.ok) {
          Toast.show(`${person.name} closed out`, "success");
          openCloseOutModal(list.filter(p => p.uid !== uid)); // reopen with the closed-out person removed
        } else {
          Toast.show(res.error || "Could not close out this employee", "error");
        }
      });
    });
    const closeAllBtn = overlay.querySelector("#closeAllBtn");
    if (closeAllBtn) {
      closeAllBtn.addEventListener("click", async () => {
        const names = list.map(p => p.name).join(", ");
        if (!confirm(`Close out this month's salary for all ${list.length} people below?\n\n${names}\n\nEach one's current earnings will be recorded as a permanent "Paid" entry and their Advance Taken reset to ₹0. This can't be undone.`)) return;
        closeAllBtn.disabled = true;
        closeAllBtn.textContent = "Closing out...";
        const remaining = [];
        let successCount = 0;
        for (const p of list) {
          const res = await Api.call("closeSalaryMonth", { uid: p.uid });
          if (res.ok) successCount++;
          else remaining.push(p);
        }
        Toast.show(
          successCount === list.length ? `All ${successCount} closed out` : `${successCount} of ${list.length} closed out — ${remaining.length} failed`,
          successCount === list.length ? "success" : "error"
        );
        openCloseOutModal(remaining); // reopen with only the failures (if any) left
      });
    }
  }

  /** Per-person breakdown behind the "Total Monthly Payroll" card —
   *  Present Days/Total Working Days for everyone paid via the normal
   *  attendance-based calculator, or a flat "Freelancer" tag for anyone
   *  paid a manually-set amount instead (see computeSalary_'s
   *  isFreelancer branch — there's no day count to show for those). */
  function openPayrollBreakdownModal(breakdown) {
    const bodyHtml = DataTable.render(
      [{ key: "name", label: "Employee" }, { key: "attendance", label: "Attendance" }, { key: "earned", label: "Earned So Far" }],
      breakdown.map(p => ({
        name: Utils.escapeHtml(p.name),
        attendance: p.isFreelancer ? Badge.render("Freelancer — flat amount", "neutral") : `${p.presentDays} of ${p.totalWorkingDays} days`,
        // Freelancer's earned always equals their flat Monthly Salary
        // (no proration — see computeSalary_'s isFreelancer branch), so
        // showing "/ committed" next to it would just repeat the same
        // number the "Freelancer — flat amount" badge already explains.
        earned: p.isFreelancer
          ? Utils.currency(p.earned)
          : `${Utils.currency(p.earned)} <span style="color:var(--muted)">/ ${Utils.currency(p.monthlySalary)}</span>`
      })),
      { emptyText: "No salary records yet." }
    );
    const footerHtml = breakdown.length ? `<button class="btn secondary" id="exportPayrollCsv">Export CSV</button>` : "";
    const overlay = Modal.open({ title: "Payroll Breakdown — This Month", bodyHtml, footerHtml, wide: true });
    overlay.querySelector("#exportPayrollCsv")?.addEventListener("click", () => {
      const header = ["Employee", "Attendance", "Earned So Far", "Committed Monthly Salary"];
      const rows = breakdown.map(p => [
        p.name,
        p.isFreelancer ? "Freelancer — flat amount" : `${p.presentDays} of ${p.totalWorkingDays} days`,
        p.earned,
        p.isFreelancer ? "" : p.monthlySalary
      ]);
      Utils.downloadCsv(`payroll-breakdown-${Utils.todayIso()}.csv`, [header, ...rows]);
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
