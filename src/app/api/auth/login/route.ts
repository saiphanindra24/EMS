import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";
import { apiError, apiSuccess, audit, getIp, withErrorHandling } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { HttpError } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login - authenticate a user and issue a JWT session cookie.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const body = await parseBody(req, loginSchema);

    const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase()));
    if (!user || !user.isActive) {
      throw new HttpError("Invalid email or password", 401);
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      throw new HttpError("Invalid email or password", 401);
    }

    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.userId, user.id));

    const token = await signToken({
      userId: user.id,
      employeeId: employee?.id ?? null,
      email: user.email,
      role: user.role,
    });
    await setAuthCookie(token);

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await audit({
      userId: user.id,
      action: "LOGIN",
      resource: "auth",
      resourceId: user.id,
      description: `${user.email} logged in`,
      ipAddress: getIp(req),
    });

    return apiSuccess({
      user: { id: user.id, email: user.email, role: user.role },
      employee: employee ?? null,
    });
  });
}

export async function GET() {
  return apiError("Method not allowed. Use POST.", 405);
}

void NextResponse;
