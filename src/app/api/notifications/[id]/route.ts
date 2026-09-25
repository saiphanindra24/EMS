import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, parseId } from "@/lib/api";
import { parseBody } from "@/lib/validate";

const updateSchema = z.object({ isRead: z.boolean() });

// PATCH /api/notifications/:id - mark a notification read/unread (owner only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [existing] = await db.select().from(notifications).where(eq(notifications.id, id));
    if (!existing) throw new HttpError("Notification not found", 404);
    if (existing.userId !== session.userId) throw new HttpError("You cannot update this notification", 403);

    const body = await parseBody(req, updateSchema);
    const [updated] = await db
      .update(notifications)
      .set({ isRead: body.isRead })
      .where(eq(notifications.id, id))
      .returning();
    return apiSuccess(updated);
  });
}
