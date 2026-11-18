const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("../config/db");
const { requireAdmin, requireAuth, setAuthCookie, clearAuthCookie } = require("../middleware/auth");
const { uploadImage } = require("../middleware/upload");
const { CATEGORY_NAMES, isValidEmail, isValidListing, isValidRequestDates } = require("../lib/validation");
const { GeminiSearchError, generateSearchIntent } = require("../lib/gemini-search");
const { rankListings } = require("../lib/search-ranking");

const router = express.Router();

function redirectWithMessage(res, path, message, type = "success") {
  const query = new URLSearchParams({ message, type });
  return res.redirect(`${path}?${query.toString()}`);
}

async function queryRows(sql, values = []) {
  const [rows] = await pool.execute(sql, values);
  return rows;
}

async function getCategories() {
  return queryRows("SELECT id, name, icon FROM categories ORDER BY name");
}

async function getListingById(id) {
  const rows = await queryRows(
    `SELECT l.*, l.condition_name AS \`condition\`, c.name AS category_name, c.icon AS category_icon,
            u.full_name AS owner_name, u.university_email AS owner_email
     FROM listings l
     JOIN categories c ON c.id = l.category_id
     JOIN users u ON u.id = l.owner_id
     WHERE l.id = ?`,
    [id],
  );
  return rows[0] || null;
}

async function findListings({ terms = [], category = "", price = "" }) {
  const conditions = ["l.is_available = TRUE"];
  const params = [];

  if (terms.length) {
    const termConditions = terms.map((term) => {
      const placeholder = `%${term}%`;
      params.push(placeholder, placeholder, placeholder);
      return "(l.title LIKE ? OR l.description LIKE ? OR c.name LIKE ?)";
    });
    conditions.push(`(${termConditions.join(" OR ")})`);
  }
  if (category && CATEGORY_NAMES.includes(category)) {
    conditions.push("c.name = ?");
    params.push(category);
  }
  if (price === "free") conditions.push("l.price_per_day = 0");
  if (price === "paid") conditions.push("l.price_per_day > 0");

  return queryRows(
    `SELECT l.id, l.title, l.description, l.condition_name AS \`condition\`,
            l.price_per_day, l.image_path, c.name AS category_name,
            c.icon AS category_icon, u.full_name AS owner_name
     FROM listings l
     JOIN categories c ON c.id = l.category_id
     JOIN users u ON u.id = l.owner_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY l.created_at DESC
     LIMIT 100`,
    params,
  );
}

async function renderItemsPage(res, { q = "", category = "", price = "", aiNotice = "" } = {}) {
  const [categories, listings] = await Promise.all([
    getCategories(),
    findListings({ terms: q ? [q] : [], category, price }),
  ]);
  return res.render("items/index", {
    title: "Browse products — CampusMart",
    categories,
    listings,
    filters: { q, category, price },
    aiNotice,
  });
}

async function removeUploadedFile(file) {
  if (!file) return;
  try {
    await fs.unlink(path.join(__dirname, "..", "uploads", path.basename(file.filename)));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Could not remove rejected upload:", error);
  }
}

router.get("/", async (_req, res) => {
  const [categories, listings] = await Promise.all([
    getCategories(),
    queryRows(
      `SELECT l.id, l.title, l.description, l.condition_name AS \`condition\`, l.price_per_day, l.image_path,
              c.name AS category_name, c.icon AS category_icon,
              u.full_name AS owner_name
       FROM listings l
       JOIN categories c ON c.id = l.category_id
       JOIN users u ON u.id = l.owner_id
       WHERE l.is_available = TRUE
       ORDER BY l.created_at DESC
       LIMIT 8`,
    ),
  ]);
  res.render("home", {
    title: "CampusMart — Buy · Sell · Connect",
    categories,
    listings,
  });
});

router.get("/items", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const price = ["free", "paid"].includes(req.query.price) ? req.query.price : "";
  return renderItemsPage(res, { q, category, price });
});

router.post("/items/ai-search", async (req, res) => {
  const q = typeof req.body.q === "string" ? req.body.q.trim().slice(0, 500) : "";
  const selectedCategory = typeof req.body.category === "string" ? req.body.category : "";
  const selectedPrice = ["free", "paid"].includes(req.body.price) ? req.body.price : "";
  if (!q) {
    return renderItemsPage(res, {
      category: selectedCategory,
      price: selectedPrice,
      aiNotice: "Describe what you need, or use the regular search.",
    });
  }

  try {
    const intent = await generateSearchIntent(q);
    const category = CATEGORY_NAMES.includes(selectedCategory) ? selectedCategory : "";
    const price = ["free", "paid"].includes(selectedPrice) ? selectedPrice : "";
    const listings = rankListings(
      await findListings({ category, price }),
      { ...intent, terms: intent.terms.length ? intent.terms : [q] },
    );
    const categories = await getCategories();
    const bestMatches = listings.filter((item) => item.matchPercent > 0);
    const otherListings = listings.filter((item) => item.matchPercent === 0);
    return res.render("items/index", {
      title: "AI search — CampusMart",
      categories,
      listings,
      filters: { q, category, price },
      aiSearch: true,
      bestMatches,
      otherListings,
      aiNotice: `AI search understood: ${intent.terms.join(", ") || q}${intent.category ? ` · ${intent.category}` : ""}${intent.price !== "any" ? ` · ${intent.price}` : ""}`,
    });
  } catch (error) {
    if (!(error instanceof GeminiSearchError)) throw error;
    console.error("AI item search unavailable:", error.code);
    return renderItemsPage(res, {
      q,
      category: selectedCategory,
      price: selectedPrice,
      aiNotice: `${error.message} Showing regular keyword matches instead.`,
    });
  }
});

router.get("/items/:id", async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).render("404", { title: "Item not found" });
  const listing = await getListingById(req.params.id);
  if (!listing) return res.status(404).render("404", { title: "Item not found" });
  res.render("items/show", { title: `${listing.title} — CampusMart`, listing });
});

router.get("/register", (_req, res) => {
  if (res.locals.user) return res.redirect("/dashboard");
  res.render("auth/register", { title: "Create an account — CampusMart" });
});

router.post("/register", async (req, res) => {
  const fullName = typeof req.body.full_name === "string" ? req.body.full_name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (fullName.length < 2 || fullName.length > 100 || !isValidEmail(email) || password.length < 8 || password.length > 72) {
    return res.status(400).render("auth/register", {
      title: "Create an account — CampusMart",
      error: "Enter your name, a valid email address, and a password between 8 and 72 characters.",
      values: { full_name: fullName, email },
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const [result] = await pool.execute(
      "INSERT INTO users (full_name, university_email, password_hash) VALUES (?, ?, ?)",
      [fullName, email, passwordHash],
    );
    setAuthCookie(res, result.insertId);
    return redirectWithMessage(res, "/dashboard", "Your account is ready. Welcome to CampusMart!");
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).render("auth/register", {
        title: "Create an account — CampusMart",
        error: "An account with that email already exists. Try logging in instead.",
        values: { full_name: fullName, email },
      });
    }
    throw error;
  }
});

router.get("/login", (_req, res) => {
  if (res.locals.user) return res.redirect("/dashboard");
  res.render("auth/login", { title: "Log in — CampusMart" });
});

router.post("/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!isValidEmail(email) || !password || password.length > 72) {
    return res.status(400).render("auth/login", {
      title: "Log in — CampusMart",
      error: "Enter a valid email address and password.",
      values: { email },
    });
  }

  const result = await queryRows(
    "SELECT id, password_hash FROM users WHERE university_email = ?",
    [email],
  );
  const user = result[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).render("auth/login", {
      title: "Log in — CampusMart",
      error: "That email and password combination wasn't recognized.",
      values: { email },
    });
  }
  setAuthCookie(res, user.id);
  return redirectWithMessage(res, "/dashboard", "You're logged in.");
});

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.redirect("/");
});

router.get("/dashboard", requireAuth, async (req, res) => {
  const [listings, received, sent, stats] = await Promise.all([
    queryRows(
      `SELECT l.id, l.title, l.price_per_day, l.is_available, l.created_at,
              c.name AS category_name,
              (SELECT COUNT(*) FROM borrow_requests br
               WHERE br.listing_id = l.id AND br.status = 'pending') AS pending_count
       FROM listings l JOIN categories c ON c.id = l.category_id
       WHERE l.owner_id = ? ORDER BY l.created_at DESC`,
      [req.user.id],
    ),
    queryRows(
      `SELECT br.*, l.title AS listing_title, l.image_path, u.full_name AS borrower_name
       FROM borrow_requests br
       JOIN listings l ON l.id = br.listing_id
       JOIN users u ON u.id = br.borrower_id
       WHERE l.owner_id = ?
       ORDER BY br.created_at DESC LIMIT 50`,
      [req.user.id],
    ),
    queryRows(
      `SELECT br.*, l.title AS listing_title, l.image_path, u.full_name AS owner_name
       FROM borrow_requests br
       JOIN listings l ON l.id = br.listing_id
       JOIN users u ON u.id = l.owner_id
       WHERE br.borrower_id = ?
       ORDER BY br.created_at DESC LIMIT 50`,
      [req.user.id],
    ),
    queryRows(
      `SELECT COUNT(*) AS listing_count,
              COALESCE(SUM(CASE WHEN is_available THEN 1 ELSE 0 END), 0) AS available_count
       FROM listings WHERE owner_id = ?`,
      [req.user.id],
    ),
  ]);

  res.render("dashboard", {
    title: "Your dashboard — CampusMart",
    listings,
    receivedRequests: received,
    sentRequests: sent,
    stats: stats[0],
  });
});

router.get("/admin", requireAdmin, async (_req, res) => {
  const [stats, listings, users, requests] = await Promise.all([
    queryRows(
      `SELECT (SELECT COUNT(*) FROM users) AS user_count,
              (SELECT COUNT(*) FROM listings) AS listing_count,
              (SELECT COUNT(*) FROM listings WHERE is_available) AS available_count,
              (SELECT COUNT(*) FROM borrow_requests WHERE status = 'pending') AS pending_count`,
    ),
    queryRows(
      `SELECT l.id, l.title, l.is_available, l.created_at, c.name AS category_name,
              u.full_name AS owner_name
       FROM listings l
       JOIN categories c ON c.id = l.category_id
       JOIN users u ON u.id = l.owner_id
       ORDER BY l.created_at DESC LIMIT 50`,
    ),
    queryRows(
      `SELECT id, full_name, university_email, role, created_at
       FROM users ORDER BY created_at DESC LIMIT 50`,
    ),
    queryRows(
      `SELECT br.id, br.listing_id, br.status, br.request_from, br.request_to, l.title AS listing_title,
              borrower.full_name AS borrower_name, owner.full_name AS owner_name
       FROM borrow_requests br
       JOIN listings l ON l.id = br.listing_id
       JOIN users borrower ON borrower.id = br.borrower_id
       JOIN users owner ON owner.id = l.owner_id
       ORDER BY br.created_at DESC LIMIT 25`,
    ),
  ]);
  res.render("admin", {
    title: "Campus overview — CampusMart",
    stats: stats[0],
    listings,
    users,
    requests,
  });
});

router.post("/admin/listings/:id/availability", requireAdmin, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).send("Listing not found.");
  const isAvailable = req.body.is_available === "true";
  const [result] = await pool.execute(
    "UPDATE listings SET is_available = ? WHERE id = ?",
    [isAvailable, req.params.id],
  );
  if (!result.affectedRows) return res.status(404).send("Listing not found.");
  return redirectWithMessage(res, "/admin", isAvailable ? "Listing is available again." : "Listing paused.");
});

router.post("/listings", requireAuth, uploadImage.single("image"), async (req, res) => {
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  const categoryName = typeof req.body.category === "string" ? req.body.category : "";
  const condition = typeof req.body.condition === "string" ? req.body.condition : "";
  const price = typeof req.body.price_per_day === "string" ? Number(req.body.price_per_day) : Number.NaN;
  const categories = await getCategories();
  const category = categories.find((candidate) => candidate.name === categoryName);

  if (!req.file || !isValidListing({ title, description, category: categoryName, condition, price })) {
    await removeUploadedFile(req.file);
    const message = req.file
      ? "Check the item name, category, condition, description, and daily price."
      : "Choose a JPG, PNG, or WebP photo for your item.";
    return redirectWithMessage(res, "/dashboard", message, "error");
  }

  const imagePath = `/uploads/${req.file.filename}`;
  try {
    await pool.execute(
      `INSERT INTO listings (owner_id, category_id, title, description, condition_name, price_per_day, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, category.id, title, description, condition, price, imagePath],
    );
  } catch (error) {
    await removeUploadedFile(req.file);
    throw error;
  }
  return redirectWithMessage(res, "/dashboard", "Your listing has been added.");
});

router.post("/listings/:id/availability", requireAuth, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).send("Listing not found.");
  const isAvailable = req.body.is_available === "true";
  const [result] = await pool.execute(
    "UPDATE listings SET is_available = ? WHERE id = ? AND owner_id = ?",
    [isAvailable, req.params.id, req.user.id],
  );
  if (!result.affectedRows) return res.status(404).send("Listing not found.");
  return redirectWithMessage(res, "/dashboard", isAvailable ? "Listing is available again." : "Listing paused.");
});

router.post("/items/:id/requests", requireAuth, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).render("404", { title: "Item not found" });
  const requestFrom = typeof req.body.request_from === "string" ? req.body.request_from : "";
  const requestTo = typeof req.body.request_to === "string" ? req.body.request_to : "";
  const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
  if (!isValidRequestDates(requestFrom, requestTo) || message.length > 500) {
    return redirectWithMessage(res, `/items/${req.params.id}`, "Choose valid dates and keep your message under 500 characters.", "error");
  }

  const client = await pool.getConnection();
  try {
    await client.beginTransaction();
    const [listingRows] = await client.execute(
      "SELECT id, owner_id, is_available FROM listings WHERE id = ? FOR UPDATE",
      [req.params.id],
    );
    const listing = listingRows[0];
    if (!listing || !listing.is_available) {
      await client.rollback();
      return redirectWithMessage(res, "/items", "That item is no longer available.", "error");
    }
    if (String(listing.owner_id) === String(req.user.id)) {
      await client.rollback();
      return redirectWithMessage(res, `/items/${req.params.id}`, "You can't request your own listing.", "error");
    }
    const [conflicts] = await client.execute(
      `SELECT 1 FROM borrow_requests
       WHERE listing_id = ? AND status = 'approved'
         AND request_from <= ? AND request_to >= ?
       LIMIT 1`,
      [req.params.id, requestFrom, requestTo],
    );
    if (conflicts.length) {
      await client.rollback();
      return redirectWithMessage(res, `/items/${req.params.id}`, "Those dates overlap an approved borrow. Try another date range.", "error");
    }
    await client.execute(
      `INSERT INTO borrow_requests (listing_id, borrower_id, request_from, request_to, message)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, req.user.id, requestFrom, requestTo, message],
    );
    await client.commit();
    return redirectWithMessage(res, "/dashboard", "Borrow request sent to the owner.");
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
});

router.post("/requests/:id/status", requireAuth, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).send("Request not found.");
  const action = req.body.action;
  if (!["approve", "decline", "return"].includes(action)) {
    return redirectWithMessage(res, "/dashboard", "Choose a valid request action.", "error");
  }

  const client = await pool.getConnection();
  try {
    await client.beginTransaction();
    const [requestRows] = await client.execute(
      `SELECT br.id, br.status, br.listing_id, br.request_from, br.request_to, l.owner_id
       FROM borrow_requests br JOIN listings l ON l.id = br.listing_id
       WHERE br.id = ? FOR UPDATE`,
      [req.params.id],
    );
    const request = requestRows[0];
    if (!request || String(request.owner_id) !== String(req.user.id)) {
      await client.rollback();
      return res.status(404).send("Request not found.");
    }
    if (request.status !== "pending" && !(action === "return" && request.status === "approved")) {
      await client.rollback();
      return redirectWithMessage(res, "/dashboard", "This request has already been updated.", "error");
    }

    if (action === "approve") {
      const [conflicts] = await client.execute(
        `SELECT 1 FROM borrow_requests
         WHERE listing_id = ? AND id <> ? AND status = 'approved'
           AND request_from <= ? AND request_to >= ?
         LIMIT 1`,
        [request.listing_id, request.id, request.request_from, request.request_to],
      );
      if (conflicts.length) {
        await client.rollback();
        return redirectWithMessage(res, "/dashboard", "Another request already has approved dates that overlap.", "error");
      }
    }

    const nextStatus = { approve: "approved", decline: "declined", return: "returned" }[action];
    await client.execute("UPDATE borrow_requests SET status = ? WHERE id = ?", [nextStatus, request.id]);
    await client.commit();
    return redirectWithMessage(res, "/dashboard", `Request ${nextStatus}.`);
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
});

router.post("/requests/:id/cancel", requireAuth, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).send("Request not found.");
  const [result] = await pool.execute(
    `UPDATE borrow_requests
     SET status = 'cancelled'
     WHERE id = ? AND borrower_id = ? AND status = 'pending'`,
    [req.params.id, req.user.id],
  );
  if (!result.affectedRows) return redirectWithMessage(res, "/dashboard", "That request can't be cancelled.", "error");
  return redirectWithMessage(res, "/dashboard", "Borrow request cancelled.");
});

module.exports = router;
