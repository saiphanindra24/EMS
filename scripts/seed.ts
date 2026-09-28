// One-off database seed script.
// Run with: npx tsx scripts/seed.ts
// Creates the initial super admin account plus departments, designations,
// leave types, and holidays. Employees register themselves via /register.
import "dotenv/config";
import { db, pool } from "../src/db";
import {
  users,
  departments,
  designations,
  leaveTypes,
  holidays,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { eq } from "drizzle-orm";

// ⚠️ Change these to your real admin credentials before running!
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@volksskatt.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";

async function main() {
  console.log("Seeding VolkssKatt EMS...\n");

  // Departments
  const deptSeed = [
    { name: "Human Resources", code: "HR" },
    { name: "Engineering", code: "ENG" },
    { name: "Finance", code: "FIN" },
    { name: "Training & Development", code: "TRN" },
  ];
  const deptRows: Record<string, number> = {};
  for (const d of deptSeed) {
    const existing = await db.select().from(departments).where(eq(departments.code, d.code));
    const row = existing[0] ?? (await db.insert(departments).values(d).returning())[0];
    deptRows[d.code] = row.id;
  }
  console.log("✅ Departments seeded");

  // Designations
  const desigSeed = [
    { title: "HR Manager", departmentId: deptRows.HR, level: "manager" as const },
    { title: "Software Engineer", departmentId: deptRows.ENG, level: "mid" as const },
    { title: "Engineering Manager", departmentId: deptRows.ENG, level: "manager" as const },
    { title: "Finance Officer", departmentId: deptRows.FIN, level: "senior" as const },
    { title: "Training Coordinator", departmentId: deptRows.TRN, level: "senior" as const },
  ];
  for (const d of desigSeed) {
    const existing = await db.select().from(designations).where(eq(designations.title, d.title));
    if (!existing.length) await db.insert(designations).values(d);
  }
  console.log("✅ Designations seeded");

  // Leave types
  const leaveSeed = [
    { name: "Casual Leave", code: "casual" as const, defaultDaysPerYear: "12" },
    { name: "Sick Leave", code: "sick" as const, defaultDaysPerYear: "10" },
    { name: "Earned Leave", code: "earned" as const, defaultDaysPerYear: "15", carryForward: true },
    { name: "Compensatory Off", code: "comp_off" as const, defaultDaysPerYear: "0" },
    { name: "Maternity Leave", code: "maternity" as const, defaultDaysPerYear: "180" },
    { name: "Paternity Leave", code: "paternity" as const, defaultDaysPerYear: "15" },
    { name: "Loss of Pay", code: "loss_of_pay" as const, defaultDaysPerYear: "0", requiresApproval: true },
  ];
  for (const l of leaveSeed) {
    const existing = await db.select().from(leaveTypes).where(eq(leaveTypes.code, l.code));
    if (!existing.length) await db.insert(leaveTypes).values(l);
  }
  console.log("✅ Leave types seeded");

  // Holidays
  const year = new Date().getFullYear();
  const holidaySeed = [
    { name: "New Year's Day", date: `${year}-01-01` },
    { name: "Republic Day", date: `${year}-01-26` },
    { name: "Independence Day", date: `${year}-08-15` },
    { name: "Gandhi Jayanti", date: `${year}-10-02` },
    { name: "Diwali", date: `${year}-11-01` },
    { name: "Christmas", date: `${year}-12-25` },
  ];
  for (const h of holidaySeed) {
    const existing = await db.select().from(holidays).where(eq(holidays.date, h.date));
    if (!existing.length) await db.insert(holidays).values(h);
  }
  console.log("✅ Holidays seeded");

  // Super Admin account
  const existing = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL));
  if (!existing.length) {
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    await db.insert(users).values({
      email: ADMIN_EMAIL,
      passwordHash,
      role: "super_admin",
      isActive: true,
    });
    console.log(`\n✅ Super admin created:`);
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
  } else {
    console.log(`\n✅ Super admin already exists: ${ADMIN_EMAIL}`);
  }

  console.log("\n🎉 Seed complete! Employees can register at /register");
  console.log("   Admin approves registrations at /registrations\n");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
