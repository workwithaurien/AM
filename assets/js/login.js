/**
 * login.js — controller for index.html.
 * Checks UID + Password against the Users sheet (via Api -> mock for now).
 */
(function () {
  if (Auth.isLoggedIn()) {
    window.location.href = "app.html";
    return;
  }

  const form = document.getElementById("loginForm");
  const errorBox = document.getElementById("loginError");
  const submitBtn = document.getElementById("loginSubmit");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("passwordToggle");

  // Set by Api.call when a stale session gets force-logged-out (see api.js).
  const loginNotice = sessionStorage.getItem("ems_login_notice");
  if (loginNotice) {
    sessionStorage.removeItem("ems_login_notice");
    errorBox.textContent = loginNotice;
    errorBox.classList.add("show");
  }

  passwordToggle.addEventListener("click", () => {
    const showing = passwordInput.type === "text";
    passwordInput.type = showing ? "password" : "text";
    passwordToggle.setAttribute("aria-pressed", String(!showing));
    passwordToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    passwordToggle.querySelector(".ic-eye").style.display = showing ? "" : "none";
    passwordToggle.querySelector(".ic-eye-off").style.display = showing ? "none" : "";
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    errorBox.classList.remove("show");
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    const fd = new FormData(form);
    const res = await Api.call("login", {
      uid: fd.get("uid").trim(),
      password: fd.get("password")
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Sign In";

    if (res.ok) {
      Auth.setSession(res.user, res.token, document.getElementById("rememberMe").checked);
      window.location.href = "app.html";
    } else {
      errorBox.textContent = res.error || "Login failed.";
      errorBox.classList.add("show");
    }
  });
})();
