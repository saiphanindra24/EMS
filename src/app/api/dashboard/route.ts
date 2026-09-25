import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  employees,
  departments,
  attendanceRecords,
  leaveRequests,
  payrollRuns,
  trainings,
  enrollments,
  certificates,
  auditLogs,
} from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, getEmployeeForSession } from "@/lib/api";
import { canViewAllEmployees, isPeopleManager, isTrainingAdmin, isTrainer } from "@/lib/rbac";

// GET /api/dashboard - role-aware summary widgets for the landing dashboard.
export async function GET() {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const self = await getEmployeeForSession(session);
    const today = new Date().toISOString().slice(0, 10);

    if (canViewAllEmployees(session.role)) {
      const [[{ value: totalEmployees }], [{ value: totalDepartments }], [{ value: presentToday }], [{ value: pendingLeave }], recentRuns, [{ value: activeTrainings }], [{ value: recentAudit }]] =
        await Promise.all([
          db.select({ value: count() }).from(employees).where(eq(employees.employmentStatus, "active")),
          db.select({ value: count() }).from(departments).where(eq(departments.status, "active")),
          db.select({ value: count() }).from(attendanceRecords).where(eq(attendanceRecords.date, today)),
          db.select({ value: count() }).from(leaveRequests).where(eq(leaveRequests.status, "pending")),
          db.select().from(payrollRuns).orderBy(sql`${payrollRuns.year} desc, ${payrollRuns.month} desc`).limit(1),
          db.select({ value: count() }).from(trainings).where(eq(trainings.status, "ongoing")),
          db.select({ value: count() }).from(auditLogs).where(gte(auditLogs.createdAt, new Date(Date.now() - 86400000))),
        ]);

      return apiSuccess({
        role: session.role,
        widgets: {
          totalEmployees,
          totalDepartments,
          presentToday,
          pendingLeave,
          lastPayrollRun: recentRuns[0] ?? null,
          activeTrainings,
          systemActivityLast24h: recentAudit,
        },
      });
    }

    if (isTrainingAdmin(session.role)) {
      const [[{ value: totalTrainings }], [{ value: totalEnrollments }], [{ value: completed }], [{ value: certsIssued }]] =
        await Promise.all([
          db.select({ value: count() }).from(trainings),
          db.select({ value: count() }).from(enrollments),
          db.select({ value: count() }).from(enrollments).where(eq(enrollments.status, "completed")),
          db.select({ value: count() }).from(certificates),
        ]);
      return apiSuccess({
        role: session.role,
        widgets: { totalTrainings, totalEnrollments, completed, certsIssued },
      });
    }

    if (isTrainer(session.role) && self) {
      const [[{ value: assignedTrainings }]] = await Promise.all([
        db.select({ value: count() }).from(trainings).where(eq(trainings.trainerId, self.id)),
      ]);
      return apiSuccess({ role: session.role, widgets: { assignedTrainings } });
    }

    if (isPeopleManager(session.role) && self) {
      const [[{ value: teamSize }], [{ value: pendingLeave }]] = await Promise.all([
        db.select({ value: count() }).from(employees).where(eq(employees.managerId, self.id)),
        db
          .select({ value: count() })
          .from(leaveRequests)
          .where(and(eq(leaveRequests.status, "pending"))),
      ]);
      return apiSuccess({ role: session.role, widgets: { teamSize, pendingLeave } });
    }

    // Default: individual employee dashboard.
    if (!self) {
      return apiSuccess({ role: session.role, widgets: {} });
    }
    const [[{ value: myEnrollments }], [{ value: myCertificates }], [{ value: myPendingLeave }], [attendanceToday]] =
      await Promise.all([
        db.select({ value: count() }).from(enrollments).where(eq(enrollments.employeeId, self.id)),
        db.select({ value: count() }).from(certificates).where(eq(certificates.employeeId, self.id)),
        db
          .select({ value: count() })
          .from(leaveRequests)
          .where(and(eq(leaveRequests.employeeId, self.id), eq(leaveRequests.status, "pending"))),
        db
          .select()
          .from(attendanceRecords)
          .where(and(eq(attendanceRecords.employeeId, self.id), eq(attendanceRecords.date, today))),
      ]);

    return apiSuccess({
      role: session.role,
      widgets: {
        myEnrollments,
        myCertificates,
        myPendingLeave,
        checkedInToday: Boolean(attendanceToday?.checkIn),
        checkedOutToday: Boolean(attendanceToday?.checkOut),
        checkInTime: attendanceToday?.checkIn ?? null,
        checkOutTime: attendanceToday?.checkOut ?? null,
      },
    });
  });
}
