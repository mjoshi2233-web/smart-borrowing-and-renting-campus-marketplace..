# BorrowLoop

BorrowLoop is a campus borrowing and renting marketplace built with Node.js, Express, MySQL, EJS, Bootstrap 5, and Lucide icons. Students can browse listings, register and log in, publish items with photos, request date ranges, and manage requests from a dashboard. Optional Gemini-powered natural-language search helps translate a description of what a student needs into relevant MySQL search terms and filters.

Accounts, categories, listings, and borrow requests are stored in MySQL. Uploaded item photos are stored in the project's `uploads` folder; MySQL stores each photo path. The starter database includes sample listing records so the app has content on first launch.

## Requirements

- Windows 10/11
- Node.js 20 or newer and npm
- MySQL 8.0 or newer (the project has been tested with MySQL 8.4)
- Optional: Google Gemini API key to use AI search; ordinary keyword search works without one

## Windows setup

### 1. Install MySQL

Download and run the [MySQL Community Server for Windows](https://dev.mysql.com/downloads/mysql/). During setup:

1. Keep the default port `3306`.
2. Set a strong password for the MySQL `root` account and keep it private.
3. Keep the MySQL Windows service enabled and set it to start automatically.

After installation, open PowerShell and check the service:

```powershell
Get-Service *mysql*
```

If MySQL is installed as a Windows service but stopped, start it from an Administrator PowerShell:

```powershell
Start-Service MySQL84
```

The service name may differ on your computer; use the `Name` shown by `Get-Service *mysql*`. On the development machine used for this project, use the included helper to start the local MySQL data directory without an Administrator window:

```powershell
npm run db:start
```

### 2. Create the application database and user

Open MySQL Workbench or connect with the MySQL command-line client as `root`, then run:

```sql
CREATE DATABASE borrowloop CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'borrowloop_app'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT ALL PRIVILEGES ON borrowloop.* TO 'borrowloop_app'@'localhost';
FLUSH PRIVILEGES;
```

Use your own strong password in place of the sample text.

### 3. Configure the application

From the project directory:

```powershell
Set-Location 'C:\path\to\dbms-mj'
npm install
Copy-Item .env.example .env
```

Edit `.env` and set `MYSQL_PASSWORD` to the password for `borrowloop_app`. Replace `JWT_SECRET` with a private random value of at least 32 characters. To generate a secret in PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Keep `.env` private; it is excluded from Git.

### 4. Create tables and sample data

```powershell
npm run db:setup
```

This applies `db/schema.sql` and `db/seed.sql`. The seed can safely be run again; it does not duplicate its starter categories, demo user, or demo listings.

### 5. Optional: enable Gemini AI search

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey) and add it to `.env`:

```text
GEMINI_API_KEY=your-private-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Keep this key on the server in `.env`; do not put it in browser JavaScript or commit it. The AI search sends only the search phrase to Gemini, then uses the returned terms and filters to query actual available MySQL listings. It never lets Gemini invent listings. If no key is configured or Gemini is temporarily unavailable, the application explains the issue and shows regular keyword matches instead.

### 6. Start the website

```powershell
npm start
```

For development with automatic restarts:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The database health endpoint is [http://localhost:3000/healthz](http://localhost:3000/healthz).

## Demo account

The database seed creates:

- **Email:** `demo@borrowloop.test`
- **Password:** `borrowloop123`

Use the demo account to explore the dashboard. For a real deployment, replace the sample account and configure HTTPS and a strong secret.

## App features

- MySQL-backed homepage, categories, item search, and free/paid filters.
- Optional Gemini natural-language search with database-backed results and a keyword fallback.
- Student registration and login with bcrypt password hashes and signed JWTs in HTTP-only cookies.
- Personal dashboard with listings, pending requests, and requests made by the current student.
- Role-protected admin dashboard with campus activity, user, listing, and request summaries.
- Create, pause, and relist an item; required JPG, PNG, or WebP item photos (up to 5 MB).
- Borrow requests with date-range checks, owner approval/decline, cancellation, and return status.
- MySQL parameterized queries, foreign keys, check constraints, indexes, and transaction-protected request updates.
- Responsive Bootstrap 5 layouts and Lucide icons.

## Database design

The four core tables are:

- `users`: student/admin accounts with unique email and password hash.
- `categories`: controlled category list used by many listings.
- `listings`: item details with owner and category foreign keys.
- `borrow_requests`: borrower, listing, requested dates, message, and lifecycle status.

Primary keys identify rows; foreign keys preserve relationships. Unique/check constraints protect data integrity. Indexes support common availability, category, owner, and request lookup patterns. Request creation and owner approval use transactions and row locks to keep the date-conflict workflow consistent.

## Project structure

```text
config/             MySQL connection pool
db/                 MySQL schema and seed SQL
lib/                Shared validation and Gemini search integration
middleware/         JWT authentication and image uploads
public/             CSS and browser JavaScript
routes/             Express page and form routes
scripts/            Database setup command
test/               Node test-runner checks
uploads/            User-uploaded item photos
views/              EJS pages and shared partials
server.js           Express application and startup
```

## Useful commands

```powershell
npm test             # Run validation, authorization, and EJS template tests
npm run db:start     # Start local MySQL if it is not already running
npm run db:setup     # Create/update MySQL schema and seed records
npm run dev          # Start with nodemon
npm start            # Start the production-style server
```

## Notes

- MySQL is required; application records are not stored in browser local storage.
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD` configure the connection. `MYSQL_POOL_MAX` controls the connection pool size.
- To make a registered account an administrator, connect to MySQL and run `UPDATE users SET role = 'admin' WHERE university_email = 'your-address@college.edu';`. The application reads the current role from MySQL on each request.
- The Gemini API key is optional for the application but required for AI search. Standard keyword search does not need it.
- Before public deployment, add CSRF protection, rate limiting, email verification, image content scanning, monitoring, HTTPS, and a database backup/restore plan.
