import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { leaveRequests, leaveBalances, employees, notifications } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
  parseId,
} from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { canApproveLeave, canViewAllEmployees, isPeopleManager } from "@/lib/rbac";

const decisionSchema = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  comment: z.string().optional().nullable(),
});

// GET /api/leaves/:id - view one leave request (owner, manager, or HR/Admin).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [row] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    if (!row) throw new HttpError("Leave request not found", 404);

    const self = await getEmployeeForSession(session);
    const isOwner = self?.id === row.employeeId;
    if (!isOwner && !canViewAllEmployees(session.role) && !isPeopleManager(session.role)) {
      throw new HttpError("You cannot view this leave request", 403);
    }
    return apiSuccess(row);
  });
}

// PATCH /api/leaves/:id - approve / reject (managers, HR) or cancel (owner, while pending).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const body = await parseBody(req, decisionSchema);

    const [row] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    if (!row) throw new HttpError("Leave request not found", 404);
    if (row.status !== "pending") {
      throw new HttpError(`Leave request is already ${row.status}`, 409);
    }

    const self = await getEmployeeForSession(session);

    if (body.action === "cancel") {
      if (self?.id !== row.employeeId) {
        throw new HttpError("Only the requester can cancel their own pending leave", 403);
      }
    } else {
      if (!canApproveLeave(session.role)) {
        throw new HttpError("You do not have permission to approve/reject leave", 403);
      }
      if (isPeopleManager(session.role) && !canViewAllEmployees(session.role)) {
        const [target] = await db.select().from(employees).where(eq(employees.id, row.employeeId));
        if (!target || (target.managerId !== self?.id && target.departmentId !== self?.departmentId)) {
          throw new HttpError("You can only approve leave for your own team", 403);
        }
      }
    }

    const newStatus = body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "cancelled";

    const [updated] = await db
      .update(leaveRequests)
      .set({
        status: newStatus,
        approverComment: body.comment ?? null,
        approverId: body.action === "cancel" ? row.approverId : session.userId,
        decidedAt: new Date(),
      })
      .where(eq(leaveRequests.id, id))
      .returning();

    if (newStatus === "approved") {
      const year = new Date(row.startDate).getFullYear();
      await db
        .update(leaveBalances)
        .set({ used: String(Number((
          await db
            .select()
            .from(leaveBalances)
            .where(
              and(
                eq(leaveBalances.employeeId, row.employeeId),
                eq(leaveBalances.leaveTypeId, row.leaveTypeId),
                eq(leaveBalances.year, year),
              ),
            )
        )[0]?.used ?? 0) + Number(row.days)) })
        .where(
          and(
            eq(leaveBalances.employeeId, row.employeeId),
            eq(leaveBalances.leaveTypeId, row.leaveTypeId),
            eq(leaveBalances.year, year),
          ),
        );
    }

    const [employee] = await db.select().from(employees).where(eq(employees.id, row.employeeId));
    if (employee && newStatus !== "cancelled") {
      await db.insert(notifications).values({
        userId: employee.userId,
        type: "leave",
        title: `Leave ${newStatus}`,
        message: `Your leave request (${row.startDate} to ${row.endDate}) was ${newStatus}.`,
        relatedEntityType: "leave_request",
        relatedEntityId: row.id,
      });
    }

    await audit({
      userId: session.userId,
      action: `LEAVE_${newStatus.toUpperCase()}`,
      resource: "leave_request",
      resourceId: id,
      description: `Leave request ${newStatus}`,
    });

    return apiSuccess(updated);
  });
}
