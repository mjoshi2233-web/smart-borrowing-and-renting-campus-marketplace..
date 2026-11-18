const test = require("node:test");
const assert = require("node:assert/strict");
const { requireAdmin } = require("../middleware/auth");

test("admin middleware allows admins and rejects unauthenticated or student users", () => {
  let nextCalled = false;
  requireAdmin(
    { user: { role: "admin" } },
    { status() { throw new Error("Admin should continue"); } },
    () => { nextCalled = true; },
  );
  assert.equal(nextCalled, true);

  let loginRedirect;
  requireAdmin(
    { user: null },
    { redirect(path) { loginRedirect = path; } },
    () => assert.fail("Unauthenticated request must not continue"),
  );
  assert.match(loginRedirect, /^\/login\?/);

  let forbiddenStatus;
  let renderedPage;
  requireAdmin(
    { user: { role: "student" } },
    {
      status(code) {
        forbiddenStatus = code;
        return this;
      },
      render(view, data) {
        renderedPage = { view, data };
      },
    },
    () => assert.fail("Student request must not continue"),
  );
  assert.equal(forbiddenStatus, 403);
  assert.equal(renderedPage.view, "403");
});
