const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CATEGORY_NAMES = ["Study", "Electronics", "Books", "Sports", "Lab", "Other"];
const CONDITIONS = ["Like new", "Good", "Fair"];

function isValidEmail(email) {
  return typeof email === "string" && email.length <= 255 && EMAIL_PATTERN.test(email);
}

function isValidListing({ title, description, category, condition, price }) {
  return typeof title === "string" && title.trim().length > 0 && title.trim().length <= 120 &&
    typeof description === "string" && description.length <= 2000 &&
    CATEGORY_NAMES.includes(category) && CONDITIONS.includes(condition) &&
    Number.isFinite(price) && price >= 0 && price <= 100000;
}

function isValidRequestDates(requestFrom, requestTo, today = new Date()) {
  const isCalendarDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!isCalendarDate(requestFrom) || !isCalendarDate(requestTo)) return false;
  const todayDate = new Date(today);
  todayDate.setUTCHours(0, 0, 0, 0);
  return Date.parse(`${requestFrom}T00:00:00Z`) >= todayDate.getTime() && requestTo >= requestFrom;
}

module.exports = { CATEGORY_NAMES, CONDITIONS, isValidEmail, isValidListing, isValidRequestDates };
