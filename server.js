require("dotenv").config();

const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const pool = require("./config/db");
const { attachUser, requireJwtSecret } = require("./middleware/auth");
const routes = require("./routes");

const app = express();
const port = Number(process.env.PORT || 3000);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(cookieParser());
app.use("/public", express.static(path.join(__dirname, "public"), { maxAge: "1d" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  dotfiles: "deny",
  maxAge: "7d",
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
  },
}));
app.use(attachUser);
app.use((req, res, next) => {
  res.locals.notice = {
    message: typeof req.query.message === "string" ? req.query.message : "",
    type: req.query.type === "success" ? "success" : "danger",
  };
  res.locals.currentPath = req.path;
  res.locals.formatPrice = (price) => Number(price) === 0
    ? "Free"
    : `₹${Number(price).toLocaleString("en-IN")} / day`;
  next();
});

app.get("/healthz", async (_req, res, next) => {
  try {
    await pool.execute("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.use(routes);

app.use((req, res) => {
  res.status(404).render("404", { title: "Page not found" });
});

app.use((error, _req, res, _next) => {
  console.error("Request failed:", error);
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).redirect("/dashboard?message=Image%20must%20be%205%20MB%20or%20smaller&type=error");
  }
  if (error.name === "MulterError" || error.message === "Upload a JPG, PNG, or WebP image.") {
    return res.status(400).redirect("/dashboard?message=Upload%20a%20JPG%2C%20PNG%2C%20or%20WebP%20image&type=error");
  }
  return res.status(500).render("500", { title: "Something went wrong" });
});

async function start() {
  requireJwtSecret();
  await pool.execute("SELECT 1");
  const server = app.listen(port, () => {
    console.log(`CampusMart is running at http://localhost:${port}`);
  });
  const shutdown = () => {
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Could not start CampusMart:", error.message || error.code || error);
    console.error("Check your .env values and confirm MySQL is running.");
    process.exitCode = 1;
  });
}

module.exports = app;
