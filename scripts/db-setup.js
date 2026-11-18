require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("../config/db");

async function runSqlFile(fileName) {
  const filePath = path.join(__dirname, "..", "db", fileName);
  const sql = await fs.readFile(filePath, "utf8");
  const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    await pool.execute(statement);
  }
  console.log(`Applied ${fileName}`);
}

async function main() {
  try {
    await runSqlFile("schema.sql");
    await runSqlFile("seed.sql");
    console.log("MySQL schema and sample records are ready.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Database setup failed:", error.message || error.code || error);
  if (["ECONNREFUSED", "ENOTFOUND", "ER_ACCESS_DENIED_ERROR"].includes(error.code)) {
    console.error("Check that MySQL is running and your .env connection settings are correct.");
  }
  process.exitCode = 1;
});
