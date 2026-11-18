const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidEmail, isValidListing, isValidRequestDates } = require("../lib/validation");

test("validates email addresses and their maximum length", () => {
  assert.equal(isValidEmail("student@college.edu"), true);
  assert.equal(isValidEmail("student.example"), false);
  assert.equal(isValidEmail(`${"a".repeat(250)}@test.edu`), false);
});

test("accepts valid listings and rejects invalid listing fields", () => {
  const listing = {
    title: "Scientific calculator",
    description: "Good condition",
    category: "Study",
    condition: "Good",
    price: 0,
  };
  assert.equal(isValidListing(listing), true);
  assert.equal(isValidListing({ ...listing, category: "Unknown" }), false);
  assert.equal(isValidListing({ ...listing, price: -1 }), false);
  assert.equal(isValidListing({ ...listing, title: " " }), false);
  assert.equal(isValidListing({ ...listing, description: "d".repeat(2001) }), false);
});

test("validates real calendar dates and chronological borrow ranges", () => {
  const today = new Date("2026-11-16T12:00:00Z");
  assert.equal(isValidRequestDates("2026-11-16", "2026-11-18", today), true);
  assert.equal(isValidRequestDates("2026-11-19", "2026-11-18", today), false);
  assert.equal(isValidRequestDates("2026-02-30", "2026-03-01", today), false);
  assert.equal(isValidRequestDates("2026-11-15", "2026-11-18", today), false);
});
