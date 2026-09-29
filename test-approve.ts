import "dotenv/config";
import { db } from "@/db";
import { registrationRequests, users, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

async function main() {
  try {
    const email = "test_registration_error@example.com";
    
    // 1. Insert dummy registration request
    const [req] = await db.insert(registrationRequests).values({
      email,
      firstName: "Test",
      lastName: "User",
      phone: "1234567890",
      status: "pending",
    }).returning();

    console.log("Created request:", req.id);

    // 2. Perform the exact transaction from route.ts
    const tempPasswordHash = await bcrypt.hash(uuidv4(), 10);
    const setupToken = uuidv4();
    
    const body = {
      employeeCode: "EMP-TEST-" + Date.now().toString().slice(-4),
      role: "employee",
      dateOfJoining: "2026-09-29",
      departmentId: null,
      designationId: null,
    };

    const result = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email: req.email,
          passwordHash: tempPasswordHash,
          role: body.role as any,
          isActive: true,
          mustChangePassword: true,
          setupToken,
        })
        .returning();

      const [newEmployee] = await tx
        .insert(employees)
        .values({
          userId: newUser.id,
          employeeCode: body.employeeCode,
          firstName: req.firstName,
          lastName: req.lastName,
          dateOfJoining: body.dateOfJoining,
          departmentId: body.departmentId ?? null,
          designationId: body.designationId ?? null,
          phone: req.phone,
          employmentType: "full_time",
          employmentStatus: "active",
          workLocation: "onsite",
          shift: "general",
        })
        .returning();

      await tx
        .update(registrationRequests)
        .set({
          status: "approved",
          reviewedBy: null,
          reviewedAt: new Date(),
          assignedEmployeeCode: body.employeeCode,
          assignedDepartmentId: body.departmentId ?? null,
          assignedDesignationId: body.designationId ?? null,
          assignedRole: body.role as any,
          createdUserId: newUser.id,
        })
        .where(eq(registrationRequests.id, req.id));

      return { newUser, newEmployee };
    });

    console.log("Success!", result);
  } catch (err) {
    console.error("FAILED WITH ERROR:", err);
  }
  process.exit(0);
}

main();
