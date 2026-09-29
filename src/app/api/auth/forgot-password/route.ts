import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiSuccess, withErrorHandling, HttpError } from "@/lib/api";
import { sendEmail, emailTemplates } from "@/lib/email";
import { parseBody } from "@/lib/validate";
import { v4 as uuidv4 } from "uuid";

const forgotPasswordSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
});

// POST /api/auth/forgot-password - send a password reset email if the account exists.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const body = await parseBody(req, forgotPasswordSchema);

    const [user] = await db.select().from(users).where(eq(users.email, body.email));

    if (!user || !user.isActive) {
      return apiSuccess({
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db
      .update(users)
      .set({
        resetPasswordToken: token,
        resetPasswordExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = origin.startsWith("http")
      ? `${origin}/reset-password/${token}`
      : `https://${origin}/reset-password/${token}`;

    const displayName = user.email.split("@")[0] || "there";
    const { success } = await sendEmail({
      to: user.email,
      subject: emailTemplates.passwordReset({ name: displayName, resetUrl }).subject,
      html: emailTemplates.passwordReset({ name: displayName, resetUrl }).html,
    });

    if (!success) {
      throw new HttpError("Unable to send password reset email right now. Please try again later.", 500);
    }

    return apiSuccess({
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  });
}

export async function GET() {
  return new Response(JSON.stringify({ success: false, error: "Method not allowed. Use POST." }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
