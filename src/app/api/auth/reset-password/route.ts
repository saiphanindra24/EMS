import { z } from "zod";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiSuccess, withErrorHandling, HttpError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { MIN_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/password";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
});

// POST /api/auth/reset-password - confirm a reset token and change the user's password.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const body = await parseBody(req, resetPasswordSchema);

    const strengthError = validatePasswordStrength(body.password);
    if (strengthError) {
      throw new HttpError(strengthError, 422);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.resetPasswordToken, body.token));

    if (!user || !user.resetPasswordExpiresAt || new Date(user.resetPasswordExpiresAt).getTime() < Date.now()) {
      throw new HttpError("This password reset link is invalid or has expired.", 400);
    }

    const passwordHash = await hashPassword(body.password);

    await db
      .update(users)
      .set({
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return apiSuccess({ message: "Your password has been reset successfully." });
  });
}

export async function GET() {
  return new Response(JSON.stringify({ success: false, error: "Method not allowed. Use POST." }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
