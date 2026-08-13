/**
 * Setup.gs — two entry points:
 *
 *   setupEMS()   — run once on a brand-new Sheet. Creates every tab this
 *                  app needs, with headers and a small set of sample rows.
 *
 *   upgradeEMS() — run once on a Sheet that was already set up with an
 *                  older version of this app, to pick up new sheets/
 *                  columns added since (Designation, Department,
 *                  Employment Type, Status, Photo URL, Documents Folder
 *                  URL, Login Time/Logout Time, Leave Value, Break Start/Break End,
 *                  WorkReports.Submitted At, WorkReports.ID (backfilled
 *                  for existing rows so old reports become editable),
 *                  Holidays.ID (same backfill, for Edit/Delete Holiday),
 *                  LeaveRequests, AdvanceRequests,
 *                  Letters, Settings, LeaveCashout, DailyTasks,
 *                  LeaveRequests.Duration for half-day leave) and the
 *                  WorkReports rename (Editor Name -> Employee Name,
 *                  Video Type -> Work Type, Edited -> Completed) without
 *                  editing anything by hand. Also deletes the "Working
 *                  Days Per Month" Settings row — salary now uses the
 *                  real calendar month length instead, so that row is
 *                  no longer read by anything.
 *
 * Both are safe to re-run any time — every step only adds what's
 * missing (a blank header, a blank column, a missing sheet), relabels
 * a header cell in place, or deletes one specific now-unused row.
 * Existing data is never touched, duplicated, or overwritten otherwise.
 *
 * How to run either: open this Sheet's Apps Script project, pick the
 * function from the dropdown at the top of the editor, and click Run.
 */

function setupEMS() {
  ensureSheet_('Users', ['UID', 'Password', 'Name', 'Role', 'Email', 'Designation', 'Department', 'Employment Type', 'Status', 'Photo URL', 'Documents Folder URL'], [
    ['EMP001', 'emp123', 'Aarav Shah', 'employee', 'aarav@aurienmedia.in', 'Video Editor', 'Creative', 'Full Time', 'Active', '', ''],
    ['ADM001', 'admin123', 'Priya Mehta', 'admin', 'priya@aurienmedia.in', 'Operations Manager', 'Operations', 'Full Time', 'Active', '', '']
  ]);

  ensureSheet_('WorkReports',
    ['ID', 'Date', 'Client Name', 'Employee Name', 'Work Type', 'Given', 'Completed', 'Rejected', 'Remark', 'Submitted At'], [
      [Utilities.getUuid(), new Date('2026-08-01'), 'DeoDap International', 'Aarav Shah', 'Video Creatives', 5, 5, 1, '1 rejected — audio sync issue, re-edited next day', '18:20'],
      [Utilities.getUuid(), new Date('2026-08-03'), 'Jolly World Tour', 'Aarav Shah', 'Long Form Videos', 2, 2, 0, 'Delivered on time, no revisions', '18:05']
    ]);

  ensureSheet_('Attendance', ['UID', 'Date', 'Status', 'Login Time', 'Logout Time', 'Leave Value', 'Break Start', 'Break End'], [
    ['EMP001', new Date('2026-08-01'), 'Present', '09:05', '18:12', '', '13:00', '13:30'],
    ['EMP001', new Date('2026-08-03'), 'Present', '09:00', '17:55', '', '13:10', '13:40']
  ]);

  ensureSheet_('SalaryBase', ['UID', 'Monthly Salary', 'Advance Taken'], [
    ['EMP001', 32000, 3000],
    ['ADM001', 45000, 0]
  ]);

  ensureSheet_('SalaryHistory',
    ['UID', 'Month', 'Present Days', 'Earned', 'Advance', 'Net Paid', 'Status'], [
      ['EMP001', 'Jul 2026', 25, 30770, 2000, 28770, 'Paid'],
      ['EMP001', 'Jun 2026', 24, 29538, 0, 29538, 'Paid']
    ]);

  ensureSheet_('Holidays', ['ID', 'Date', 'Name', 'Type'], [
    [Utilities.getUuid(), new Date('2026-01-26'), 'Republic Day', 'National'],
    [Utilities.getUuid(), new Date('2026-03-04'), 'Holi', 'Festival'],
    [Utilities.getUuid(), new Date('2026-03-27'), 'Ram Navami', 'Festival'],
    [Utilities.getUuid(), new Date('2026-04-03'), 'Good Friday', 'Festival'],
    [Utilities.getUuid(), new Date('2026-05-01'), 'Labour Day', 'National'],
    [Utilities.getUuid(), new Date('2026-06-17'), 'Eid al-Adha', 'Festival'],
    [Utilities.getUuid(), new Date('2026-08-15'), 'Independence Day', 'National'],
    [Utilities.getUuid(), new Date('2026-08-28'), 'Janmashtami', 'Festival'],
    [Utilities.getUuid(), new Date('2026-09-14'), 'Ganesh Chaturthi', 'Festival'],
    [Utilities.getUuid(), new Date('2026-10-02'), 'Gandhi Jayanti', 'National'],
    [Utilities.getUuid(), new Date('2026-11-08'), 'Diwali', 'Festival'],
    [Utilities.getUuid(), new Date('2026-12-25'), 'Christmas', 'Festival']
  ]);
  // ^ Sample dates for testing the calendar — replace with your real company list.

  ensureSheet_('Announcements', ['Title', 'Date'], [
    ['Office closed Aug 15 for Independence Day', new Date('2026-08-04')],
    ['New client onboarding: DeoDap Q3 campaign', new Date('2026-08-02')]
  ]);

  ensureSheet_('DriveLinks', ['Title', 'Icon', 'URL'], [
    ['Daily Task Folder', 'DT', 'https://drive.google.com/drive/folders/daily-tasks'],
    ['SOPs', 'SOP', 'https://drive.google.com/drive/folders/sops'],
    ['Company Documents', 'CD', 'https://drive.google.com/drive/folders/company-docs'],
    ['Shared Resources', 'SR', 'https://drive.google.com/drive/folders/shared-resources']
  ]);

  ensureNewFeatureSheets_();

  SpreadsheetApp.getActiveSpreadsheet().toast('All sheets created with sample data.', 'Setup complete', 5);
}

/** Run this once if you set up this app before Leave/Advance/Letters/
 *  Settings/Employment Type/Status/Disable-Employee/the WorkReports
 *  rename existed. Adds everything those features need to an
 *  already-deployed Sheet. */
function upgradeEMS() {
  ensureColumns_('Users', ['Designation', 'Department', 'Employment Type', 'Status', 'Photo URL', 'Documents Folder URL']);
  ensureColumns_('Attendance', ['Login Time', 'Logout Time', 'Leave Value', 'Break Start', 'Break End']);
  ensureColumns_('WorkReports', ['Submitted At', 'ID']);
  ensureColumns_('Holidays', ['ID']);
  backfillUsersDefaults_();
  backfillWorkReportIds_();
  backfillHolidayIds_();
  ensureNewFeatureSheets_();
  ensureColumns_('LeaveRequests', ['Duration']); // no-op on a brand-new sheet — ensureNewFeatureSheets_ above already includes it
  clearEmojiDriveIcons_();
  renameWorkReportsColumns_();
  removeSettingsRow_('Working Days Per Month'); // salary now uses the real calendar month length instead

  SpreadsheetApp.getActiveSpreadsheet().toast('Upgrade complete — new sheets and columns are ready.', 'upgradeEMS', 5);
}

/** Deletes the Settings row with this Key, if one exists — used to clean
 *  up a setting that's no longer read by any code path. No-op if the
 *  Settings sheet or that row doesn't exist. */
function removeSettingsRow_(key) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var keyCol = headers.indexOf('Key');
  if (keyCol === -1) return;
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][keyCol]) === key) sheet.deleteRow(r + 1);
  }
}

/** "Editor Name" -> "Employee Name", "Video Type" -> "Work Type",
 *  "Edited" -> "Completed" — relabels the header cell in place, so
 *  existing rows' data stays lined up under their (renamed) column.
 *  No-op for a header that's already been renamed or doesn't exist. */
function renameWorkReportsColumns_() {
  renameColumn_('WorkReports', 'Editor Name', 'Employee Name');
  renameColumn_('WorkReports', 'Video Type', 'Work Type');
  renameColumn_('WorkReports', 'Edited', 'Completed');
}

function renameColumn_(sheetName, fromHeader, toHeader) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return;
  var lastCol = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var col = headers.indexOf(fromHeader);
  if (col === -1) return; // already renamed, or never existed under the old name
  sheet.getRange(1, col + 1).setValue(toHeader);
}

/** The sheets added alongside Leave/Advance-Salary/Letters/Settings.
 *  Shared by setupEMS (fresh install) and upgradeEMS (existing install)
 *  so both stay in sync automatically. */
function ensureNewFeatureSheets_() {
  ensureSheet_('LeaveRequests', ['ID', 'UID', 'From', 'To', 'Type', 'Duration', 'Reason', 'Status', 'Applied On'], []);
  ensureSheet_('AdvanceRequests', ['ID', 'UID', 'Amount', 'Reason', 'Status', 'Applied On'], []);
  ensureSheet_('Letters', ['ID', 'UID', 'Type', 'Message', 'Date', 'Issued By'], []);
  ensureSheet_('Settings', ['Key', 'Value'], [
    ['Company Name', 'Aurien Media']
  ]);
  // Tracks each Full Time employee's paid-leave cash-out: how many days of
  // last month's unused 1.5-day allowance are owed as a one-time salary
  // bonus this month. Never seeded — computeSalary_/getAttendanceCalendar_
  // create a row for a UID the first time they need one.
  ensureSheet_('LeaveCashout', ['UID', 'Owed Days', 'Last Closed Month'], []);
  // Admin assigns one Drive link "today's work" per employee per day.
  ensureSheet_('DailyTasks', ['Date', 'UID', 'Title', 'URL', 'Assigned By'], []);
}

/** DriveLinks rows created before this update may still have an emoji in
 *  their Icon cell (that used to be the built-in default). Blank it out
 *  so getDriveLinks_'s fallback — the title's first two letters — takes
 *  over instead; it never touches an Icon cell that isn't emoji, so any
 *  icon you've since set on purpose is left alone. */
function clearEmojiDriveIcons_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DriveLinks');
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var iconCol = headers.indexOf('Icon');
  if (iconCol === -1) return;

  var emojiPattern = /[\u{1F000}-\u{1FFFF}\u{2190}-\u{2BFF}\u{2600}-\u{27BF}]/u;
  for (var r = 1; r < data.length; r++) {
    var val = String(data[r][iconCol] || '');
    if (emojiPattern.test(val)) sheet.getRange(r + 1, iconCol + 1).setValue('');
  }
}

/** WorkReports rows submitted before the ID column existed have a blank
 *  ID cell — editing a report requires one, so give every blank-ID row
 *  a fresh UUID. Never touches a row that already has an ID. */
function backfillWorkReportIds_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('WorkReports');
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var idCol = headers.indexOf('ID');
  if (idCol === -1) return;

  for (var r = 1; r < data.length; r++) {
    if (data[r].join('') === '') continue; // skip blank rows
    if (!data[r][idCol]) sheet.getRange(r + 1, idCol + 1).setValue(Utilities.getUuid());
  }
}

/** Same idea as backfillWorkReportIds_, for Holidays rows added before
 *  its ID column existed — editing/deleting a holiday requires one. */
function backfillHolidayIds_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Holidays');
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var idCol = headers.indexOf('ID');
  if (idCol === -1) return;

  for (var r = 1; r < data.length; r++) {
    if (data[r].join('') === '') continue;
    if (!data[r][idCol]) sheet.getRange(r + 1, idCol + 1).setValue(Utilities.getUuid());
  }
}

/** Existing employees added before Employment Type / Status existed get
 *  blank cells for those columns — code already treats blank as "Full
 *  Time" / "Active", but writing the value explicitly makes the sheet
 *  itself the source of truth instead of relying on a fallback. */
function backfillUsersDefaults_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var typeCol = headers.indexOf('Employment Type');
  var statusCol = headers.indexOf('Status');

  for (var r = 1; r < data.length; r++) {
    if (data[r].join('') === '') continue; // skip blank rows
    if (typeCol !== -1 && !data[r][typeCol]) sheet.getRange(r + 1, typeCol + 1).setValue('Full Time');
    if (statusCol !== -1 && !data[r][statusCol]) sheet.getRange(r + 1, statusCol + 1).setValue('Active');
  }
}

/** Creates the tab if it's missing, writes the header row if it's missing,
 *  and seeds sample rows ONLY when the sheet has no data rows yet. */
function ensureSheet_(name, headers, sampleRows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  var existingHeader = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  var hasHeader = existingHeader.some(function (h) { return String(h).trim() !== ''; });
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  if (sheet.getLastRow() < 2 && sampleRows && sampleRows.length) {
    sheet.getRange(2, 1, sampleRows.length, headers.length).setValues(sampleRows);
  }
}

/** Adds any of `columnNames` that aren't already present as a header in
 *  `sheetName`, appending them as new trailing columns — existing
 *  columns and data are left completely untouched. No-op if the sheet
 *  itself doesn't exist yet (ensureSheet_ handles that case instead). */
function ensureColumns_(sheetName, columnNames) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return;
  var lastCol = Math.max(1, sheet.getLastColumn());
  var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });

  columnNames.forEach(function (name) {
    if (existing.indexOf(name) === -1) {
      lastCol++;
      sheet.getRange(1, lastCol).setValue(name).setFontWeight('bold');
      existing.push(name);
    }
  });
}
