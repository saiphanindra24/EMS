import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, getEmployeeForSession, audit } from "@/lib/api";

// POST /api/attendance/checkout - self-service check-out; computes worked/overtime hours.
export async function POST() {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const employee = await getEmployeeForSession(session);
    if (!employee) throw new HttpError("No employee profile linked to this account", 400);

    const today = new Date().toISOString().slice(0, 10);
    const [existing] = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.employeeId, employee.id), eq(attendanceRecords.date, today)));

    if (!existing || !existing.checkIn) {
      throw new HttpError("You must check in before checking out", 400);
    }
    if (existing.checkOut) {
      throw new HttpError("You have already checked out today", 409);
    }

    const now = new Date();
    const checkIn = new Date(existing.checkIn);
    const hoursWorked = (now.getTime() - checkIn.getTime()) / 3600000;
    const workingHours = Math.max(0, Math.round(hoursWorked * 100) / 100);
    const overtimeHours = Math.max(0, Math.round((workingHours - 8) * 100) / 100);
    const status = workingHours < 4 ? "half_day" : existing.status;

    const [record] = await db
      .update(attendanceRecords)
      .set({ checkOut: now, workingHours: String(workingHours), overtimeHours: String(overtimeHours), status })
      .where(eq(attendanceRecords.id, existing.id))
      .returning();

    await audit({
      userId: session.userId,
      action: "ATTENDANCE_CHECKOUT",
      resource: "attendance",
      resourceId: record.id,
      description: `Employee ${employee.employeeCode} checked out (${workingHours}h)`,
    });

    return apiSuccess(record);
  });
}
