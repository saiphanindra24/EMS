import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit, parseId } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { canManageOrgStructure } from "@/lib/rbac";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  headEmployeeId: z.number().int().optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

// GET /api/departments/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    await requireAuth();
    const id = parseId((await params).id);
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    if (!dept) throw new HttpError("Department not found", 404);
    return apiSuccess(dept);
  });
}

// PATCH /api/departments/:id - update department details (Super Admin / HR Admin).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!canManageOrgStructure(session.role)) {
      throw new HttpError("Only Super Admin / HR Admin can update departments", 403);
    }
    const id = parseId((await params).id);
    const body = await parseBody(req, updateSchema);

    const [updated] = await db
      .update(departments)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    if (!updated) throw new HttpError("Department not found", 404);

    await audit({
      userId: session.userId,
      action: "DEPARTMENT_UPDATE",
      resource: "department",
      resourceId: id,
      description: `Updated department ${updated.name}`,
    });

    return apiSuccess(updated);
  });
}

// DELETE /api/departments/:id - deactivate a department (soft delete).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!canManageOrgStructure(session.role)) {
      throw new HttpError("Only Super Admin / HR Admin can delete departments", 403);
    }
    const id = parseId((await params).id);
    const [updated] = await db
      .update(departments)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    if (!updated) throw new HttpError("Department not found", 404);

    await audit({
      userId: session.userId,
      action: "DEPARTMENT_DELETE",
      resource: "department",
      resourceId: id,
      description: `Deactivated department ${updated.name}`,
    });

    return apiSuccess({ deactivated: true });
  });
}
