function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rankListings(listings, intent) {
  const terms = [...new Set((intent.terms || []).map(normalize).filter(Boolean))];
  const category = normalize(intent.category);
  const price = intent.price || "any";

  return listings
    .map((listing) => {
      const title = normalize(listing.title);
      const description = normalize(listing.description);
      const listingCategory = normalize(listing.category_name);
      let strongestTermMatch = 0;
      let matchedTerms = 0;

      for (const term of terms) {
        let weight = 0;
        if (title.includes(term)) weight = 82;
        else if (description.includes(term)) weight = 70;
        else if (listingCategory.includes(term)) weight = 58;
        if (weight) {
          matchedTerms += 1;
          strongestTermMatch = Math.max(strongestTermMatch, weight);
        }
      }

      let matchPercent = Math.min(100, strongestTermMatch + Math.max(0, matchedTerms - 1) * 5);
      if (category && listingCategory === category) matchPercent = Math.min(100, matchPercent + 12);
      if (price === "free" && Number(listing.price_per_day) === 0) matchPercent = Math.min(100, matchPercent + 8);
      if (price === "paid" && Number(listing.price_per_day) > 0) matchPercent = Math.min(100, matchPercent + 8);

      return { ...listing, matchPercent };
    })
    .sort((left, right) => right.matchPercent - left.matchPercent);
}

module.exports = { rankListings };
