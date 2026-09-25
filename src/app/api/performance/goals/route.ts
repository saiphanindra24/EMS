import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { goals, employees } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
} from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { canViewAllEmployees, isPeopleManager, HR_ROLES } from "@/lib/rbac";

const createSchema = z.object({
  cycleId: z.number().int(),
  employeeId: z.number().int(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  weight: z.number().default(0),
  targetDate: z.string().optional().nullable(),
});

const updateSchema = z.object({
  id: z.number().int(),
  status: z.enum(["not_started", "in_progress", "completed", "cancelled"]).optional(),
  progress: z.number().min(0).max(100).optional(),
});

// GET /api/performance/goals?employeeId=&cycleId= - list goals, scoped by role.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const employeeIdParam = url.searchParams.get("employeeId");
    const cycleId = url.searchParams.get("cycleId");
    const self = await getEmployeeForSession(session);

    const filters = [];
    if (cycleId) filters.push(eq(goals.cycleId, Number(cycleId)));

    if (canViewAllEmployees(session.role)) {
      if (employeeIdParam) filters.push(eq(goals.employeeId, Number(employeeIdParam)));
    } else if (isPeopleManager(session.role) && self) {
      const requested = employeeIdParam ? Number(employeeIdParam) : self.id;
      filters.push(eq(goals.employeeId, requested));
    } else if (self) {
      filters.push(eq(goals.employeeId, self.id));
    } else {
      return apiSuccess([]);
    }

    const rows = await db.select().from(goals).where(and(...filters)).orderBy(goals.createdAt);
    return apiSuccess(rows);
  });
}

// POST /api/performance/goals - assign a goal to an employee (manager/HR).
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const self = await getEmployeeForSession(session);
    const body = await parseBody(req, createSchema);

    const canAssignAny = HR_ROLES.includes(session.role);
    if (!canAssignAny) {
      if (!isPeopleManager(session.role) || !self) {
        throw new HttpError("Only managers/HR can assign goals", 403);
      }
      const [target] = await db.select().from(employees).where(eq(employees.id, body.employeeId));
      if (!target || (target.managerId !== self.id && target.departmentId !== self.departmentId)) {
        throw new HttpError("You can only assign goals to your own team", 403);
      }
    }

    const [row] = await db
      .insert(goals)
      .values({ ...body, weight: String(body.weight), createdBy: session.userId })
      .returning();

    await audit({
      userId: session.userId,
      action: "GOAL_CREATE",
      resource: "goal",
      resourceId: row.id,
      description: `Assigned goal "${row.title}" to employee ${body.employeeId}`,
    });

    return apiSuccess(row, 201);
  });
}

// PATCH /api/performance/goals - update goal progress/status (owner, manager, or HR).
export async function PATCH(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const body = await parseBody(req, updateSchema);
    const [goal] = await db.select().from(goals).where(eq(goals.id, body.id));
    if (!goal) throw new HttpError("Goal not found", 404);

    const self = await getEmployeeForSession(session);
    const isOwner = self?.id === goal.employeeId;
    if (!isOwner && !HR_ROLES.includes(session.role) && !isPeopleManager(session.role)) {
      throw new HttpError("You cannot update this goal", 403);
    }

    const { id, ...rest } = body;
    const [updated] = await db.update(goals).set(rest).where(eq(goals.id, id)).returning();

    await audit({
      userId: session.userId,
      action: "GOAL_UPDATE",
      resource: "goal",
      resourceId: id,
      description: "Updated goal progress/status",
    });

    return apiSuccess(updated);
  });
}
