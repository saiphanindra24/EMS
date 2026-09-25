import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { designations } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit, parseId } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { canManageOrgStructure } from "@/lib/rbac";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  departmentId: z.number().int().optional(),
  description: z.string().optional().nullable(),
  level: z
    .enum(["entry", "junior", "mid", "senior", "lead", "manager", "director", "executive"])
    .optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!canManageOrgStructure(session.role)) {
      throw new HttpError("Only Super Admin / HR Admin can update designations", 403);
    }
    const id = parseId((await params).id);
    const body = await parseBody(req, updateSchema);
    const [updated] = await db
      .update(designations)
      .set(body)
      .where(eq(designations.id, id))
      .returning();
    if (!updated) throw new HttpError("Designation not found", 404);

    await audit({
      userId: session.userId,
      action: "DESIGNATION_UPDATE",
      resource: "designation",
      resourceId: id,
      description: `Updated designation ${updated.title}`,
    });

    return apiSuccess(updated);
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!canManageOrgStructure(session.role)) {
      throw new HttpError("Only Super Admin / HR Admin can delete designations", 403);
    }
    const id = parseId((await params).id);
    const [updated] = await db
      .update(designations)
      .set({ status: "inactive" })
      .where(eq(designations.id, id))
      .returning();
    if (!updated) throw new HttpError("Designation not found", 404);

    await audit({
      userId: session.userId,
      action: "DESIGNATION_DELETE",
      resource: "designation",
      resourceId: id,
      description: `Deactivated designation ${updated.title}`,
    });

    return apiSuccess({ deactivated: true });
  });
}
