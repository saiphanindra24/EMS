import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, getEmployeeForSession, audit } from "@/lib/api";

// POST /api/attendance/checkin - self-service check-in for the current day.
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

    if (existing?.checkIn) {
      throw new HttpError("You have already checked in today", 409);
    }

    const now = new Date();
    const startOfWork = new Date(now);
    startOfWork.setHours(9, 30, 0, 0); // 9:30 AM standard shift start
    const lateMinutes = now > startOfWork ? Math.round((now.getTime() - startOfWork.getTime()) / 60000) : 0;

    let record;
    if (existing) {
      [record] = await db
        .update(attendanceRecords)
        .set({ checkIn: now, status: lateMinutes > 0 ? "late" : "present", lateMinutes })
        .where(eq(attendanceRecords.id, existing.id))
        .returning();
    } else {
      [record] = await db
        .insert(attendanceRecords)
        .values({
          employeeId: employee.id,
          date: today,
          checkIn: now,
          status: lateMinutes > 0 ? "late" : "present",
          lateMinutes,
        })
        .returning();
    }

    await audit({
      userId: session.userId,
      action: "ATTENDANCE_CHECKIN",
      resource: "attendance",
      resourceId: record.id,
      description: `Employee ${employee.employeeCode} checked in`,
    });

    return apiSuccess(record, 201);
  });
}
