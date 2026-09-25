import { z } from "zod";
import { db } from "@/db";
import { performanceCycles } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { HR_ROLES } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(["upcoming", "active", "closed"]).default("upcoming"),
  description: z.string().optional().nullable(),
});

// GET /api/performance/cycles - list performance review cycles.
export async function GET() {
  return withErrorHandling(async () => {
    await requireAuth();
    const rows = await db.select().from(performanceCycles).orderBy(performanceCycles.startDate);
    return apiSuccess(rows);
  });
}

// POST /api/performance/cycles - create a new review cycle (HR/Admin only).
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!HR_ROLES.includes(session.role)) {
      throw new HttpError("Only HR/Admin can create performance cycles", 403);
    }
    const body = await parseBody(req, createSchema);
    const [row] = await db.insert(performanceCycles).values(body).returning();

    await audit({
      userId: session.userId,
      action: "PERFORMANCE_CYCLE_CREATE",
      resource: "performance_cycle",
      resourceId: row.id,
      description: `Created performance cycle ${row.name}`,
    });

    return apiSuccess(row, 201);
  });
}
