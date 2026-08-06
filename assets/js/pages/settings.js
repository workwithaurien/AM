/**
 * settings.js — admin panel, reached only via the topbar gear icon.
 * Company Name reads from and writes to the "Settings" key/value sheet.
 */
const PageSettings = (() => {
  async function render(mount) {
    const res = await Api.call("getSettings");
    const settings = res.ok ? res : { companyName: "Aurien Media" };

    mount.innerHTML = `
      <div class="settings-block card">
        <div class="card-title">Company Info</div>
        <div class="field"><label>Company Name</label><input class="input" id="companyName" value="${Utils.escapeHtml(settings.companyName)}" /></div>
      </div>
      <div class="settings-block card">
        <div class="card-title">User Roles &amp; Permissions</div>
        <div class="card-sub">Manage who has Admin vs Employee access from the Employees page — open an employee's drawer to change their Employment Type, or Disable/Enable their login.</div>
      </div>
      <div class="settings-block card">
        <div class="card-title">Drive Link Management</div>
        <div class="card-sub">Edit the folder links shown on the Drive page directly in the DriveLinks sheet.</div>
      </div>
      <div class="settings-block card">
        <div class="card-title">Announcement Management</div>
        <div class="card-sub">Post or remove items shown on every employee's Dashboard directly in the Announcements sheet.</div>
      </div>
      <button class="btn" id="saveSettingsBtn">Save Changes</button>
    `;
    document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
      const companyName = document.getElementById("companyName").value.trim();
      const saveRes = await Api.call("saveSettings", { companyName });
      if (saveRes.ok) {
        Toast.show("Settings saved", "success");
      } else {
        Toast.show(saveRes.error || "Could not save settings", "error");
      }
    });
  }
  return { render };
})();
