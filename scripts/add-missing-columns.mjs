/**
 * Migration: Add missing columns to the `users` table.
 *
 * These columns exist in schema.ts but were never applied to the live DB,
 * causing "column does not exist" errors on every login / forgot-password request.
 *
 * Run once:  node scripts/add-missing-columns.mjs
 */

import { config } from "dotenv";
import pg from "pg";

config(); // load .env

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("neon.tech") ? { rejectUnauthorized: false } : false,
});

const alterStatements = [
  // New security / auth columns added to schema.ts
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token   VARCHAR(128) UNIQUE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts  INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until            TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at           TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password    BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token             VARCHAR(128) UNIQUE`,
];

async function run() {
  const client = await pool.connect();
  try {
    console.log("Connected to database. Applying missing column migrations...\n");
    for (const sql of alterStatements) {
      console.log(`  → ${sql.trim().slice(0, 80)}...`);
      await client.query(sql);
      console.log("    ✓ OK");
    }
    console.log("\n✅ All columns applied successfully.\n");
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
