import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { HR_ROLES } from "@/lib/rbac";

const createSchema = z.object({
  userIds: z.array(z.number().int()).optional(),
  broadcastToAll: z.boolean().default(false),
  type: z
    .enum(["leave", "training", "assessment", "certificate", "attendance", "announcement", "payroll", "general"])
    .default("announcement"),
  title: z.string().min(1),
  message: z.string().min(1),
});

// GET /api/notifications?unreadOnly= - the current user's own notifications.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const filters = [eq(notifications.userId, session.userId)];
    if (unreadOnly) filters.push(eq(notifications.isRead, false));

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...filters))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return apiSuccess(rows);
  });
}

// POST /api/notifications - HR/Admin broadcasts an announcement to selected users or everyone.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!HR_ROLES.includes(session.role)) {
      throw new HttpError("Only HR/Admin can send announcements", 403);
    }
    const body = await parseBody(req, createSchema);

    let targetUserIds = body.userIds ?? [];
    if (body.broadcastToAll) {
      const all = await db.select({ id: users.id }).from(users).where(eq(users.isActive, true));
      targetUserIds = all.map((u) => u.id);
    }
    if (!targetUserIds.length) throw new HttpError("No recipients specified", 400);

    const rows = await db
      .insert(notifications)
      .values(
        targetUserIds.map((userId) => ({
          userId,
          type: body.type,
          title: body.title,
          message: body.message,
        })),
      )
      .returning();

    await audit({
      userId: session.userId,
      action: "NOTIFICATION_BROADCAST",
      resource: "notification",
      description: `Sent "${body.title}" to ${targetUserIds.length} user(s)`,
    });

    return apiSuccess(rows, 201);
  });
}
