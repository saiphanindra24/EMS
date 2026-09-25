import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { performanceReviews, employees } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
} from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { canViewAllEmployees, isPeopleManager } from "@/lib/rbac";

const createSchema = z.object({
  cycleId: z.number().int(),
  employeeId: z.number().int(),
  reviewType: z.enum(["self", "manager"]),
  rating: z.number().min(0).max(5).optional().nullable(),
  strengths: z.string().optional().nullable(),
  improvements: z.string().optional().nullable(),
  feedback: z.string().optional().nullable(),
  status: z.enum(["draft", "submitted"]).default("draft"),
});

// GET /api/performance/reviews - list reviews, scoped by role.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const employeeIdParam = url.searchParams.get("employeeId");
    const cycleId = url.searchParams.get("cycleId");
    const self = await getEmployeeForSession(session);

    const filters = [];
    if (cycleId) filters.push(eq(performanceReviews.cycleId, Number(cycleId)));

    if (canViewAllEmployees(session.role)) {
      if (employeeIdParam) filters.push(eq(performanceReviews.employeeId, Number(employeeIdParam)));
    } else if (isPeopleManager(session.role) && self) {
      const requested = employeeIdParam ? Number(employeeIdParam) : self.id;
      filters.push(eq(performanceReviews.employeeId, requested));
    } else if (self) {
      filters.push(eq(performanceReviews.employeeId, self.id));
    } else {
      return apiSuccess([]);
    }

    const rows = await db
      .select()
      .from(performanceReviews)
      .where(and(...filters))
      .orderBy(performanceReviews.createdAt);
    return apiSuccess(rows);
  });
}

// POST /api/performance/reviews - submit a self-review or manager review.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const self = await getEmployeeForSession(session);
    const body = await parseBody(req, createSchema);

    if (body.reviewType === "self") {
      if (self?.id !== body.employeeId) {
        throw new HttpError("You can only submit a self-review for yourself", 403);
      }
    } else {
      if (!isPeopleManager(session.role) && !canViewAllEmployees(session.role)) {
        throw new HttpError("Only managers/HR can submit a manager review", 403);
      }
      if (isPeopleManager(session.role) && !canViewAllEmployees(session.role)) {
        const [target] = await db.select().from(employees).where(eq(employees.id, body.employeeId));
        if (!target || target.managerId !== self?.id) {
          throw new HttpError("You can only review your direct reports", 403);
        }
      }
    }

    const [row] = await db
      .insert(performanceReviews)
      .values({
        ...body,
        rating: body.rating != null ? String(body.rating) : null,
        reviewerId: session.userId,
        submittedAt: body.status === "submitted" ? new Date() : null,
      })
      .returning();

    await audit({
      userId: session.userId,
      action: "PERFORMANCE_REVIEW_SUBMIT",
      resource: "performance_review",
      resourceId: row.id,
      description: `Submitted ${body.reviewType} review for employee ${body.employeeId}`,
    });

    return apiSuccess(row, 201);
  });
}
