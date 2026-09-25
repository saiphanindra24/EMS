import { z } from "zod";
import { db } from "@/db";
import { leaveTypes } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { HR_ROLES } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().min(1),
  code: z.enum(["casual", "sick", "earned", "comp_off", "maternity", "paternity", "loss_of_pay"]),
  description: z.string().optional().nullable(),
  defaultDaysPerYear: z.number().default(0),
  carryForward: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
});

// GET /api/leave-types - list configured leave types (visible to everyone).
export async function GET() {
  return withErrorHandling(async () => {
    await requireAuth();
    const rows = await db.select().from(leaveTypes).orderBy(leaveTypes.name);
    return apiSuccess(rows);
  });
}

// POST /api/leave-types - configure a new leave type (HR/Admin only).
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!HR_ROLES.includes(session.role)) {
      throw new HttpError("Only HR/Admin can configure leave types", 403);
    }
    const body = await parseBody(req, createSchema);
    const [row] = await db
      .insert(leaveTypes)
      .values({ ...body, defaultDaysPerYear: String(body.defaultDaysPerYear) })
      .returning();

    await audit({
      userId: session.userId,
      action: "LEAVE_TYPE_CREATE",
      resource: "leave_type",
      resourceId: row.id,
      description: `Created leave type ${row.name}`,
    });

    return apiSuccess(row, 201);
  });
}
