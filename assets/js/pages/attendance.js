/**
 * attendance.js — combined Attendance + Holidays calendar (replaces the
 * old separate Holidays page). Employees see the current month with a
 * Present/Absent/Holiday count above it; admins see all 12 months, plus
 * "+ Add Holiday". Present/Absent coloring uses the viewer's own
 * Attendance rows — an admin viewing this page sees their own record,
 * same as an employee would.
 */
const PageAttendance = (() => {
  let viewMonth = new Date().getMonth();
  let viewYear = new Date().getFullYear();

  async function render(mount) {
    const user = Auth.getUser();
    const [holRes, attRes] = await Promise.all([
      fetchHolidays(),
      Api.call("getAttendanceCalendar")
    ]);
    if (!holRes.ok) { mount.innerHTML = `<div class="empty-state">${holRes.error}</div>`; return; }
    if (!attRes.ok) { mount.innerHTML = `<div class="empty-state">${attRes.error}</div>`; return; }
    const holidays = holRes.holidays;
    const attendance = attRes.records;
    const paidLeave = attRes.paidLeave || { eligible: false, allowance: 0, taken: 0, used: 0, remaining: 0, cashoutDays: 0 };

    mount.innerHTML = user.role === "admin" ? adminView(holidays, attendance) : employeeView(holidays, attendance, paidLeave);

    if (user.role === "admin") {
      document.getElementById("addHolidayBtn").addEventListener("click", () => openHolidayModal(null));
      mount.querySelectorAll("[data-edit-holiday]").forEach(btn => {
        btn.addEventListener("click", () => openHolidayModal(holidays.find(h => h.id === btn.dataset.editHoliday)));
      });
      mount.querySelectorAll("[data-delete-holiday]").forEach(btn => {
        btn.addEventListener("click", () => deleteHoliday(btn.dataset.deleteHoliday));
      });
    } else {
      document.getElementById("prevMonth").addEventListener("click", () => shiftMonth(-1));
      document.getElementById("nextMonth").addEventListener("click", () => shiftMonth(1));
    }
  }

  /** Holidays rarely change within a session, so cache them in State
   *  instead of refetching on every Attendance page visit — invalidated
   *  by clearing the cache key whenever one is added/edited/deleted. */
  async function fetchHolidays() {
    const cached = State.get("holidays");
    if (cached) return { ok: true, holidays: cached };
    const res = await Api.call("getHolidays");
    if (res.ok) State.set("holidays", res.holidays);
    return res;
  }

  function countsFor(holidays, attendance, year, monthIndex) {
    const inMonth = iso => {
      const d = new Date(iso + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === monthIndex;
    };
    return {
      present: attendance.filter(a => a.status === "Present" && inMonth(a.date)).length,
      absent: attendance.filter(a => a.status === "Absent" && inMonth(a.date)).length,
      holidays: holidays.filter(h => inMonth(h.date)).length
    };
  }

  function legendHtml() {
    return `
      <div class="legend">
        <span class="legend-item"><span class="legend-dot present"></span>Present</span>
        <span class="legend-item"><span class="legend-dot absent"></span>Absent</span>
        <span class="legend-item"><span class="legend-dot leave"></span>Leave</span>
        <span class="legend-item"><span class="legend-dot holiday"></span>Holiday</span>
      </div>`;
  }

  function employeeView(holidays, attendance, paidLeave) {
    const counts = countsFor(holidays, attendance, viewYear, viewMonth);
    const monthHolidays = holidays.filter(h => {
      const d = new Date(h.date + "T00:00:00");
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });
    return `
      <div class="grid grid-4">
        ${Card.stat({ label: "Present Days", value: counts.present })}
        ${Card.stat({ label: "Absent Days", value: counts.absent })}
        ${Card.stat({ label: "Holidays", value: counts.holidays })}
        ${paidLeaveCardHtml(paidLeave)}
      </div>
      <div class="grid grid-4" style="margin-top:14px;align-items:start">
        <div class="card" style="grid-column:span 2">
          <div class="card-title">Attendance Calendar</div>
          <div class="toolbar" style="margin-bottom:0;justify-content:center">
            <div class="month-nav">
              <button class="icon-btn" id="prevMonth">\u2039</button>
              <div class="m-label">${Calendar.monthLabel(viewYear, viewMonth)}</div>
              <button class="icon-btn" id="nextMonth">\u203A</button>
            </div>
          </div>
          ${legendHtml()}
          ${Calendar.monthGrid(viewYear, viewMonth, holidays, attendance)}
        </div>
        <div style="grid-column:span 2">
          <div class="section-head" style="margin-top:0"><h2>Holidays This Month</h2></div>
          <div class="holiday-list">
            ${monthHolidays.length ? monthHolidays.map(h => `
              <div class="holiday-row">
                <span class="h-date">${Utils.formatDate(h.date)}</span>
                <span class="h-name">${Utils.escapeHtml(h.name)}</span>
                ${Badge.render(h.type, h.type === "National" ? "success" : "neutral")}
              </div>`).join("") : `<div class="card-sub">No holidays this month.</div>`}
          </div>
        </div>
      </div>
    `;
  }

  /** Paid Leave tab: 1.5 days/month for Full Time employees only, resets
   *  every month \u2014 any of it left unused when the month ends is converted
   *  to a one-time salary bonus the following month (paidLeave.cashoutDays),
   *  not carried forward as extra leave days. */
  function paidLeaveCardHtml(paidLeave) {
    if (!paidLeave.eligible) {
      return Card.stat({ label: "Paid Leave", value: "Not eligible", sub: "Full Time employees only" });
    }
    return Card.stat({
      label: "Paid Leave (This Month)",
      value: `${paidLeave.used} taken \u00B7 ${paidLeave.remaining} left`,
      sub: paidLeave.cashoutDays > 0
        ? `+${paidLeave.cashoutDays}d unused leave added to this month's salary`
        : "Resets to 1.5 days every month"
    });
  }

  function adminView(holidays, attendance) {
    const year = new Date().getFullYear();
    const yearCounts = {
      present: attendance.filter(a => a.status === "Present" && a.date.startsWith(String(year))).length,
      absent: attendance.filter(a => a.status === "Absent" && a.date.startsWith(String(year))).length,
      holidays: holidays.filter(h => h.date.startsWith(String(year))).length
    };
    const groups = Calendar.MONTH_NAMES.map((name, idx) => ({
      name, idx,
      items: holidays.filter(h => new Date(h.date + "T00:00:00").getMonth() === idx)
    }));
    return `
      <div class="toolbar">
        <div class="grow"><strong>Full Year — ${year}</strong> <span class="card-sub">Admins see all 12 months; employees only see the current month.</span></div>
        <button class="btn" id="addHolidayBtn">+ Add Holiday</button>
      </div>
      <div class="grid grid-3" style="margin-bottom:10px">
        ${Card.stat({ label: "Present Days (Year)", value: yearCounts.present })}
        ${Card.stat({ label: "Absent Days (Year)", value: yearCounts.absent })}
        ${Card.stat({ label: "Holidays (Year)", value: yearCounts.holidays })}
      </div>
      ${legendHtml()}
      <div class="year-groups">
        ${groups.map(g => `
          <div class="year-group">
            <h3>${g.name} ${year}</h3>
            ${Calendar.monthGrid(year, g.idx, holidays, attendance)}
            ${g.items.length ? `<div class="holiday-list" style="margin-top:10px">
              ${g.items.map(h => `
                <div class="holiday-row">
                  <span class="h-date">${Utils.formatDate(h.date)}</span>
                  <span class="h-name">${Utils.escapeHtml(h.name)}</span>
                  ${Badge.render(h.type, h.type === "National" ? "success" : "neutral")}
                  <div class="h-actions">
                    <button class="btn secondary sm" data-edit-holiday="${h.id}">Edit</button>
                    <button class="btn danger sm" data-delete-holiday="${h.id}">Delete</button>
                  </div>
                </div>`).join("")}
            </div>` : `<div class="card-sub" style="margin-top:8px">No holidays.</div>`}
          </div>`).join("")}
      </div>
    `;
  }

  function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    render(document.getElementById("content"));
  }

  /** Shared by "+ Add Holiday" and each row's "Edit" button.
   *  existing === null → new holiday (Add); existing === a holiday
   *  object → editing it in place (Save Changes). */
  function openHolidayModal(existing) {
    const isEdit = !!existing;
    const bodyHtml = `
      <form id="holForm">
        <div class="field"><label>Date</label><input class="input" type="date" name="date" value="${isEdit ? existing.date : ""}" required /></div>
        <div class="field"><label>Name</label><input class="input" type="text" name="name" value="${isEdit ? Utils.escapeHtml(existing.name) : ""}" required /></div>
        <div class="field"><label>Type</label>
          <select class="input" name="type">
            <option ${isEdit && existing.type === "National" ? "selected" : ""}>National</option>
            <option ${isEdit && existing.type === "Festival" ? "selected" : ""}>Festival</option>
          </select></div>
      </form>`;
    const footerHtml = `<button class="btn secondary" type="button" id="holCancel">Cancel</button>
      <button class="btn" type="submit" form="holForm">${isEdit ? "Save Changes" : "Add Holiday"}</button>`;
    const overlay = Modal.open({ title: isEdit ? "Edit Holiday" : "Add Corporate Holiday", bodyHtml, footerHtml });
    overlay.querySelector("#holCancel").addEventListener("click", Modal.close);
    overlay.querySelector("#holForm").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = { date: fd.get("date"), name: fd.get("name"), type: fd.get("type") };
      if (isEdit) payload.id = existing.id;
      const res = await Api.call(isEdit ? "updateHoliday" : "addHoliday", payload);
      if (res.ok) {
        Toast.show(isEdit ? "Holiday updated" : "Holiday added", "success");
        Modal.close();
        State.set("holidays", null); // invalidate the cache — see fetchHolidays
        render(document.getElementById("content"));
      } else {
        Toast.show(res.error || `Could not ${isEdit ? "update" : "add"} the holiday`, "error");
      }
    });
  }

  async function deleteHoliday(id) {
    if (!confirm("Permanently delete this holiday? This can't be undone.")) return;
    const res = await Api.call("deleteHoliday", { id });
    if (res.ok) {
      Toast.show("Holiday deleted", "success");
      State.set("holidays", null); // invalidate the cache — see fetchHolidays
      render(document.getElementById("content"));
    } else {
      Toast.show(res.error || "Could not delete the holiday", "error");
    }
  }

  return { render };
})();
