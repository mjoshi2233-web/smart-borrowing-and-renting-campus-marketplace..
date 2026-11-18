const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const ejs = require("ejs");

const viewsDirectory = path.join(__dirname, "..", "views");

function findTemplates(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? findTemplates(target) : target.endsWith(".ejs") ? [target] : [];
  });
}

test("all EJS templates compile", () => {
  const templates = findTemplates(viewsDirectory);
  assert.ok(templates.length >= 10);
  for (const templatePath of templates) {
    assert.doesNotThrow(
      () => ejs.compile(fs.readFileSync(templatePath, "utf8"), { filename: templatePath }),
      `Template failed to compile: ${path.relative(viewsDirectory, templatePath)}`,
    );
  }
});

test("main pages render with their expected database-shaped data", async () => {
  const user = { id: 2, full_name: "Riya Mehta", university_email: "riya@campus.edu", role: "student" };
  const item = {
    id: 1,
    title: "Scientific calculator",
    description: "Good condition",
    condition: "Good",
    price_per_day: "10.00",
    image_path: null,
    is_available: true,
    owner_id: 3,
    owner_name: "Aarav Sharma",
    category_id: 1,
    category_name: "Study",
    category_icon: "book-open",
    owner_email: "aarav@campus.edu",
    pending_count: 0,
  };
  const categories = [{ id: 1, name: "Study", icon: "book-open" }];
  const common = {
    user,
    currentPath: "/items",
    notice: { message: "", type: "success" },
    formatPrice: (price) => Number(price) === 0 ? "Free" : `₹${price} / day`,
  };
  const receivedRequest = {
    id: 8,
    listing_id: item.id,
    listing_title: item.title,
    borrower_name: "Mira Das",
    request_from: new Date("2026-11-18T00:00:00Z"),
    request_to: new Date("2026-11-20T00:00:00Z"),
    message: "I can pick it up after class.",
    status: "pending",
  };
  const sentRequest = {
    ...receivedRequest,
    owner_name: "Aarav Sharma",
  };
  const pages = [
    ["home.ejs", { ...common, title: "Home", categories, listings: [item] }],
    ["items/index.ejs", { ...common, title: "Items", categories, listings: [item], filters: { q: "", category: "", price: "" }, aiNotice: "" }],
    ["items/show.ejs", { ...common, title: "Item", listing: item }],
    ["auth/login.ejs", { ...common, title: "Login" }],
    ["auth/register.ejs", { ...common, title: "Register" }],
    ["dashboard.ejs", { ...common, title: "Dashboard", listings: [item], receivedRequests: [receivedRequest], sentRequests: [sentRequest], stats: { listing_count: 1, available_count: 1 } }],
    ["admin.ejs", { ...common, title: "Admin", stats: { user_count: 3, listing_count: 2, available_count: 2, pending_count: 1 }, listings: [{ ...item, created_at: new Date("2026-11-16T00:00:00Z") }], users: [{ ...user, created_at: new Date("2026-11-16T00:00:00Z") }], requests: [{ ...receivedRequest, owner_name: "Aarav Sharma" }] }],
    ["404.ejs", { ...common, title: "Not found" }],
    ["403.ejs", { ...common, title: "Access restricted" }],
    ["500.ejs", { ...common, title: "Error" }],
  ];

  for (const [template, data] of pages) {
    const html = await ejs.renderFile(path.join(viewsDirectory, template), data);
    assert.match(html, /<!doctype html>/i, `${template} should render an HTML document`);
  }

  const aiSearchHtml = await ejs.renderFile(path.join(viewsDirectory, "items/index.ejs"), {
    ...common,
    title: "AI search",
    categories,
    listings: [],
    filters: { q: "something for music", category: "", price: "" },
    aiNotice: "AI search understood: headphones",
    aiSearch: true,
    bestMatches: [{ ...item, matchPercent: 87 }],
    otherListings: [{ ...item, id: 2, title: "Other item", matchPercent: 0 }],
  });
  assert.match(aiSearchHtml, /Best matches/);
  assert.match(aiSearchHtml, /87% match/);
  assert.match(aiSearchHtml, /More available items/);
  assert.match(aiSearchHtml, /Other item/);
});
