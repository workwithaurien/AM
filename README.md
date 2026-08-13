# Aurien Media — Employee Management System

Internal tool for Aurien Media. Vanilla HTML/CSS/JS on GitHub Pages, Google Sheets as the database, Google Apps Script as the API.

All dummy/test data now lives **in the Google Sheet**, seeded by a setup script — nothing is hardcoded in the webpage. That means the app won't do anything until you deploy the backend below; there's no more local-only mock mode.

## What's wired up vs. still a stub

| Feature | Status |
|---|---|
| Login (UID/Password) | Full — checked against the `Users` sheet; blocked if that user's Status is `Disabled`. "Remember me" keeps the session in `localStorage` instead of `sessionStorage` so it survives closing the browser — though the server-side session (Apps Script `CacheService`) still hard-caps at 6 hours either way, after which the app cleanly bounces back to Sign In with a clear message instead of getting stuck |
| Work Reports (view + submit) | Full — Employee Name is locked to the logged-in user, both in the UI and re-enforced server-side |
| Salary (real-time calculator + what-if calculator) | Full — employee's own Salary page computes live from Attendance, plus a "Salary Calculator" to estimate pay for any number of present days; admin gets an "Update Salary" calculator in each employee's drawer. Salary is earned out of the full calendar month (30/31, 28/29 in Feb) — every Sunday that's passed with no Attendance row counts as present automatically, since it's a paid weekly off. Admin also gets a "Close Out Month" button (Employees drawer → Salary tab) that records the current live-computed present days/earnings as a permanent "Paid" row in `SalaryHistory` and resets Advance Taken to ₹0 — refuses to double-close the same employee+month |
| Paid leave (1.5 days/month, Full Time only) | Full — resets every month; approving a Leave request marks those days "Leave" in Attendance automatically, which is what makes them count. Supports Half Day leave (counts as 0.5) via the Apply Leave "Duration" dropdown — Half Day always applies to a single date. Unused days convert to a one-time salary bonus the following month instead of carrying over as extra leave. Shown as a "Paid Leave" card on the Attendance page. Employment Type set from the Employees drawer |
| Drive links | Full — cached client-side for the rest of the session (`assets/js/core/state.js`) since they're only ever edited directly in the `DriveLinks` sheet, not through the app |
| Daily task assignment | Full — admin assigns one Drive link per employee per day from the Employees drawer ("Assign Daily Task"); shows up as that employee's Dashboard "Today's Task Drive Link" card |
| Attendance + Holidays (combined calendar) | Full — employees see the current month, admins see all 12; shows Present/Absent/Leave/Holiday per day plus a count above the calendar. Admin can Add, Edit, and Delete holidays (each holiday row has Edit/Delete buttons). Holidays are also cached client-side for the session, invalidated automatically on any Add/Edit/Delete |
| Login/Logout attendance marking | Full — Dashboard button writes real Login/Logout times to the `Attendance` sheet; Today's Working Hours is computed from them |
| Notifications (bell icon) | Full — red dot on the bell when there's an unread announcement; each one has a "mark as read" (✕) that clears it. Read state is per-user, stored in the browser (`localStorage`), not the sheet |
| Profile photo | Full — shows in the topbar avatar and Profile page if `Users.Photo URL` is set for that person, else falls back to initials. Photos aren't uploaded through the app — host the image yourself (e.g. push it into the repo on GitHub) and paste the resulting URL into that column |
| Dashboard (announcements + salary + report status + attendance) | Full — admin also sees live Team Attendance Today and Pending Approvals counts |
| Employees directory (admin) | Full — includes Add Employee, Disable/Enable Employee, Reset Password (sets a new password directly, no need to know the old one — for an employee who's locked out), and editing Designation/Department/Employment Type/Documents Folder URL. The drawer's Documents tab shows an "Open Documents Folder" button when that URL is set (e.g. a Google Drive folder link) |
| Profile page | Full — shows Designation, Department, Employment Type, and Monthly Salary (moved here from the Salary page) alongside attendance/leave history |
| Apply Leave / Approve Leave | Full — Dashboard "Apply Leave" submits a request; admin approves/rejects per-employee from the Employees drawer, or all-employees-at-once from the Employees page's "Approve Leaves" button. Every leave request also has a "Delete" button (admin-only) to permanently undo an accidental approval/rejection — if it had been Approved, this also reverts the Attendance days it marked "Leave" back to Present (or removes them if nothing else happened that day), so it never leaves a stale day still counted against the employee's paid-leave allowance |
| Request/Approve Advance Salary | Full — Dashboard "Request Advance Salary" submits a request; admin approves/rejects per-employee from the Employees drawer, or all-employees-at-once from the Employees page's "Approve Advances" button (mirrors "Approve Leaves"). Every request also has a "Delete" button (admin-only) — if it had been Approved, deleting it reverses the amount from the employee's Advance Taken |
| Warning/Performance Note/Appreciation letters | Full — issued from the Employees drawer; counts show on the employee's Profile page |
| Change Password | Full — verifies the current password and updates the sheet |
| Disable/Enable Employee | Full — a Disabled employee can't log in until re-enabled |
| Settings page (Company Name) | Full |

---

## Deploying the backend

### 1. Create a Google Sheet

Any blank spreadsheet. You don't need to create tabs by hand — the setup script does that for you.

### 2. Add the Apps Script project

1. In the Sheet: **Extensions → Apps Script**.
2. Delete the default `Code.gs` content.
3. Create two files matching this project's `apps-script/` folder exactly:
   - **`Code.gs`** — every backend function (auth, work reports, salary, employees, drive, holidays, dashboard, leave, advance salary, letters, settings).
   - **`Setup.gs`** — a one-time script that creates every sheet tab with the right headers and seeds it with sample data.
4. Paste each file's content in, then save the project.

### 3. Run the setup script

1. In the Apps Script editor's toolbar, pick **`setupEMS`** from the function dropdown (next to Run).
2. Click **Run**. The first time, it'll ask you to authorize access to the Sheet — allow it.
3. Check the Sheet — you should now see tabs `Users`, `WorkReports`, `Attendance`, `SalaryBase`, `SalaryHistory`, `Holidays`, `Announcements`, `DriveLinks`, `LeaveRequests`, `AdvanceRequests`, `Letters`, `Settings`, `LeaveCashout`, `DailyTasks`, each with headers and (where useful) a couple of sample rows.
4. Safe to re-run any time — it only fills a tab that's still empty, so it won't duplicate rows or touch data you've since added by hand.

**Already had this deployed before?** Don't re-run `setupEMS` — instead pick **`upgradeEMS`** from the function dropdown and run that once. It adds everything newer features need (`Designation`/`Department`/`Employment Type`/`Status` columns on `Users`, `Login Time`/`Logout Time` on `Attendance`, the new sheets above, and the WorkReports column rename) to your existing Sheet without touching any data you already have. Also safe to re-run any time.

**Seeded test accounts** (in the `Users` tab):
- Employee — UID `EMP001` / Password `emp123`
- Admin — UID `ADM001` / Password `admin123`

Change or delete these once you're adding real employees.

### 4. Deploy as a Web App

1. **Deploy → New deployment → Web app**.
2. Execute as: **Me**. Who has access: **Anyone within [your domain]** (or "Anyone" if there's no Workspace domain to restrict to).
3. Deploy, then copy the Web App URL.

### 5. Point the frontend at it

In `assets/js/core/api.js`:

```js
const APPS_SCRIPT_URL = "PASTE_YOUR_WEB_APP_URL_HERE";
```

Replace the placeholder with your deployed URL. That's the only file that needs to change — every page already calls through `Api.call(...)`.

### 6. Deploy the frontend to GitHub Pages

This repo (`workwithaurien/AM`) is set up to deploy as-is — no build step, it's plain HTML/CSS/JS.

1. Push this whole folder to the repo, on the `main` branch.
2. Repo **Settings → Pages → Source: Deploy from a branch**, pick `main` and the `/ (root)` folder → **Save**.
3. It goes live at `https://workwithaurien.github.io/AM/` (GitHub shows the exact URL on that same Settings → Pages screen once it's built — takes a minute or two after the first push).
4. Open that URL — it should land on the Sign In page (`index.html`) styled correctly with the Aurien Media logo as the favicon and browser tab icon.

**If you use a custom domain instead** of the default `github.io` URL, update the `og:url`/`og:image`/`twitter:image` values in `index.html`'s `<head>` to match — they're hardcoded to `https://workwithaurien.github.io/AM/...` for link-preview cards (Slack/WhatsApp/Discord, etc.) and only work with an absolute URL.

### Favicon, link previews, and "install as app"

- **Favicon** — `assets/images/icons/favicon-32.png` / `favicon-64.png`, generated from `assets/images/Logo.png`. Replace the source logo and re-export those sizes (plus `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og-cover.png` in the same folder) if the logo ever changes.
- **Link previews** — `index.html` has Open Graph/Twitter Card meta tags so pasting the site's link into Slack/WhatsApp/etc. shows a card with the logo, title, and description.
- **Install as app** — `manifest.json` + `sw.js` (a minimal same-origin app-shell cache — it never touches API calls to the Apps Script backend, so it can't serve stale data) make the site installable via the browser's "Install app" / "Add to Home Screen" prompt on desktop, Android, and iOS. Works over GitHub Pages' HTTPS automatically; nothing extra to configure.

---

## Sheet reference

**Users** — UID | Password | Name | Role | Email | Designation *(job title, e.g. "Video Editor" — blank shows as "Employee")* | Department *(e.g. "Creative")* | Employment Type *(Full Time / Part Time / Intern — blank defaults to Full Time. Only Full Time employees get the 1.5 paid-leave-days/month salary rule; see Salary below.)* | Status *(Active / Disabled — a Disabled user can't log in)* | Photo URL *(link to a photo hosted elsewhere, e.g. pushed into this repo on GitHub — shown in the topbar avatar and Profile page; blank falls back to initials)* | Documents Folder URL *(link to wherever that employee's documents are kept, e.g. a Google Drive folder — shown as an "Open Documents Folder" button on the Employees drawer's Documents tab; editable from that same drawer's "Edit Details"; blank shows "No documents folder linked yet")*
**WorkReports** — Date | Client Name | Employee Name | Work Type *(Image Creatives / Video Creatives / Long Form Videos / Short Form Videos / Finding Influencers)* | Given | Completed | Rejected | Remark | Submitted At *(HH:mm, auto-set when the report is submitted — shown as "Report" time on the admin Employees page)*
**Attendance** — UID | Date | Status *(Present / Absent / Leave)* | Login Time | Logout Time | Leave Value *(1 for a full-day Leave row, 0.5 for a half-day one — blank on a non-Leave row, and treated as 1 if blank on a Leave row for backward compatibility)* | Break Start | Break End *(HH:mm — one break window per day, set by the Dashboard's Take Break/End Break button; also drives the "ON BREAK" tag on the admin Employees page)*
**SalaryBase** — UID | Monthly Salary | Advance Taken
**SalaryHistory** — UID | Month | Present Days | Earned | Advance | Net Paid | Status
**Holidays** — ID | Date | Name | Type
**Announcements** — Title | Date
**DriveLinks** — Title | Icon | URL *(Icon is any short text, e.g. "DT" — no emoji required; blank defaults to the first two letters of the Title)*
**LeaveRequests** — ID | UID | From | To | Type | Duration *(Full Day / Half Day — Half Day requires From = To)* | Reason | Status *(Pending / Approved / Rejected)* | Applied On
**AdvanceRequests** — ID | UID | Amount | Reason | Status *(Pending / Approved / Rejected)* | Applied On
**Letters** — ID | UID | Type *(Warning / Note / Appreciation)* | Message | Date | Issued By
**Settings** — Key | Value *(rows: "Company Name")*
**LeaveCashout** — UID | Owed Days | Last Closed Month *(internal bookkeeping for the paid-leave cash-out rule — never edit by hand)*
**DailyTasks** — Date | UID | Title | URL | Assigned By *(one row per employee per day, written by the "Assign Daily Task" action in the Employees drawer)*

Column headers must match exactly — the code reads them to build each row's fields.

**If you already ran Setup before this update:** run **`upgradeEMS`** once (see step 3 above) instead of adding any of this by hand — it adds the missing `Users`/`Attendance` columns and creates the four new sheets automatically, without touching data you already have.

---

## Updating an existing deployment

Whenever you change `Code.gs` or `Setup.gs` here, the live Web App doesn't update automatically:

1. Paste the new file content into the Apps Script editor, replacing the old file. Save.
2. **Deploy → Manage deployments → pencil/edit icon on your deployment → Version: "New version" → Deploy.**

The Web App URL stays the same, so nothing in `api.js` needs to change.

---

## Project structure

See `EMS-project-plan.md` (from the planning stage) for the original folder breakdown and roadmap this was built against — note the Apps Script side has since been consolidated from many small files into just `Code.gs` + `Setup.gs`, per a later request.
