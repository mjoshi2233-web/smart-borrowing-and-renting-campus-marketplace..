const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const COOKIE_NAME = "borrowloop_token";
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }
  return secret;
}

function issueToken(userId) {
  return jwt.sign({ sub: String(userId) }, requireJwtSecret(), { expiresIn: "2h" });
}

function setAuthCookie(res, userId) {
  res.cookie(COOKIE_NAME, issueToken(userId), {
    ...COOKIE_OPTIONS,
    maxAge: 2 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
}

async function attachUser(req, res, next) {
  res.locals.user = null;
  const token = req.cookies[COOKIE_NAME];
  if (!token) return next();

  try {
    const payload = jwt.verify(token, requireJwtSecret());
    const [users] = await pool.execute(
      "SELECT id, full_name, university_email, role FROM users WHERE id = ?",
      [payload.sub],
    );
    if (users.length) {
      req.user = users[0];
      res.locals.user = req.user;
    } else {
      clearAuthCookie(res);
    }
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      clearAuthCookie(res);
      return next();
    }
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  return res.redirect("/login?message=Please%20log%20in%20to%20continue&type=error");
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect("/login?message=Please%20log%20in%20to%20continue&type=error");
  if (req.user.role === "admin") return next();
  return res.status(403).render("403", { title: "Access restricted" });
}

module.exports = {
  COOKIE_NAME,
  attachUser,
  clearAuthCookie,
  issueToken,
  requireAdmin,
  requireAuth,
  requireJwtSecret,
  setAuthCookie,
};
