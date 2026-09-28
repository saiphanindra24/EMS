// Direct SQL migration - applies schema changes for registration flow.
// Run with: npx tsx scripts/migrate-registration.ts
import "dotenv/config";
import { pool } from "../src/db";

async function main() {
  const client = await pool.connect();
  try {
    console.log("Applying registration schema changes...\n");

    // 1. Create registration_status enum
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE registration_status AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("✅ registration_status enum created");

    // 2. Add setup_token column to users table
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS setup_token varchar(128) UNIQUE;
    `);
    console.log("✅ setup_token column added to users");

    // 3. Create registration_requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS registration_requests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        status registration_status NOT NULL DEFAULT 'pending',
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        rejection_reason TEXT,
        assigned_employee_code VARCHAR(30),
        assigned_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
        assigned_designation_id INTEGER REFERENCES designations(id) ON DELETE SET NULL,
        assigned_role role DEFAULT 'employee',
        created_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ registration_requests table created");

    console.log("\n🎉 Migration complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
