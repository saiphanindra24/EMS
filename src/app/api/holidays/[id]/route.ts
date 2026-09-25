import { eq } from "drizzle-orm";
import { db } from "@/db";
import { holidays } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit, parseId } from "@/lib/api";
import { HR_ROLES } from "@/lib/rbac";

// DELETE /api/holidays/:id - remove a holiday (HR/Admin only).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!HR_ROLES.includes(session.role)) {
      throw new HttpError("Only HR/Admin can manage the holiday calendar", 403);
    }
    const id = parseId((await params).id);
    const [deleted] = await db.delete(holidays).where(eq(holidays.id, id)).returning();
    if (!deleted) throw new HttpError("Holiday not found", 404);

    await audit({
      userId: session.userId,
      action: "HOLIDAY_DELETE",
      resource: "holiday",
      resourceId: id,
      description: `Removed holiday ${deleted.name}`,
    });

    return apiSuccess({ deleted: true });
  });
}
