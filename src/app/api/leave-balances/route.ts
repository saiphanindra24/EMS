import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { leaveBalances, leaveTypes, employees } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  getEmployeeForSession,
} from "@/lib/api";
import { canViewAllEmployees, isPeopleManager } from "@/lib/rbac";

// GET /api/leave-balances?employeeId=&year= - view leave balances.
// Employees can only see their own; managers/HR can view others' with checks.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
    const employeeIdParam = url.searchParams.get("employeeId");

    const self = await getEmployeeForSession(session);
    let employeeId = self?.id ?? null;

    if (employeeIdParam) {
      const requested = Number(employeeIdParam);
      if (canViewAllEmployees(session.role)) {
        employeeId = requested;
      } else if (isPeopleManager(session.role) && self) {
        const [target] = await db.select().from(employees).where(eq(employees.id, requested));
        if (!target || (target.managerId !== self.id && target.departmentId !== self.departmentId)) {
          throw new HttpError("You cannot view this employee's leave balance", 403);
        }
        employeeId = requested;
      } else if (requested !== self?.id) {
        throw new HttpError("You cannot view this employee's leave balance", 403);
      }
    }

    if (!employeeId) return apiSuccess([]);

    // Ensure a balance row exists for every active leave type this year
    // (lazily seeded on first read so admins don't have to pre-provision).
    const types = await db.select().from(leaveTypes).where(eq(leaveTypes.status, "active"));
    const existing = await db
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, year)));

    const existingTypeIds = new Set(existing.map((e) => e.leaveTypeId));
    const missing = types.filter((t) => !existingTypeIds.has(t.id));
    if (missing.length) {
      await db.insert(leaveBalances).values(
        missing.map((t) => ({
          employeeId: employeeId as number,
          leaveTypeId: t.id,
          year,
          allocated: t.defaultDaysPerYear ?? "0",
          used: "0",
        })),
      );
    }

    const rows = await db
      .select({
        id: leaveBalances.id,
        leaveTypeId: leaveBalances.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        leaveTypeCode: leaveTypes.code,
        year: leaveBalances.year,
        allocated: leaveBalances.allocated,
        used: leaveBalances.used,
      })
      .from(leaveBalances)
      .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
      .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, year)));

    return apiSuccess(rows);
  });
}
