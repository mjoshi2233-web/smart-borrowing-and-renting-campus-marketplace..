const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE || "borrowloop",
  user: process.env.MYSQL_USER || "borrowloop_app",
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_POOL_MAX || 10),
  queueLimit: 0,
  timezone: "Z",
  supportBigNumbers: true,
  bigNumberStrings: true,
});

pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

pool.on("error", (error) => {
  console.error("Unexpected MySQL pool error:", error);
});

module.exports = pool;
