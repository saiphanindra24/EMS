import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT } from "@/lib/password";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT),
});

// POST /api/auth/change-password - self-service password change.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const body = await parseBody(req, schema);

    const [user] = await db.select().from(users).where(eq(users.id, session.userId));
    if (!user) throw new HttpError("User not found", 404);

    const valid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!valid) throw new HttpError("Current password is incorrect", 400);

    const passwordHash = await hashPassword(body.newPassword);
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await audit({
      userId: user.id,
      action: "PASSWORD_CHANGE",
      resource: "auth",
      resourceId: user.id,
      description: "User changed their password",
    });

    return apiSuccess({ changed: true });
  });
}
