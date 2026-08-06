/**
 * Code.gs — every backend function for Aurien Media's Employee
 * Management System, in one file (see Setup.gs for the companion
 * script that creates the sheets and seeds sample data).
 *
 * The frontend (assets/js/core/api.js) POSTs a JSON body:
 * { action, token, ...payload }, sent as text/plain so the browser
 * skips a CORS preflight. Every response is JSON: { ok: true, ... }
 * or { ok: false, error: "..." }.
 *
 * Deploy: Extensions > Apps Script on your Sheet, paste this file and
 * Setup.gs in, run setupEMS() once from Setup.gs, then
 * Deploy > New deployment > Web app. Full steps in README.md.
 */


/* ============================== ROUTER ============================== */

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return fail_('Invalid request body — expected JSON.');
  }

  var action = payload.action;
  var session = action === 'login' ? null : verifySession_(payload.token);

  if (action !== 'login' && !session) {
    return fail_('Not authenticated. Please log in again.');
  }

  try {
    switch (action) {
      case 'login':            return login_(payload);
      case 'getDashboard':     return getDashboard_(session);
      case 'getWorkReports':   return getWorkReports_(session, payload);
      case 'submitWorkReport': return submitWorkReport_(session, payload);
      case 'getSalary':        return getSalary_(session, payload);
      case 'updateSalary':     return requireRole_(session, 'admin') ? updateSalary_(payload) : fail_('Admin only.');
      case 'getDriveLinks':    return getDriveLinks_();
      case 'markAttendance':   return markAttendance_(session, payload);
      case 'markBreak':        return markBreak_(session, payload);
      case 'getAttendanceCalendar': return getAttendanceCalendar_(session, payload);
      case 'getEmployees':     return requireRole_(session, 'admin') ? getEmployees_() : fail_('Admin only.');
      case 'updateEmployeeDetails': return requireRole_(session, 'admin') ? updateEmployeeDetails_(payload) : fail_('Admin only.');
      case 'createEmployee':   return requireRole_(session, 'admin') ? createEmployee_(payload) : fail_('Admin only.');
      case 'setEmployeeStatus': return requireRole_(session, 'admin') ? setEmployeeStatus_(payload) : fail_('Admin only.');
      case 'getHolidays':      return getHolidays_();
      case 'addHoliday':       return requireRole_(session, 'admin') ? addHoliday_(payload) : fail_('Admin only.');
      case 'applyLeave':       return applyLeave_(session, payload);
      case 'getLeaves':        return getLeaves_(session, payload);
      case 'approveLeave':     return requireRole_(session, 'admin') ? approveLeave_(payload) : fail_('Admin only.');
      case 'requestAdvance':   return requestAdvance_(session, payload);
      case 'getAdvanceRequests': return getAdvanceRequests_(session, payload);
      case 'approveAdvance':   return requireRole_(session, 'admin') ? approveAdvance_(payload) : fail_('Admin only.');
      case 'issueLetter':      return requireRole_(session, 'admin') ? issueLetter_(session, payload) : fail_('Admin only.');
      case 'getLetters':       return getLetters_(session, payload);
      case 'changePassword':   return changePassword_(session, payload);
      case 'getSettings':      return getSettings_();
      case 'saveSettings':     return requireRole_(session, 'admin') ? saveSettings_(payload) : fail_('Admin only.');
      case 'assignDailyTask':  return requireRole_(session, 'admin') ? assignDailyTask_(session, payload) : fail_('Admin only.');
      default:
        return fail_('Unknown action: ' + action);
    }
  } catch (err) {
    return fail_(err.message || 'Server error.');
  }
}

/** Health check for GET — open the deployed Web App URL directly to test it. */
function doGet() {
  return jsonResponse_({ ok: true, message: 'Aurien Media EMS API is running.' });
}


/* ============================== AUTH ==================================
 * Sheet "Users" columns: UID | Password | Name | Role | Email |
 * Designation | Department | Employment Type | Status ("Active"/"Disabled"
 * — a Disabled user can't log in, see the check below) | Photo URL (a link
 * to a photo hosted elsewhere, e.g. GitHub — shown in the topbar avatar
 * and Profile page in place of initials; blank falls back to initials)
 *
 * SECURITY NOTE: passwords are compared in plain text, matching the
 * "stored and fetched from sheets" requirement for this internal tool.
 * Before this goes beyond internal testing, hash passwords at rest
 * (e.g. Utilities.computeDigest) and compare hashes instead.
 *
 * Sessions live in CacheService (server-side, 6-hour max), not a sheet,
 * so logging in doesn't write a row every time.
 * ====================================================================== */

function login_(payload) {
  var uid = String(payload.uid || '').trim();
  var password = String(payload.password || '');
  if (!uid || !password) return fail_('UID and password are required.');

  var user = sheetToObjects_('Users').find(function (u) {
    return String(u.uid).trim() === uid && String(u.password) === password;
  });
  if (!user) return fail_('Invalid UID or password.');
  if (user.status === 'Disabled') return fail_('This account has been disabled. Contact an admin.');

  var token = Utilities.getUuid();
  var session = {
    uid: user.uid, name: user.name, role: user.role, email: user.email,
    designation: user.designation || 'Employee',
    department: user.department || '',
    employmentType: user.employmentType || 'Full Time',
    photoUrl: user.photoUrl || ''
  };
  CacheService.getScriptCache().put('session_' + token, JSON.stringify(session), 6 * 60 * 60);

  return ok_({ token: token, user: session });
}

function verifySession_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('session_' + token);
  return raw ? JSON.parse(raw) : null;
}

function requireRole_(session, role) {
  return !!session && session.role === role;
}


/* =========================== DASHBOARD ================================
 * Sheet "Announcements" columns: Title | Date
 * ====================================================================== */

function getDashboard_(session) {
  var announcements = sheetToObjects_('Announcements')
    .map(function (a) { return { title: a.title, date: formatDate_(a.date) }; })
    .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
    .slice(0, 5);

  var todayIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var reportSubmittedToday = sheetToObjects_('WorkReports').some(function (r) {
    return r.employeeName === session.name && formatDate_(r.date) === todayIso;
  });

  // computeSalary_ returns null when the employee has no SalaryBase row yet
  // (e.g. a newly added employee) — fall back to zeros instead of letting
  // the dashboard crash on salary.presentDays / salary.totalWorkingDays.
  var salary = computeSalary_(session.uid) ||
    { monthlySalary: 0, presentDays: 0, actualPresentDays: 0, paidLeaveUsed: 0, paidLeaveEligible: false,
      paidLeaveRemaining: 0, paidLeaveCashoutDays: 0,
      totalWorkingDays: getWorkingDaysPerMonth_(), advanceTaken: 0, history: [] };

  var result = {
    announcements: announcements,
    salary: salary,
    reportSubmittedToday: reportSubmittedToday,
    todayAttendance: todaysAttendanceRow_(session.uid),
    todaysTask: todaysTaskFor_(session.uid)
  };

  if (session.role === 'admin') {
    try {
      var employees = sheetToObjects_('Users').filter(function (u) { return u.role === 'employee'; });
      var attendanceToday = todaysAttendanceByUid_();
      var presentToday = employees.filter(function (u) { return attendanceToday[u.uid] === 'Present'; }).length;

      var nameByUid = {};
      sheetToObjects_('Users').forEach(function (u) { nameByUid[u.uid] = u.name; });
      var pendingLeaves = sheetToObjects_('LeaveRequests').filter(function (r) { return r.status === 'Pending'; });
      var pendingAdvances = sheetToObjects_('AdvanceRequests').filter(function (r) { return r.status === 'Pending'; });

      result.teamAttendanceToday = { present: presentToday, total: employees.length };
      result.pendingApprovals = pendingLeaves.length + pendingAdvances.length;
      // Fed into the notification bell (see navbar.js) so admin sees new
      // employee requests as notifications, not just a passive count.
      result.pendingRequests = pendingLeaves.map(function (r) {
        return { key: 'leave_' + r.id, kind: 'Leave', name: nameByUid[r.uid] || r.uid, date: formatDate_(r.appliedOn) };
      }).concat(pendingAdvances.map(function (r) {
        return { key: 'advance_' + r.id, kind: 'Advance', name: nameByUid[r.uid] || r.uid, date: formatDate_(r.appliedOn) };
      }));
    } catch (e) {
      // LeaveRequests/AdvanceRequests may not exist yet if upgradeEMS()
      // hasn't been run — degrade gracefully instead of breaking the
      // whole admin dashboard over two stat cards.
      result.teamAttendanceToday = { present: 0, total: 0 };
      result.pendingApprovals = 0;
      result.pendingRequests = [];
    }
  }

  return ok_(result);
}


/* ========================== WORK REPORTS ===============================
 * Sheet "WorkReports" columns (must match this order/spelling exactly):
 * Date | Client Name | Employee Name | Work Type | Given | Completed | Rejected | Remark
 * ====================================================================== */

function getWorkReports_(session, payload) {
  var rows = sheetToObjects_('WorkReports');
  if (session.role === 'admin' && payload && payload.employeeName) {
    // Admin viewing one employee's reports (e.g. from the Employees drawer).
    rows = rows.filter(function (r) { return r.employeeName === payload.employeeName; });
  } else if (session.role !== 'admin') {
    rows = rows.filter(function (r) { return r.employeeName === session.name; });
  }
  return ok_({ reports: rows.map(formatWorkReportRow_) });
}

function submitWorkReport_(session, payload) {
  if (!payload.date || !payload.clientName) return fail_('Date and Client Name are required.');
  appendRow_('WorkReports', {
    date: payload.date,
    clientName: payload.clientName,
    employeeName: session.name, // always the logged-in employee — never trust a client-supplied name
    workType: payload.workType || '',
    given: Number(payload.given) || 0,
    completed: Number(payload.completed) || 0,
    rejected: Number(payload.rejected) || 0,
    remark: payload.remark || '',
    submittedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm')
  });
  return ok_();
}

function formatWorkReportRow_(r) {
  return {
    date: formatDate_(r.date), clientName: r.clientName, employeeName: r.employeeName,
    workType: r.workType, given: r.given, completed: r.completed, rejected: r.rejected, remark: r.remark
  };
}


/* ============================== SALARY =================================
 * Figures are always computed from Attendance, never stored pre-calculated.
 * Sheet "SalaryBase" columns: UID | Monthly Salary | Advance Taken
 * Sheet "Attendance" columns: UID | Date | Status | Login Time | Logout Time | Leave Value | Break Start | Break End
 * Sheet "SalaryHistory" columns: UID | Month | Present Days | Earned | Advance | Net Paid | Status
 *
 * Paid leave: Full Time employees (Users."Employment Type") get
 * PAID_LEAVE_DAYS_PER_MONTH days of "Leave" attendance paid the same as a
 * Present day each calendar month. Part Time and Intern employees don't
 * get this — their Leave days stay unpaid. The allowance resets to
 * PAID_LEAVE_DAYS_PER_MONTH every month — it does NOT accumulate as extra
 * leave days to take later. Instead, whatever's left unused when a month
 * ends is converted to its cash value and folded into the *next* month's
 * earnings as a one-time bonus (see leaveCashoutDaysFor_). Both pieces
 * are computed lazily off the Attendance sheet — there's no cron job —
 * so the numbers are always correct as of whenever they're read, even if
 * nobody opened the app for a few months in between.
 *
 * totalWorkingDays comes from the Settings sheet ("Working Days Per
 * Month", editable from the Settings page), falling back to 26 if unset.
 * ====================================================================== */

var PAID_LEAVE_DAYS_PER_MONTH = 1.5;

/** Blank/missing Employment Type defaults to Full Time so existing
 *  employees keep today's behavior until an admin sets it explicitly. */
function isFullTimeEmployee_(uid) {
  var user = sheetToObjects_('Users').find(function (u) { return u.uid === uid; });
  return !user || !user.employmentType || user.employmentType === 'Full Time';
}

/** Total "Leave" days for uid within one specific calendar month
 *  (monthIndex is 0-based, JS Date style) — sums each row's Leave Value
 *  (0.5 for a half-day leave, else defaults to 1) rather than just
 *  counting rows, so half-day leave is reflected correctly. Shared by
 *  this month's live status and the month-end cash-out catch-up below. */
function countLeaveDaysInMonth_(uid, year, monthIndex) {
  return sheetToObjects_('Attendance')
    .filter(function (a) {
      if (a.uid !== uid || a.status !== 'Leave') return false;
      var d = new Date(a.date);
      return d.getFullYear() === year && d.getMonth() === monthIndex;
    })
    .reduce(function (sum, a) { return sum + (Number(a.leaveValue) || 1); }, 0);
}

// Absolute month numbers (year*12 + 0-based monthIndex) make "next month"
// a plain +1 and comparisons plain numeric, instead of juggling Date math.
function monthAbs_(year, monthIndex) { return year * 12 + monthIndex; }
function monthAbsToKey_(abs) {
  var year = Math.floor(abs / 12), monthIndex = abs - year * 12;
  return year + '-' + (monthIndex < 9 ? '0' : '') + (monthIndex + 1);
}
function monthKeyToAbs_(key) {
  var parts = String(key).split('-');
  return monthAbs_(Number(parts[0]), Number(parts[1]) - 1);
}

/** This month's live paid-leave status for uid — always resets fresh
 *  each month, never carries leave days forward. */
function paidLeaveStatus_(uid) {
  var eligible = isFullTimeEmployee_(uid);
  if (!eligible) {
    return { eligible: false, allowance: 0, taken: 0, used: 0, remaining: 0 };
  }
  var now = new Date();
  var taken = countLeaveDaysInMonth_(uid, now.getFullYear(), now.getMonth());
  var used = Math.min(taken, PAID_LEAVE_DAYS_PER_MONTH);
  return {
    eligible: true,
    allowance: PAID_LEAVE_DAYS_PER_MONTH,
    taken: taken,
    used: used,
    remaining: Math.max(0, PAID_LEAVE_DAYS_PER_MONTH - used)
  };
}

/** The cash-out bonus (in days, at the employee's per-day rate) from the
 *  most recently CLOSED month's unused paid leave — added into the
 *  current month's earnings once, then superseded by whatever the next
 *  closed month leaves unused. Backed by the "LeaveCashout" sheet
 *  (UID | Owed Days | Last Closed Month) so this survives across
 *  requests without needing an Apps Script time trigger: every read
 *  catches up any month that has fully elapsed since the last read. */
function leaveCashoutDaysFor_(uid) {
  if (!isFullTimeEmployee_(uid)) return 0;

  var nowAbs = monthAbs_(new Date().getFullYear(), new Date().getMonth());
  var sheet;
  try {
    sheet = getSheet_('LeaveCashout');
  } catch (e) {
    // Sheet doesn't exist yet (upgradeEMS() hasn't been run) — degrade to
    // "nothing owed" instead of throwing and breaking the whole Salary/
    // Dashboard/Attendance page over one not-yet-migrated sheet.
    return 0;
  }
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var uidCol = headers.indexOf('UID');
  var daysCol = headers.indexOf('Owed Days');
  var lastCol = headers.indexOf('Last Closed Month');

  var rowIndex = -1, owedDays = 0, lastClosedAbs = nowAbs - 1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][uidCol]) === String(uid)) {
      rowIndex = r;
      owedDays = Number(data[r][daysCol]) || 0;
      lastClosedAbs = data[r][lastCol] ? monthKeyToAbs_(data[r][lastCol]) : nowAbs - 1;
      break;
    }
  }

  var cursor = lastClosedAbs + 1;
  var closedAny = false;
  while (cursor < nowAbs) {
    var year = Math.floor(cursor / 12), monthIndex = cursor - year * 12;
    var takenThatMonth = countLeaveDaysInMonth_(uid, year, monthIndex);
    // Overwrite, don't accumulate — only the most recently closed month's
    // leftover is ever owed. Matches "resets every month to 1.5": nothing
    // carries further than one month past when it was earned.
    owedDays = Math.max(0, PAID_LEAVE_DAYS_PER_MONTH - takenThatMonth);
    cursor++;
    closedAny = true;
  }

  if (rowIndex === -1) {
    appendRow_('LeaveCashout', { uid: uid, owedDays: owedDays, lastClosedMonth: monthAbsToKey_(nowAbs - 1) });
  } else if (closedAny) {
    sheet.getRange(rowIndex + 1, daysCol + 1).setValue(owedDays);
    sheet.getRange(rowIndex + 1, lastCol + 1).setValue(monthAbsToKey_(nowAbs - 1));
  }
  return owedDays;
}

function getSalary_(session, payload) {
  var uid = (session.role === 'admin' && payload && payload.uid) ? payload.uid : session.uid;
  var salary = computeSalary_(uid);
  if (!salary) return fail_('No salary record found for this employee.');
  return ok_({ salary: salary, uid: uid });
}

function computeSalary_(uid) {
  var base = sheetToObjects_('SalaryBase').find(function (b) { return b.uid === uid; });
  if (!base) return null;

  var leave = paidLeaveStatus_(uid);
  var cashoutDays = leaveCashoutDaysFor_(uid);

  var now = new Date();
  var presentDays = sheetToObjects_('Attendance').filter(function (a) {
    if (a.uid !== uid || a.status !== 'Present') return false;
    var d = new Date(a.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  var totalWorkingDays = getWorkingDaysPerMonth_();
  var history = sheetToObjects_('SalaryHistory').filter(function (h) { return h.uid === uid; });

  return {
    monthlySalary: Number(base.monthlySalary),
    presentDays: presentDays + leave.used + cashoutDays, // what earnings are computed from
    actualPresentDays: presentDays,
    paidLeaveUsed: leave.used,
    paidLeaveEligible: leave.eligible,
    paidLeaveRemaining: leave.remaining,
    paidLeaveCashoutDays: cashoutDays,
    totalWorkingDays: totalWorkingDays,
    advanceTaken: Number(base.advanceTaken) || 0,
    history: history.map(function (h) {
      return { month: formatMonthYear_(h.month), presentDays: h.presentDays, earned: h.earned, advance: h.advance, netPaid: h.netPaid, status: h.status };
    })
  };
}

/** Admin-only: create or update an employee's Monthly Salary / Advance Taken. */
function updateSalary_(payload) {
  if (!payload.uid) return fail_('UID is required.');
  upsertRow_('SalaryBase', 'UID', payload.uid, {
    uid: payload.uid,
    monthlySalary: Number(payload.monthlySalary) || 0,
    advanceTaken: Number(payload.advanceTaken) || 0
  });
  return ok_();
}


/* ========================= ADVANCE SALARY ================================
 * Sheet "AdvanceRequests" columns: ID | UID | Amount | Reason | Status | Applied On
 * Status: Pending / Approved / Rejected. Approving one adds Amount onto
 * that employee's existing SalaryBase.Advance Taken (never overwrites it).
 * ====================================================================== */

function requestAdvance_(session, payload) {
  var amount = Number(payload.amount);
  if (!amount || amount <= 0) return fail_('A valid amount is required.');
  appendRow_('AdvanceRequests', {
    id: Utilities.getUuid(),
    uid: session.uid,
    amount: amount,
    reason: payload.reason || '',
    status: 'Pending',
    appliedOn: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
  });
  return ok_();
}

/** Employees see their own requests; admins see one employee's
 *  (payload.uid) or everyone's when no uid is given. */
function getAdvanceRequests_(session, payload) {
  var rows = sheetToObjects_('AdvanceRequests');
  if (session.role === 'admin' && payload && payload.uid) {
    rows = rows.filter(function (r) { return r.uid === payload.uid; });
  } else if (session.role !== 'admin') {
    rows = rows.filter(function (r) { return r.uid === session.uid; });
  }
  rows = rows.map(function (r) {
    return { id: r.id, uid: r.uid, amount: Number(r.amount), reason: r.reason, status: r.status, appliedOn: formatDate_(r.appliedOn) };
  }).sort(function (a, b) { return String(b.appliedOn).localeCompare(String(a.appliedOn)); });
  return ok_({ requests: rows });
}

/** Admin-only: payload = { id, status: "Approved" | "Rejected" }. */
function approveAdvance_(payload) {
  if (!payload.id || !payload.status) return fail_('ID and Status are required.');
  var reqRow = sheetToObjects_('AdvanceRequests').find(function (r) { return r.id === payload.id; });
  if (!reqRow) return fail_('Advance request not found.');

  updateRowById_('AdvanceRequests', payload.id, { status: payload.status });

  if (payload.status === 'Approved') {
    var base = sheetToObjects_('SalaryBase').find(function (b) { return b.uid === reqRow.uid; });
    upsertRow_('SalaryBase', 'UID', reqRow.uid, {
      uid: reqRow.uid,
      monthlySalary: base ? Number(base.monthlySalary) || 0 : 0,
      advanceTaken: (base ? Number(base.advanceTaken) || 0 : 0) + Number(reqRow.amount)
    });
  }
  return ok_();
}


/* ============================= EMPLOYEES ===============================
 * Admin directory. Reads "Users" (role = employee) + today's "Attendance".
 * ====================================================================== */

function getEmployees_() {
  var users = sheetToObjects_('Users').filter(function (u) { return u.role === 'employee'; });

  var todayIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Today's full Attendance row per uid — status plus Login/Break/Logout
  // detail for the Employees page cards and the "ON BREAK" tag.
  var attendanceTodayByUid = {};
  sheetToObjects_('Attendance').forEach(function (a) {
    if (formatDate_(a.date) === todayIso) attendanceTodayByUid[a.uid] = a;
  });

  var reportedTodayByName = {};
  sheetToObjects_('WorkReports').forEach(function (r) {
    if (formatDate_(r.date) === todayIso) reportedTodayByName[r.employeeName] = r;
  });

  // Pending counts per employee, broken out by kind so the drawer's
  // "Approve Leave (n)" / "Approve Advance (n)" buttons can show the
  // right number each — wrapped in try/catch since these sheets may not
  // exist yet on a Sheet that hasn't run upgradeEMS().
  var pendingLeaveByUid = {}, pendingAdvanceByUid = {};
  try {
    sheetToObjects_('LeaveRequests').forEach(function (r) {
      if (r.status === 'Pending') pendingLeaveByUid[r.uid] = (pendingLeaveByUid[r.uid] || 0) + 1;
    });
    sheetToObjects_('AdvanceRequests').forEach(function (r) {
      if (r.status === 'Pending') pendingAdvanceByUid[r.uid] = (pendingAdvanceByUid[r.uid] || 0) + 1;
    });
  } catch (e) { /* degrade to 0 counts below */ }

  return ok_({
    employees: users.map(function (u) {
      var pendingLeave = pendingLeaveByUid[u.uid] || 0;
      var pendingAdvance = pendingAdvanceByUid[u.uid] || 0;
      var todayRow = attendanceTodayByUid[u.uid];
      var todayReport = reportedTodayByName[u.name];
      var breakStart = todayRow ? formatTime_(todayRow.breakStart) : '';
      var breakEnd = todayRow ? formatTime_(todayRow.breakEnd) : '';
      return {
        uid: u.uid, name: u.name,
        designation: u.designation || 'Employee',
        department: u.department || '',
        employmentType: u.employmentType || 'Full Time',
        status: u.status || 'Active',
        attendanceToday: todayRow ? todayRow.status : 'Not marked',
        onBreak: !!(breakStart && !breakEnd),
        todayLoginTime: todayRow ? formatTime_(todayRow.loginTime) : '',
        todayBreakStart: breakStart,
        todayBreakEnd: breakEnd,
        todayLogoutTime: todayRow ? formatTime_(todayRow.logoutTime) : '',
        reportSubmittedToday: !!todayReport,
        todayReportTime: todayReport ? formatTime_(todayReport.submittedAt) : '',
        pendingLeaveCount: pendingLeave,
        pendingAdvanceCount: pendingAdvance,
        pendingRequestsCount: pendingLeave + pendingAdvance
      };
    })
  });
}

/** Admin-only: set an employee's Designation, Department, and/or
 *  Employment Type (Full Time / Part Time / Intern — only Full Time is
 *  eligible for the paid leave rule in computeSalary_) in the Users
 *  sheet in one go. Only overwrites the fields actually present in
 *  payload. Updates an existing row only; it never creates one. */
function updateEmployeeDetails_(payload) {
  if (!payload.uid) return fail_('UID is required.');
  var sheet = getSheet_('Users');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var uidCol = headers.indexOf('UID');
  var fieldCols = {
    designation: headers.indexOf('Designation'),
    department: headers.indexOf('Department'),
    employmentType: headers.indexOf('Employment Type')
  };

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][uidCol]) === String(payload.uid)) {
      var updated = false;
      ['designation', 'department', 'employmentType'].forEach(function (key) {
        if (payload[key] !== undefined && fieldCols[key] !== -1) {
          sheet.getRange(r + 1, fieldCols[key] + 1).setValue(payload[key]);
          updated = true;
        }
      });
      if (!updated) return fail_('None of Designation/Department/Employment Type columns exist yet — run upgradeEMS() first.');
      return ok_();
    }
  }
  return fail_('Employee not found.');
}

/** Admin-only: add a brand-new employee to the Users sheet, plus a zeroed
 *  SalaryBase row so their Salary page shows real numbers from day one
 *  instead of "no salary record yet". */
function createEmployee_(payload) {
  var uid = String(payload.uid || '').trim();
  var password = String(payload.password || '');
  var name = String(payload.name || '').trim();
  if (!uid || !password || !name) return fail_('UID, Password, and Name are required.');

  var existing = sheetToObjects_('Users').find(function (u) { return String(u.uid).trim() === uid; });
  if (existing) return fail_('UID "' + uid + '" is already in use.');

  appendRow_('Users', {
    uid: uid,
    password: password,
    name: name,
    role: payload.role === 'admin' ? 'admin' : 'employee',
    email: payload.email || '',
    designation: payload.designation || '',
    department: payload.department || '',
    employmentType: payload.employmentType || 'Full Time',
    status: 'Active'
  });
  appendRow_('SalaryBase', { uid: uid, monthlySalary: Number(payload.monthlySalary) || 0, advanceTaken: 0 });
  return ok_();
}

/** Admin-only: payload = { uid, status: "Active" | "Disabled" }. A
 *  Disabled employee stays in the directory (for history/records) but
 *  can't log in — see the check in login_. */
function setEmployeeStatus_(payload) {
  if (!payload.uid || !payload.status) return fail_('UID and Status are required.');
  var sheet = getSheet_('Users');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var uidCol = headers.indexOf('UID');
  var statusCol = headers.indexOf('Status');
  if (statusCol === -1) return fail_('The Users sheet has no "Status" column yet — run upgradeEMS() first.');

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][uidCol]) === String(payload.uid)) {
      sheet.getRange(r + 1, statusCol + 1).setValue(payload.status);
      return ok_();
    }
  }
  return fail_('Employee not found.');
}

function todaysAttendanceByUid_() {
  var todayIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var map = {};
  sheetToObjects_('Attendance').forEach(function (a) {
    if (formatDate_(a.date) === todayIso) map[a.uid] = a.status;
  });
  return map;
}


/* ============================= ATTENDANCE ===============================
 * Sheet "Attendance" columns: UID | Date | Status | Login Time | Logout Time
 * | Leave Value | Break Start | Break End
 * Status: Present / Absent / Leave. Login/Logout/Break Start/Break End are
 * all plain "HH:mm" strings, set by markAttendance_/markBreak_ when the
 * employee uses the Dashboard's Login/Logout and Take Break/End Break
 * buttons — this is what "today's working hours" is computed from
 * client-side. Break is a single window per day (start once, end once —
 * the button locks once both are set, same as Login/Logout).
 * ====================================================================== */

/** payload.type: "login" or "logout". Creates today's row on first login
 *  of the day (Status becomes Present), or fills Logout Time on an
 *  existing row. Won't overwrite a time that's already set, so double
 *  clicking doesn't reset it. */
function markAttendance_(session, payload) {
  var type = payload.type;
  if (type !== 'login' && type !== 'logout') return fail_('type must be "login" or "logout".');

  var todayIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  var sheet = getSheet_('Attendance');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var col = {
    uid: headers.indexOf('UID'), date: headers.indexOf('Date'), status: headers.indexOf('Status'),
    loginTime: headers.indexOf('Login Time'), logoutTime: headers.indexOf('Logout Time')
  };

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][col.uid]) === session.uid && formatDate_(data[r][col.date]) === todayIso) {
      if (type === 'login' && !data[r][col.loginTime]) sheet.getRange(r + 1, col.loginTime + 1).setValue(now);
      if (type === 'logout') sheet.getRange(r + 1, col.logoutTime + 1).setValue(now);
      return ok_({ todayAttendance: todaysAttendanceRow_(session.uid) });
    }
  }

  if (type === 'login') {
    appendRow_('Attendance', { uid: session.uid, date: todayIso, status: 'Present', loginTime: now, logoutTime: '' });
  } else {
    return fail_("Can't log out — no login recorded for today yet.");
  }
  return ok_({ todayAttendance: todaysAttendanceRow_(session.uid) });
}

function todaysAttendanceRow_(uid) {
  var todayIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var row = sheetToObjects_('Attendance').find(function (a) {
    return a.uid === uid && formatDate_(a.date) === todayIso;
  });
  if (!row) return { status: 'Not marked', loginTime: '', logoutTime: '', breakStart: '', breakEnd: '' };
  return {
    status: row.status, loginTime: formatTime_(row.loginTime), logoutTime: formatTime_(row.logoutTime),
    breakStart: formatTime_(row.breakStart), breakEnd: formatTime_(row.breakEnd)
  };
}

/** payload.type: "start" or "end". Same one-row-per-day pattern as
 *  markAttendance_, but for Break Start/Break End — only one break
 *  window per day (up to the employee's 1 hour allowance, not enforced
 *  here, just tracked): the button locks once both are set, same as how
 *  Logout locks once it's filled. Requires an existing login row for
 *  today, and refuses once the employee has already logged out. */
function markBreak_(session, payload) {
  var type = payload.type;
  if (type !== 'start' && type !== 'end') return fail_('type must be "start" or "end".');

  var todayIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  var sheet = getSheet_('Attendance');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var col = {
    uid: headers.indexOf('UID'), date: headers.indexOf('Date'),
    loginTime: headers.indexOf('Login Time'), logoutTime: headers.indexOf('Logout Time'),
    breakStart: headers.indexOf('Break Start'), breakEnd: headers.indexOf('Break End')
  };
  if (col.breakStart === -1 || col.breakEnd === -1) return fail_('Break Start/Break End columns don\'t exist yet — run upgradeEMS() first.');

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][col.uid]) === session.uid && formatDate_(data[r][col.date]) === todayIso) {
      if (!data[r][col.loginTime]) return fail_('Log in before taking a break.');
      if (data[r][col.logoutTime]) return fail_('Already logged out for today.');
      if (type === 'start') {
        if (data[r][col.breakStart]) return fail_('Break already taken today.');
        sheet.getRange(r + 1, col.breakStart + 1).setValue(now);
      } else {
        if (!data[r][col.breakStart]) return fail_("Break hasn't started yet.");
        if (data[r][col.breakEnd]) return fail_('Break already ended.');
        sheet.getRange(r + 1, col.breakEnd + 1).setValue(now);
      }
      return ok_({ todayAttendance: todaysAttendanceRow_(session.uid) });
    }
  }
  return fail_('Log in before taking a break.');
}

/** Every attendance row for one employee (session.uid, or payload.uid
 *  when an admin is looking at someone else's record) — used to color
 *  the Attendance calendar's present/absent days. */
function getAttendanceCalendar_(session, payload) {
  var uid = (session.role === 'admin' && payload && payload.uid) ? payload.uid : session.uid;
  var rows = sheetToObjects_('Attendance')
    .filter(function (a) { return a.uid === uid; })
    .map(function (a) {
      return {
        date: formatDate_(a.date), status: a.status, loginTime: formatTime_(a.loginTime), logoutTime: formatTime_(a.logoutTime),
        breakStart: formatTime_(a.breakStart), breakEnd: formatTime_(a.breakEnd)
      };
    });
  var leave = paidLeaveStatus_(uid);
  leave.cashoutDays = leaveCashoutDaysFor_(uid);
  return ok_({ records: rows, paidLeave: leave });
}


/* ================================ LEAVE ==================================
 * Sheet "LeaveRequests" columns: ID | UID | From | To | Type | Duration | Reason | Status | Applied On
 * Status: Pending / Approved / Rejected. Duration: "Full Day" or "Half Day"
 * — Half Day is only meaningful for a single date (From === To); the
 * frontend enforces that by locking To to From when Half Day is picked.
 * Applying doesn't touch Attendance directly — approving does, see below.
 * ====================================================================== */

function applyLeave_(session, payload) {
  if (!payload.from || !payload.to) return fail_('From and To dates are required.');
  var duration = payload.duration === 'Half Day' ? 'Half Day' : 'Full Day';
  if (duration === 'Half Day' && payload.from !== payload.to) {
    return fail_('Half Day leave must be a single date — From and To must match.');
  }
  appendRow_('LeaveRequests', {
    id: Utilities.getUuid(),
    uid: session.uid,
    from: payload.from,
    to: payload.to,
    type: payload.type || 'Casual Leave',
    duration: duration,
    reason: payload.reason || '',
    status: 'Pending',
    appliedOn: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
  });
  return ok_();
}

/** Employees see their own requests; admins see one employee's
 *  (payload.uid) or everyone's when no uid is given. */
function getLeaves_(session, payload) {
  var rows = sheetToObjects_('LeaveRequests');
  if (session.role === 'admin' && payload && payload.uid) {
    rows = rows.filter(function (r) { return r.uid === payload.uid; });
  } else if (session.role !== 'admin') {
    rows = rows.filter(function (r) { return r.uid === session.uid; });
  }
  rows = rows.map(function (r) {
    return {
      id: r.id, uid: r.uid, from: formatDate_(r.from), to: formatDate_(r.to), type: r.type,
      duration: r.duration || 'Full Day', reason: r.reason, status: r.status, appliedOn: formatDate_(r.appliedOn)
    };
  }).sort(function (a, b) { return String(b.appliedOn).localeCompare(String(a.appliedOn)); });
  return ok_({ leaves: rows });
}

/** Admin-only: payload = { id, status: "Approved" | "Rejected" }. Approving
 *  also marks every date in the request's From-To range as Status "Leave"
 *  in Attendance (Leave Value 0.5 for a Half Day request, else 1) —
 *  without this, paidLeaveStatus_ (which counts leave straight off
 *  Attendance) would never see the leave as taken, no matter how many
 *  requests get approved. */
function approveLeave_(payload) {
  if (!payload.id || !payload.status) return fail_('ID and Status are required.');
  var reqRow = sheetToObjects_('LeaveRequests').find(function (r) { return r.id === payload.id; });
  if (!reqRow) return fail_('Leave request not found.');

  updateRowById_('LeaveRequests', payload.id, { status: payload.status });

  if (payload.status === 'Approved') {
    var dayValue = reqRow.duration === 'Half Day' ? 0.5 : 1;
    markAttendanceLeaveRange_(reqRow.uid, formatDate_(reqRow.from), formatDate_(reqRow.to), dayValue);
  }
  return ok_();
}

/** Marks every date from `from` to `to` (inclusive, "yyyy-MM-dd") as
 *  Status "Leave" (Leave Value `dayValue`, 1 for a full day / 0.5 for a
 *  half day) for uid in Attendance — updates the row in place if one
 *  already exists for that date (an approved leave supersedes whatever
 *  was there), otherwise creates it. */
function markAttendanceLeaveRange_(uid, from, to, dayValue) {
  var sheet = getSheet_('Attendance');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var col = {
    uid: headers.indexOf('UID'), date: headers.indexOf('Date'), status: headers.indexOf('Status'),
    leaveValue: headers.indexOf('Leave Value')
  };

  var cursor = new Date(from + 'T00:00:00');
  var end = new Date(to + 'T00:00:00');
  while (cursor <= end) {
    var iso = Utilities.formatDate(cursor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var found = false;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][col.uid]) === String(uid) && formatDate_(data[r][col.date]) === iso) {
        sheet.getRange(r + 1, col.status + 1).setValue('Leave');
        if (col.leaveValue !== -1) sheet.getRange(r + 1, col.leaveValue + 1).setValue(dayValue);
        found = true;
        break;
      }
    }
    if (!found) {
      appendRow_('Attendance', { uid: uid, date: iso, status: 'Leave', loginTime: '', logoutTime: '', leaveValue: dayValue });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
}


/* =============================== LETTERS ==================================
 * Sheet "Letters" columns: ID | UID | Type | Message | Date | Issued By
 * Type: Warning / Appreciation / Note. Write-only from the employee's
 * side — they just show up in that employee's Profile page history.
 * ====================================================================== */

function issueLetter_(session, payload) {
  if (!payload.uid || !payload.type) return fail_('UID and Type are required.');
  appendRow_('Letters', {
    id: Utilities.getUuid(),
    uid: payload.uid,
    type: payload.type,
    message: payload.message || '',
    date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    issuedBy: session.name
  });
  return ok_();
}

/** Employees see their own; admins can pass payload.uid to see one
 *  employee's (e.g. from the Employees drawer). */
function getLetters_(session, payload) {
  var uid = (session.role === 'admin' && payload && payload.uid) ? payload.uid : session.uid;
  var rows = sheetToObjects_('Letters')
    .filter(function (l) { return l.uid === uid; })
    .map(function (l) { return { type: l.type, message: l.message, date: formatDate_(l.date), issuedBy: l.issuedBy }; })
    .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  return ok_({ letters: rows });
}


/* =============================== DRIVE ================================= */

function getDriveLinks_() {
  var rows = sheetToObjects_('DriveLinks').map(function (l) {
    return { title: l.title, icon: l.icon || String(l.title || '').slice(0, 2).toUpperCase(), url: l.url };
  });
  return ok_({ links: rows });
}


/* ============================ DAILY TASKS ================================
 * Sheet "DailyTasks" columns: Date | UID | Title | URL | Assigned By
 * Admin assigns one Drive link "today's work" per employee per day; that
 * employee sees it as the Dashboard's "Today's Task Drive Link" card.
 * ====================================================================== */

/** Admin-only: payload = { uid, date, title, url }. One row per
 *  employee per day — assigning again for the same day updates it
 *  instead of creating a duplicate. */
function assignDailyTask_(session, payload) {
  if (!payload.uid || !payload.date || !payload.url) return fail_('Employee, Date, and Drive Link URL are required.');
  upsertDailyTask_(payload.uid, payload.date, payload.title || '', payload.url, session.name);
  return ok_();
}

function upsertDailyTask_(uid, date, title, url, assignedBy) {
  var sheet = getSheet_('DailyTasks');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var col = {
    date: headers.indexOf('Date'), uid: headers.indexOf('UID'),
    title: headers.indexOf('Title'), url: headers.indexOf('URL'), assignedBy: headers.indexOf('Assigned By')
  };

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][col.uid]) === String(uid) && formatDate_(data[r][col.date]) === date) {
      sheet.getRange(r + 1, col.title + 1).setValue(title);
      sheet.getRange(r + 1, col.url + 1).setValue(url);
      sheet.getRange(r + 1, col.assignedBy + 1).setValue(assignedBy);
      return;
    }
  }
  appendRow_('DailyTasks', { date: date, uid: uid, title: title, url: url, assignedBy: assignedBy });
}

/** { title, url } for uid's task today, or null if none assigned (or the
 *  DailyTasks sheet doesn't exist yet — degrade gracefully rather than
 *  breaking the whole Dashboard over one not-yet-migrated sheet). */
function todaysTaskFor_(uid) {
  try {
    var todayIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var row = sheetToObjects_('DailyTasks').find(function (t) {
      return t.uid === uid && formatDate_(t.date) === todayIso;
    });
    return row ? { title: row.title || "Today's Task", url: row.url } : null;
  } catch (e) {
    return null;
  }
}


/* ============================== HOLIDAYS ================================
 * The employee-vs-admin difference (current month only vs. all 12 months)
 * is applied client-side in assets/js/pages/holidays.js — both roles share
 * this one endpoint, which always returns the full year.
 * ====================================================================== */

function getHolidays_() {
  var rows = sheetToObjects_('Holidays').map(function (h) {
    return { date: formatDate_(h.date), name: h.name, type: h.type };
  });
  return ok_({ holidays: rows });
}

function addHoliday_(payload) {
  if (!payload.date || !payload.name) return fail_('Date and Name are required.');
  appendRow_('Holidays', { date: payload.date, name: payload.name, type: payload.type || 'Festival' });
  return ok_();
}


/* =============================== ACCOUNT =================================
 * Self-service change-password — any logged-in user, their own account only.
 * ====================================================================== */

function changePassword_(session, payload) {
  var current = String(payload.current || '');
  var next = String(payload.next || '');
  if (!current || !next) return fail_('Current and new password are required.');
  if (next.length < 6) return fail_('New password must be at least 6 characters.');

  var sheet = getSheet_('Users');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var uidCol = headers.indexOf('UID');
  var passCol = headers.indexOf('Password');

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][uidCol]) === session.uid) {
      if (String(data[r][passCol]) !== current) return fail_('Current password is incorrect.');
      sheet.getRange(r + 1, passCol + 1).setValue(next);
      return ok_();
    }
  }
  return fail_('User not found.');
}


/* =============================== SETTINGS =================================
 * Sheet "Settings" columns: Key | Value — a simple key/value store.
 * Keys used today: "Company Name", "Working Days Per Month".
 * ====================================================================== */

function getSettings_() {
  var map = {};
  sheetToObjects_('Settings').forEach(function (r) { map[r.key] = r.value; });
  return ok_({
    companyName: map['Company Name'] || 'Aurien Media',
    workingDaysPerMonth: Number(map['Working Days Per Month']) || 26
  });
}

/** Admin-only: only overwrites the keys actually present in payload. */
function saveSettings_(payload) {
  if (payload.companyName !== undefined) {
    upsertRow_('Settings', 'Key', 'Company Name', { key: 'Company Name', value: payload.companyName });
  }
  if (payload.workingDaysPerMonth !== undefined) {
    upsertRow_('Settings', 'Key', 'Working Days Per Month', { key: 'Working Days Per Month', value: Number(payload.workingDaysPerMonth) || 26 });
  }
  return ok_();
}

function getWorkingDaysPerMonth_() {
  var row = sheetToObjects_('Settings').find(function (r) { return r.key === 'Working Days Per Month'; });
  return (row && Number(row.value)) || 26;
}


/* =============================== UTILS ==================================
 * Shared sheet access / response helpers. Everything above goes through
 * these instead of touching SpreadsheetApp directly, so the sheet layout
 * can change in one place.
 * ====================================================================== */

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: "' + name + '". Run setupEMS() from Setup.gs first.');
  return sheet;
}

/** Reads a sheet into an array of objects keyed by its header row (camelCased). */
function sheetToObjects_(sheetName) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h).trim(); });
  return values.slice(1)
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[toCamel_(h)] = row[i]; });
      return obj;
    });
}

/** Appends one row to a sheet, matching values to columns by header name. */
function appendRow_(sheetName, rowObject) {
  var sheet = getSheet_(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var row = headers.map(function (h) {
    var key = toCamel_(h);
    return rowObject[key] !== undefined ? rowObject[key] : '';
  });
  sheet.appendRow(row);
}

/** Finds the first row where matchHeader === matchValue and updates it in
 *  place; appends a new row instead if no match is found. Used by
 *  updateSalary_ so re-saving an employee's salary edits their existing
 *  row rather than creating a duplicate. */
function upsertRow_(sheetName, matchHeader, matchValue, rowObject) {
  var sheet = getSheet_(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var matchCol = headers.indexOf(matchHeader);
  if (matchCol === -1) throw new Error('Column "' + matchHeader + '" not found in ' + sheetName);

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][matchCol]) === String(matchValue)) {
      headers.forEach(function (h, c) {
        var key = toCamel_(h);
        if (rowObject[key] !== undefined) sheet.getRange(r + 1, c + 1).setValue(rowObject[key]);
      });
      return;
    }
  }
  appendRow_(sheetName, rowObject);
}

/** Finds the row where the "ID" column matches id and updates the given
 *  fields in place. Unlike upsertRow_, this throws instead of appending
 *  when no match is found — there's never a valid reason to "create by
 *  ID" for a request row that's supposed to already exist. */
function updateRowById_(sheetName, id, fields) {
  var sheet = getSheet_(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var idCol = headers.indexOf('ID');
  if (idCol === -1) throw new Error('Column "ID" not found in ' + sheetName);

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) {
      headers.forEach(function (h, c) {
        var key = toCamel_(h);
        if (fields[key] !== undefined) sheet.getRange(r + 1, c + 1).setValue(fields[key]);
      });
      return;
    }
  }
  throw new Error('Row not found: ' + id);
}

/** "UID" -> "uid", "Client Name" -> "clientName", "URL" -> "url".
 *  Splits on any run of non-alphanumeric characters, lowercases the
 *  first word entirely (this is what the old regex-replace version
 *  got wrong for single all-caps words like "UID"/"URL" — it only
 *  lowercased the first letter, leaving keys like "uID"), and
 *  Titlecases the rest. */
function toCamel_(header) {
  var words = String(header).trim().split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return words.map(function (w, i) {
    var lower = w.toLowerCase();
    return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');
}

/** Dates read from a sheet come back as JS Date objects — normalize to yyyy-MM-dd. */
function formatDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

/** Login/Logout Time is written as a plain "HH:mm" string by
 *  markAttendance_, but Range.setValue() auto-detects value types the
 *  same way typing into the sheet does — since that column isn't forced
 *  to Plain Text format, Sheets silently stores it as a time serial. On
 *  the next read, getValues() then returns a JS Date object (Sheets'
 *  1899-12-30 time-only epoch) instead of the original string, which
 *  breaks any "HH:mm".split(":") math downstream. Normalize both shapes
 *  back to "HH:mm" here, same idea as formatDate_ above. */
function formatTime_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  return value || '';
}

/** SalaryHistory's "Month" column holds text like "Jul 2026" — same trap
 *  as Login/Logout Time: if that text is ever typed straight into the
 *  cell, Sheets auto-detects it as a date and stores a Date object
 *  instead, which would otherwise serialize to a full ISO timestamp.
 *  Normalize back to "MMM yyyy" so only the month & year name shows. */
function formatMonthYear_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'MMM yyyy');
  }
  return value;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ok_(data) {
  data = data || {};
  data.ok = true;
  return jsonResponse_(data);
}

function fail_(message) {
  return jsonResponse_({ ok: false, error: message });
}
