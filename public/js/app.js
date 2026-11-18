document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-toggle-password]");
  if (toggle) {
    const input = toggle.parentElement.querySelector("input");
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    toggle.innerHTML = `<i data-lucide="${visible ? "eye-off" : "eye"}"></i>`;
    if (window.lucide) window.lucide.createIcons();
  }

  const loginRequired = event.target.closest("[data-login-required]");
  if (loginRequired) {
    event.preventDefault();
    window.location.href = `/login?message=${encodeURIComponent("Log in to request this item.")}&type=error`;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const start = document.querySelector("#requestFrom");
  const end = document.querySelector("#requestTo");
  if (start && end) {
    start.addEventListener("change", () => {
      end.min = start.value;
      if (end.value && end.value < start.value) end.value = start.value;
    });
  }
});
