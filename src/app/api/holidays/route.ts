import { z } from "zod";
import { db } from "@/db";
import { holidays } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { HR_ROLES } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().min(1),
  date: z.string().min(1),
  description: z.string().optional().nullable(),
  isOptional: z.boolean().default(false),
});

// GET /api/holidays - list the holiday calendar (visible to everyone).
export async function GET() {
  return withErrorHandling(async () => {
    await requireAuth();
    const rows = await db.select().from(holidays).orderBy(holidays.date);
    return apiSuccess(rows);
  });
}

// POST /api/holidays - add a holiday to the calendar (HR/Admin only).
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!HR_ROLES.includes(session.role)) {
      throw new HttpError("Only HR/Admin can manage the holiday calendar", 403);
    }
    const body = await parseBody(req, createSchema);
    const [row] = await db.insert(holidays).values(body).returning();

    await audit({
      userId: session.userId,
      action: "HOLIDAY_CREATE",
      resource: "holiday",
      resourceId: row.id,
      description: `Added holiday ${row.name} on ${row.date}`,
    });

    return apiSuccess(row, 201);
  });
}
