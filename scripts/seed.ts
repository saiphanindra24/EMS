// One-off database seed script.
// Run with: npx tsx scripts/seed.ts
// Creates demo departments, designations, leave types, holidays, and one
// login per role so every part of the RBAC matrix can be exercised.
import "dotenv/config";
import { db, pool } from "../src/db";
import {
  users,
  employees,
  departments,
  designations,
  leaveTypes,
  holidays,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { eq } from "drizzle-orm";

const DEMO_PASSWORD = "Password@123";

async function upsertUser(email: string, role: (typeof users.role.enumValues)[number]) {
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length) return existing[0];
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [user] = await db.insert(users).values({ email, passwordHash, role }).returning();
  return user;
}

async function upsertEmployee(input: {
  userId: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  departmentId: number | null;
  designationId: number | null;
  managerId: number | null;
  dateOfJoining: string;
}) {
  const existing = await db.select().from(employees).where(eq(employees.userId, input.userId));
  if (existing.length) return existing[0];
  const [emp] = await db
    .insert(employees)
    .values({
      userId: input.userId,
      employeeCode: input.employeeCode,
      firstName: input.firstName,
      lastName: input.lastName,
      departmentId: input.departmentId,
      designationId: input.designationId,
      managerId: input.managerId,
      dateOfJoining: input.dateOfJoining,
      employmentType: "full_time",
      employmentStatus: "active",
      workLocation: "onsite",
      shift: "general",
      salary: "60000",
      bankAccountNumber: "000123456789",
      bankName: "Demo National Bank",
      bankIfsc: "DEMO0001234",
      pan: "ABCDE1234F",
      uan: "100200300400",
    })
    .returning();
  return emp;
}

async function main() {
  console.log("Seeding EMS/ETS demo data...");

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

  // Designations
  const desigSeed = [
    { title: "HR Manager", departmentId: deptRows.HR, level: "manager" as const },
    { title: "Software Engineer", departmentId: deptRows.ENG, level: "mid" as const },
    { title: "Engineering Manager", departmentId: deptRows.ENG, level: "manager" as const },
    { title: "Finance Officer", departmentId: deptRows.FIN, level: "senior" as const },
    { title: "Training Coordinator", departmentId: deptRows.TRN, level: "senior" as const },
  ];
  const desigRows: Record<string, number> = {};
  for (const d of desigSeed) {
    const existing = await db.select().from(designations).where(eq(designations.title, d.title));
    const row = existing[0] ?? (await db.insert(designations).values(d).returning())[0];
    desigRows[d.title] = row.id;
  }

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

  // Holidays
  const holidaySeed = [
    { name: "New Year's Day", date: `${new Date().getFullYear()}-01-01` },
    { name: "Independence Day", date: `${new Date().getFullYear()}-08-15` },
    { name: "Republic Day", date: `${new Date().getFullYear()}-01-26` },
  ];
  for (const h of holidaySeed) {
    const existing = await db.select().from(holidays).where(eq(holidays.date, h.date));
    if (!existing.length) await db.insert(holidays).values(h);
  }

  // Users + employees - one representative per role.
  const superAdminUser = await upsertUser("superadmin@ems.local", "super_admin");
  const superAdmin = await upsertEmployee({
    userId: superAdminUser.id,
    employeeCode: "EMP-0001",
    firstName: "Ava",
    lastName: "Sterling",
    departmentId: deptRows.HR,
    designationId: desigRows["HR Manager"],
    managerId: null,
    dateOfJoining: "2020-01-10",
  });

  const hrAdminUser = await upsertUser("hradmin@ems.local", "hr_admin");
  const hrAdmin = await upsertEmployee({
    userId: hrAdminUser.id,
    employeeCode: "EMP-0002",
    firstName: "Priya",
    lastName: "Nair",
    departmentId: deptRows.HR,
    designationId: desigRows["HR Manager"],
    managerId: superAdmin.id,
    dateOfJoining: "2020-03-15",
  });

  await upsertEmployee({
    userId: (await upsertUser("hrexec@ems.local", "hr_executive")).id,
    employeeCode: "EMP-0003",
    firstName: "Noah",
    lastName: "Bennett",
    departmentId: deptRows.HR,
    designationId: desigRows["HR Manager"],
    managerId: hrAdmin.id,
    dateOfJoining: "2021-02-01",
  });

  const managerUser = await upsertUser("manager@ems.local", "department_manager");
  const manager = await upsertEmployee({
    userId: managerUser.id,
    employeeCode: "EMP-0004",
    firstName: "Liam",
    lastName: "Carter",
    departmentId: deptRows.ENG,
    designationId: desigRows["Engineering Manager"],
    managerId: superAdmin.id,
    dateOfJoining: "2019-06-01",
  });

  const teamLeadUser = await upsertUser("teamlead@ems.local", "team_lead");
  const teamLead = await upsertEmployee({
    userId: teamLeadUser.id,
    employeeCode: "EMP-0005",
    firstName: "Emma",
    lastName: "Diaz",
    departmentId: deptRows.ENG,
    designationId: desigRows["Software Engineer"],
    managerId: manager.id,
    dateOfJoining: "2020-09-01",
  });

  await upsertEmployee({
    userId: (await upsertUser("employee@ems.local", "employee")).id,
    employeeCode: "EMP-0006",
    firstName: "Oliver",
    lastName: "Kim",
    departmentId: deptRows.ENG,
    designationId: desigRows["Software Engineer"],
    managerId: teamLead.id,
    dateOfJoining: "2022-04-11",
  });

  await upsertEmployee({
    userId: (await upsertUser("finance@ems.local", "finance_admin")).id,
    employeeCode: "EMP-0007",
    firstName: "Sophia",
    lastName: "Wallace",
    departmentId: deptRows.FIN,
    designationId: desigRows["Finance Officer"],
    managerId: superAdmin.id,
    dateOfJoining: "2021-07-19",
  });

  await upsertEmployee({
    userId: (await upsertUser("trainingadmin@ems.local", "training_admin")).id,
    employeeCode: "EMP-0008",
    firstName: "Mason",
    lastName: "Reed",
    departmentId: deptRows.TRN,
    designationId: desigRows["Training Coordinator"],
    managerId: superAdmin.id,
    dateOfJoining: "2021-01-05",
  });

  await upsertEmployee({
    userId: (await upsertUser("trainer@ems.local", "trainer")).id,
    employeeCode: "EMP-0009",
    firstName: "Isabella",
    lastName: "Moore",
    departmentId: deptRows.TRN,
    designationId: desigRows["Training Coordinator"],
    managerId: superAdmin.id,
    dateOfJoining: "2022-01-05",
  });

  await upsertEmployee({
    userId: (await upsertUser("auditor@ems.local", "auditor")).id,
    employeeCode: "EMP-0010",
    firstName: "James",
    lastName: "Foster",
    departmentId: deptRows.HR,
    designationId: desigRows["HR Manager"],
    managerId: superAdmin.id,
    dateOfJoining: "2023-01-05",
  });

  console.log("\nSeed complete. Demo accounts (all use password: Password@123):");
  console.log(" super_admin       -> superadmin@ems.local");
  console.log(" hr_admin          -> hradmin@ems.local");
  console.log(" hr_executive      -> hrexec@ems.local");
  console.log(" department_manager-> manager@ems.local");
  console.log(" team_lead         -> teamlead@ems.local");
  console.log(" employee          -> employee@ems.local");
  console.log(" finance_admin     -> finance@ems.local");
  console.log(" training_admin    -> trainingadmin@ems.local");
  console.log(" trainer           -> trainer@ems.local");
  console.log(" auditor           -> auditor@ems.local");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
