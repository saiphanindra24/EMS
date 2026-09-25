import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, employees } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { canManageOrgStructure } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional().nullable(),
  headEmployeeId: z.number().int().optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
});

// GET /api/departments - list all departments with live employee counts.
// Readable by any authenticated user (needed for dropdowns across the app).
export async function GET() {
  return withErrorHandling(async () => {
    await requireAuth();
    const rows = await db
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
        description: departments.description,
        headEmployeeId: departments.headEmployeeId,
        status: departments.status,
        employeeCount: count(employees.id),
      })
      .from(departments)
      .leftJoin(employees, eq(employees.departmentId, departments.id))
      .groupBy(departments.id)
      .orderBy(departments.name);

    return apiSuccess(rows);
  });
}

// POST /api/departments - create a new department (Super Admin / HR Admin only).
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!canManageOrgStructure(session.role)) {
      throw new HttpError("Only Super Admin / HR Admin can create departments", 403);
    }
    const body = await parseBody(req, createSchema);

    const existing = await db.select().from(departments).where(eq(departments.code, body.code));
    if (existing.length) throw new HttpError("Department code already in use", 409);

    const [dept] = await db.insert(departments).values(body).returning();

    await audit({
      userId: session.userId,
      action: "DEPARTMENT_CREATE",
      resource: "department",
      resourceId: dept.id,
      description: `Created department ${dept.name}`,
    });

    return apiSuccess(dept, 201);
  });
}
