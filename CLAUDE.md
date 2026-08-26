# AM - EMS

Employee Management System for Aurien Media — live production app (attendance, salary, leave, advances, overtime, letters, work reports). Google Apps Script backend + Google Sheets as the database, vanilla-JS/HTML/CSS frontend (installable PWA).

## Deploy model — read this first

- `apps-script/` and `README.md` are **gitignored** (see `.gitignore`, commit `401aa7f`). Editing `Code.gs`/`Setup.gs` produces **no git diff, no commit trail** — the only record of a backend change is what gets said out loud and what's manually pasted into the Apps Script editor.
- Backend deploy is entirely manual: paste the updated file into the Apps Script editor for this Sheet, then **Deploy → Manage deployments → New version**. There is no clasp/CI push.
- `apps-script/Setup.gs` has two entry points, both idempotent/safe to re-run:
  - `setupEMS()` — brand-new Sheet only. Its `ensureSheet_` helper only writes a header row when the sheet has *no* header at all, so re-running it on an already-deployed Sheet will **not** retroactively add new columns.
  - `upgradeEMS()` — the one to use on this live Sheet. Additive/idempotent (`ensureColumns_`, backfills, header renames, `ensureNewFeatureSheets_`); never touches existing data. **Any change to `Code.gs` that adds/renames a sheet, column, or header needs a matching step added to `upgradeEMS()`, and the user needs to be told to run it.**

## Fragile duplication — keep these in sync by hand

- **"Present Days" is computed independently in three places and must stay conceptually consistent**: backend `computeSalary_` (Code.gs, folds in Sunday bonus + paid leave used + cashout + **overtime** — this is the payroll number), `assets/js/pages/attendance.js` (`presentCount_`/`countsFor`, **excludes overtime**, shown as a separate sub-line), and `employees.js`'s admin `openAttendanceViewModal` (also excludes overtime, separate reimplementation). This exact class of bug was already fixed once (commit `20d18ff`, then again for attendance.js in this session) — a future change to how overtime/leave/Sundays factor into "present" must be applied in all three places or the Dashboard's payroll figure will silently diverge from what the Attendance pages show.
- `employees.js`'s `presentDaysSub` and `salary.js`'s `presentDaysSub` are intentional byte-for-byte duplicates (comment calls this out) — wording must stay identical or the admin drawer and the employee's own Salary page will disagree.
- `SIGNATORIES` in `assets/js/components/letterDoc.js` is a hardcoded list of real people who can sign Warning/Appreciation letters, duplicated into the "Issued By" dropdown in `employees.js`. Not sheet-driven — update here by hand if a signatory changes.
- Holiday/DriveLinks caching uses `State.get("holidays")` / `State.get("driveLinks")` (assets/js/core/state.js) by convention across `attendance.js`, `dashboard.js`, `drive.js` — no central cache manager. A new page reading these must use the same keys and respect the same invalidation points.
- Client-side "is today a paid day off" (Sunday/holiday) checks (e.g. dashboard.js disabling the Login button) are UI-only conveniences; the real enforcement is server-side in `markAttendance_`/`isPaidDayOff_` via `freeSundays_`. Don't assume the button state reflects actual login eligibility if holiday data is stale client-side.

## Safety-critical / permission-gated

- `canManageTarget_` (Code.gs) is the only thing stopping a regular Admin from acting on another Admin's account. It's re-checked individually at 8+ call sites (salary, attendance, letters, work reports, password reset, status, edit details). **Any new admin endpoint accepting a `uid` payload must call this too**, or it reopens a privilege-escalation hole.
- `closeSalaryMonth_` is irreversible (writes a permanent "Paid" `SalaryHistory` row, resets Advance Taken to 0). No undo path.
- Deleting an Approved Leave/Advance/Overtime request reverses side effects (can revert/delete Attendance rows, reduce Advance Taken) — permanent, admin-only, one-click-plus-confirm.
- `WARNING_LETTER_LIMIT = 3` is enforced server-side in `issueLetter_`, not just the UI.
- There's no in-app way to create the first CEO or promote someone to CEO — must hand-edit the `Role` cell in the `Users` sheet directly.
- `sanitizeForSheet_` (formula/CSV injection defense) is applied inside the generic write helpers (`appendRow_`, `upsertRow_`, `updateRowById_`, `safeSetValue_`). Any new direct `range.setValue(...)` bypassing those helpers reopens formula-injection risk from user-supplied text (remarks, reasons, etc.) landing as `=`/`+`/`-`/`@`-prefixed cells.
- Session storage uses `PropertiesService`, not `CacheService` — this was a deliberate fix after a real production login outage (`put()` not reliably visible to an immediate `get()` under CacheService). Don't move session storage back to CacheService without re-verifying that consistency behavior.
- Freelancers are explicitly carved out of most attendance/salary/leave machinery (no proration, no Sunday bonus, no paid leave, no overtime credit, hidden from the Attendance nav). Any new salary/attendance feature needs an explicit Freelancer case or it will likely misbehave (0/NaN, wrong proration) for that employment type.
- The CEO view is a separate code path in several pages (`dashboard.js`, `attendance.js`, `profile.js`), not a superset of the Admin/employee view — a change to the normal dashboard/attendance logic does not automatically apply to the CEO's.
- Fundamental limitation (can't be fixed in code): anyone with edit access to the underlying Google Sheet has full access to all data, regardless of the app's role model.
