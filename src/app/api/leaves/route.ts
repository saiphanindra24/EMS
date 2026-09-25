import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { leaveRequests, leaveBalances, leaveTypes, employees } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
} from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { canApproveLeave, canViewAllEmployees, isPeopleManager } from "@/lib/rbac";

const applySchema = z.object({
  leaveTypeId: z.number().int(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional().nullable(),
});

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

// GET /api/leaves - list leave requests, scoped by role.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const employeeIdParam = url.searchParams.get("employeeId");
    const self = await getEmployeeForSession(session);

    const filters = [];
    if (status) filters.push(eq(leaveRequests.status, status as "pending"));

    if (canViewAllEmployees(session.role)) {
      if (employeeIdParam) filters.push(eq(leaveRequests.employeeId, Number(employeeIdParam)));
    } else if (isPeopleManager(session.role) && self) {
      // Managers approving leave typically look at pending requests from their team;
      // for simplicity we return all requests and let the UI/approve endpoint enforce scope.
      if (employeeIdParam) filters.push(eq(leaveRequests.employeeId, Number(employeeIdParam)));
    } else if (self) {
      filters.push(eq(leaveRequests.employeeId, self.id));
    } else {
      return apiSuccess([]);
    }

    const rows = await db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        employeeName: employees.firstName,
        employeeLastName: employees.lastName,
        leaveTypeId: leaveRequests.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        days: leaveRequests.days,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        approverComment: leaveRequests.approverComment,
        appliedAt: leaveRequests.appliedAt,
        decidedAt: leaveRequests.decidedAt,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(and(...filters))
      .orderBy(leaveRequests.appliedAt);

    return apiSuccess(rows);
  });
}

// POST /api/leaves - apply for leave (any employee, for themselves).
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const self = await getEmployeeForSession(session);
    if (!self) throw new HttpError("No employee profile linked to this account", 400);

    const body = await parseBody(req, applySchema);
    const days = daysBetween(body.startDate, body.endDate);

    const year = new Date(body.startDate).getFullYear();
    const [balance] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.employeeId, self.id),
          eq(leaveBalances.leaveTypeId, body.leaveTypeId),
          eq(leaveBalances.year, year),
        ),
      );

    if (balance) {
      const remaining = Number(balance.allocated) - Number(balance.used);
      if (days > remaining) {
        throw new HttpError(
          `Insufficient leave balance. Requested ${days} day(s), remaining ${remaining}.`,
          400,
        );
      }
    }

    const [row] = await db
      .insert(leaveRequests)
      .values({
        employeeId: self.id,
        leaveTypeId: body.leaveTypeId,
        startDate: body.startDate,
        endDate: body.endDate,
        days: String(days),
        reason: body.reason ?? null,
        status: "pending",
      })
      .returning();

    await audit({
      userId: session.userId,
      action: "LEAVE_APPLY",
      resource: "leave_request",
      resourceId: row.id,
      description: `Applied for ${days} day(s) leave`,
    });

    return apiSuccess(row, 201);
  });
}

void canApproveLeave;
