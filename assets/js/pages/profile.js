/**
 * profile.js — personal info + grouped history sections.
 */
const PageProfile = (() => {
  async function render(mount) {
    const user = Auth.getUser();
    const [attRes, leaveRes, overtimeRes, lettersRes, salaryRes] = await Promise.all([
      Api.call("getAttendanceCalendar"),
      Api.call("getLeaves"),
      Api.call("getOvertimeRequests"),
      Api.call("getLetters"),
      Api.call("getSalary")
    ]);
    const attendanceRows = attRes.ok
      ? attRes.records.slice(-5).reverse().map(r => ({
          date: Utils.formatDate(r.date),
          status: Badge.render(r.status, r.status === "Present" ? "success" : r.status === "Absent" ? "danger" : "warning"),
          hours: hoursBetween(r.loginTime, r.logoutTime)
        }))
      : [];
    const leaveRows = leaveRes.ok
      ? leaveRes.leaves.map(l => ({
          from: Utils.formatDate(l.from),
          to: Utils.formatDate(l.to),
          type: l.type,
          duration: l.duration === "Half Day" ? "Half Day" : "Full Day",
          status: Badge.render(l.status, l.status === "Approved" ? "success" : l.status === "Rejected" ? "danger" : "warning")
        }))
      : [];
    const overtimeRows = overtimeRes.ok
      ? overtimeRes.requests.map(o => ({
          date: Utils.formatDate(o.date),
          value: o.value,
          status: Badge.render(o.status, o.status === "Approved" ? "success" : o.status === "Rejected" ? "danger" : "warning")
        }))
      : [];
    const letters = lettersRes.ok ? lettersRes.letters : [];
    const warningCount = letters.filter(l => l.type === "Warning").length;
    const appreciationCount = letters.filter(l => l.type === "Appreciation").length;
    // Performance Notes aren't formal documents (no Subject, no PDF) —
    // this history is only the two letter types LetterDoc can render.
    const formalLetters = letters.filter(l => l.type === "Warning" || l.type === "Appreciation");
    const letterById = {};
    formalLetters.forEach(l => { letterById[l.id] = l; });
    const monthlySalary = salaryRes.ok ? Utils.currency(salaryRes.salary.monthlySalary) : "Not set";

    mount.innerHTML = `
      <div class="card">
        <div class="profile-head">
          <div class="profile-avatar">${Utils.avatarInner(user)}</div>
          <div>
            <div class="profile-name">${Utils.escapeHtml(user.name)}</div>
            <div class="profile-role">${user.role === "ceo" ? "CEO" : user.role === "admin" ? "Administrator" : "Employee"} &middot; ID: ${Utils.escapeHtml(user.uid)}</div>
          </div>
        </div>
        <div class="profile-grid">
          <div>
            <div class="info-list">
              <div><div class="k">Email</div><div class="v">${Utils.escapeHtml(user.email)}</div></div>
              <div><div class="k">Employee ID</div><div class="v">${Utils.escapeHtml(user.uid)}</div></div>
              <div><div class="k">Designation</div><div class="v">${Utils.escapeHtml(user.designation || "Employee")}</div></div>
              <div><div class="k">Department</div><div class="v">${Utils.escapeHtml(user.department || "—")}</div></div>
              <div><div class="k">Employment Type</div><div class="v">${Utils.escapeHtml(user.employmentType || "Full Time")}</div></div>
              <div><div class="k">Monthly Salary</div><div class="v">${monthlySalary}</div></div>
              <div><div class="k">Status</div><div class="v">${Badge.render("Active", "success")}</div></div>
            </div>
            <button class="btn secondary" id="changePwBtn" style="margin-top:16px">Change Password</button>
          </div>
          <div>
            <div class="section-head" style="margin-top:0"><h2>Letters &amp; Documents</h2></div>
            <div class="grid grid-3">
              ${Card.stat({ label: "Warning Letters", value: String(warningCount) })}
              ${Card.stat({ label: "Appreciation Letters", value: String(appreciationCount) })}
              ${Card.stat({
                label: "Employment Documents",
                value: user.documentsFolderUrl
                  ? `<a href="${Utils.escapeHtml(user.documentsFolderUrl)}" target="_blank" rel="noopener">Open</a>`
                  : "Not linked"
              })}
            </div>
            <div class="section-head"><h2>Warning &amp; Appreciation Letters</h2></div>
            ${DataTable.render(
              [{ key: "type", label: "Type" }, { key: "subject", label: "Subject" }, { key: "date", label: "Date" }, { key: "issuedBy", label: "Issued By" }, { key: "action", label: "" }],
              formalLetters.map(l => ({
                type: l.type === "Warning"
                  ? `<span style="white-space:nowrap">${Badge.render("Warning", "danger")} ${l.warningNumber ? `<span class="card-sub">${l.warningNumber} of 3</span>` : ""}</span>`
                  : Badge.render("Appreciation", "success"),
                subject: Utils.escapeHtml(l.subject),
                date: Utils.formatDate(l.date),
                issuedBy: Utils.escapeHtml(l.issuedBy),
                action: `<button class="btn secondary sm" data-view-letter="${l.id}">View PDF</button>`
              })),
              { emptyText: "No warning or appreciation letters yet." }
            )}
            <div class="section-head"><h2>Leave History</h2></div>
            ${DataTable.render(
              [{ key: "from", label: "From" }, { key: "to", label: "To" }, { key: "type", label: "Type" }, { key: "duration", label: "Duration" }, { key: "status", label: "Status" }],
              leaveRows,
              { emptyText: "No leave applications yet." }
            )}
            <div class="section-head"><h2>Overtime History</h2></div>
            ${DataTable.render(
              [{ key: "date", label: "Date" }, { key: "value", label: "Days" }, { key: "status", label: "Status" }],
              overtimeRows,
              { emptyText: "No overtime logged yet." }
            )}
            ${Auth.isCeo() ? "" : `
            <div class="section-head"><h2>Attendance History</h2></div>
            ${DataTable.render(
              [{ key: "date", label: "Date" }, { key: "status", label: "Status" }, { key: "hours", label: "Hours" }],
              attendanceRows,
              { emptyText: "No attendance recorded yet." }
            )}`}
          </div>
        </div>
      </div>
    `;

    document.getElementById("changePwBtn").addEventListener("click", openChangePassword);
    mount.querySelectorAll("[data-view-letter]").forEach(btn => {
      btn.addEventListener("click", () => LetterDoc.open(letterById[btn.dataset.viewLetter], user));
    });
  }

  function hoursBetween(loginTime, logoutTime) {
    if (!loginTime) return "\u2014";
    if (!logoutTime) return "In progress";
    const [inH, inM] = loginTime.split(":").map(Number);
    const [outH, outM] = logoutTime.split(":").map(Number);
    let mins = (outH * 60 + outM) - (inH * 60 + inM);
    if (mins < 0) mins = 0;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  function openChangePassword() {
    const bodyHtml = `
      <form id="pwForm">
        <div class="field"><label>Current Password</label><input class="input" type="password" name="current" required /></div>
        <div class="field"><label>New Password</label><input class="input" type="password" name="next" required minlength="6" /></div>
        <div class="field"><label>Confirm New Password</label><input class="input" type="password" name="confirm" required minlength="6" /></div>
      </form>
    `;
    const footerHtml = `
      <button class="btn secondary" type="button" id="pwCancel">Cancel</button>
      <button class="btn" type="submit" form="pwForm">Update Password</button>
    `;
    const overlay = Modal.open({ title: "Change Password", bodyHtml, footerHtml });
    overlay.querySelector("#pwCancel").addEventListener("click", Modal.close);
    overlay.querySelector("#pwForm").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      if (fd.get("next") !== fd.get("confirm")) {
        Toast.show("New passwords don't match", "error");
        return;
      }
      const res = await Api.call("changePassword", { current: fd.get("current"), next: fd.get("next") });
      if (res.ok) {
        Toast.show("Password updated", "success");
        Modal.close();
      } else {
        Toast.show(res.error || "Could not update password", "error");
      }
    });
  }

  return { render };
})();
