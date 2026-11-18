const test = require("node:test");
const assert = require("node:assert/strict");
const { rankListings } = require("../lib/search-ranking");

test("ranks title and description matches above unrelated listings", () => {
  const results = rankListings([
    { id: 1, title: "Badminton racket", description: "For campus games", category_name: "Sports", price_per_day: 20 },
    { id: 2, title: "Noise-cancelling headphones", description: "Listen to music while studying", category_name: "Electronics", price_per_day: 0 },
  ], { terms: ["headphones", "earphones"], category: "Electronics", price: "free" });

  assert.equal(results[0].id, 2);
  assert.ok(results[0].matchPercent > 0);
  assert.equal(results[1].matchPercent, 0);
});

test("keeps all listings and treats AI category and price as ranking hints", () => {
  const results = rankListings([
    { id: 1, title: "Laptop stand", description: "Foldable stand", category_name: "Study", price_per_day: 0 },
    { id: 2, title: "Camera", description: "For campus events", category_name: "Electronics", price_per_day: 100 },
  ], { terms: ["laptop stand", "laptop riser"], category: "Study", price: "free" });

  assert.equal(results.length, 2);
  assert.equal(results[0].id, 1);
  assert.ok(results[0].matchPercent > results[1].matchPercent);
  assert.ok(results.every((listing) => typeof listing.matchPercent === "number"));
});
