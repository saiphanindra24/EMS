import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceRecords,
  leaveRequests,
  leaveTypes,
  employees,
  departments,
  payslips,
  payrollRuns,
  enrollments,
  trainings,
} from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError } from "@/lib/api";
import { HR_ROLES, FINANCE_ROLES, isTrainingAdmin, canViewAllEmployees } from "@/lib/rbac";

// GET /api/reports?type=attendance|leave|payroll|training&from=&to=
// A single consolidated reporting endpoint. Each report type has its own
// authorization rule since they expose different sensitivity levels.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "attendance";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (type === "attendance") {
      if (!HR_ROLES.includes(session.role) && !canViewAllEmployees(session.role)) {
        throw new HttpError("Only HR/Admin/Auditor can view attendance reports", 403);
      }
      const filters = [];
      if (from) filters.push(gte(attendanceRecords.date, from));
      if (to) filters.push(lte(attendanceRecords.date, to));
      const rows = await db
        .select({ status: attendanceRecords.status, total: count() })
        .from(attendanceRecords)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(attendanceRecords.status);
      return apiSuccess({ type, breakdown: rows });
    }

    if (type === "leave") {
      if (!HR_ROLES.includes(session.role) && !canViewAllEmployees(session.role)) {
        throw new HttpError("Only HR/Admin/Auditor can view leave reports", 403);
      }
      const rows = await db
        .select({ leaveType: leaveTypes.name, status: leaveRequests.status, total: count() })
        .from(leaveRequests)
        .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
        .groupBy(leaveTypes.name, leaveRequests.status);
      return apiSuccess({ type, breakdown: rows });
    }

    if (type === "payroll") {
      if (!FINANCE_ROLES.includes(session.role)) {
        throw new HttpError("Only Finance/HR/Admin can view payroll reports", 403);
      }
      const rows = await db
        .select({
          runId: payslips.payrollRunId,
          month: payrollRuns.month,
          year: payrollRuns.year,
          totalNet: sql<string>`sum(${payslips.netSalary})`,
          totalGross: sql<string>`sum(${payslips.grossSalary})`,
          headcount: count(),
        })
        .from(payslips)
        .innerJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
        .groupBy(payslips.payrollRunId, payrollRuns.month, payrollRuns.year)
        .orderBy(payrollRuns.year, payrollRuns.month);
      return apiSuccess({ type, breakdown: rows });
    }

    if (type === "training") {
      if (!isTrainingAdmin(session.role) && !HR_ROLES.includes(session.role)) {
        throw new HttpError("Only Training Admin/HR/Admin can view training reports", 403);
      }
      const rows = await db
        .select({ trainingTitle: trainings.title, status: enrollments.status, total: count() })
        .from(enrollments)
        .innerJoin(trainings, eq(enrollments.trainingId, trainings.id))
        .groupBy(trainings.title, enrollments.status);
      return apiSuccess({ type, breakdown: rows });
    }

    if (type === "headcount") {
      if (!HR_ROLES.includes(session.role) && !canViewAllEmployees(session.role)) {
        throw new HttpError("Only HR/Admin/Auditor can view headcount reports", 403);
      }
      const rows = await db
        .select({ department: departments.name, total: count() })
        .from(employees)
        .innerJoin(departments, eq(employees.departmentId, departments.id))
        .where(eq(employees.employmentStatus, "active"))
        .groupBy(departments.name);
      return apiSuccess({ type, breakdown: rows });
    }

    throw new HttpError("Unknown report type", 400);
  });
}
