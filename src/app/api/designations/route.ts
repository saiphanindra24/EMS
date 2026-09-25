import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { designations, departments } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { canManageOrgStructure } from "@/lib/rbac";

const createSchema = z.object({
  title: z.string().min(1),
  departmentId: z.number().int(),
  description: z.string().optional().nullable(),
  level: z
    .enum(["entry", "junior", "mid", "senior", "lead", "manager", "director", "executive"])
    .default("entry"),
  status: z.enum(["active", "inactive"]).default("active"),
});

// GET /api/designations - list designations, optionally filtered by department.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    await requireAuth();
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId");

    const rows = await db
      .select({
        id: designations.id,
        title: designations.title,
        departmentId: designations.departmentId,
        departmentName: departments.name,
        description: designations.description,
        level: designations.level,
        status: designations.status,
      })
      .from(designations)
      .leftJoin(departments, eq(designations.departmentId, departments.id))
      .where(departmentId ? eq(designations.departmentId, Number(departmentId)) : undefined)
      .orderBy(designations.title);

    return apiSuccess(rows);
  });
}

// POST /api/designations - create a new designation (Super Admin / HR Admin).
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!canManageOrgStructure(session.role)) {
      throw new HttpError("Only Super Admin / HR Admin can create designations", 403);
    }
    const body = await parseBody(req, createSchema);
    const [designation] = await db.insert(designations).values(body).returning();

    await audit({
      userId: session.userId,
      action: "DESIGNATION_CREATE",
      resource: "designation",
      resourceId: designation.id,
      description: `Created designation ${designation.title}`,
    });

    return apiSuccess(designation, 201);
  });
}
