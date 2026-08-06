/**
 * calendar.js — renders one month grid, marking holidays (from the
 * Holidays sheet) and attendance status (from the Attendance sheet)
 * on top of each other. Holiday styling takes visual priority when a
 * day is both a holiday and has an attendance row.
 */
const Calendar = (() => {
  const DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const MONTH_NAMES = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];

  /** attendance: array of { date:"YYYY-MM-DD", status } — optional. */
  function monthGrid(year, monthIndex, holidays, attendance = []) {
    const holidayMap = {};
    holidays.forEach(h => { holidayMap[h.date] = h; });
    const attendanceMap = {};
    attendance.forEach(a => { attendanceMap[a.date] = a.status; });

    const first = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const startOffset = first.getDay();
    const todayIso = Utils.todayIso();

    let cells = "";
    for (let i = 0; i < startOffset; i++) cells += `<div class="cal-cell empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const holiday = holidayMap[iso];
      const status = attendanceMap[iso];
      const classes = ["cal-cell"];
      let title = "";
      if (holiday) { classes.push("holiday"); title = holiday.name; }
      else if (status === "Present") { classes.push("present"); title = "Present"; }
      else if (status === "Absent") { classes.push("absent"); title = "Absent"; }
      else if (status === "Leave") { classes.push("leave"); title = "Leave"; }
      if (iso === todayIso) classes.push("today");
      cells += `<div class="${classes.join(" ")}" title="${Utils.escapeHtml(title)}">
        <span>${d}</span>${holiday || status ? `<span class="cal-dot"></span>` : ""}
      </div>`;
    }

    return `
      <div class="cal-grid">
        ${DOW.map(d => `<div class="cal-dow">${d}</div>`).join("")}
        ${cells}
      </div>`;
  }

  function monthLabel(year, monthIndex) {
    return `${MONTH_NAMES[monthIndex]} ${year}`;
  }

  return { monthGrid, monthLabel, MONTH_NAMES };
})();
