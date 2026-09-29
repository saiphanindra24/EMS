import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";
import { apiError, apiSuccess, audit, getIp, withErrorHandling } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { HttpError } from "@/lib/api";
import { loginLimiter } from "@/lib/rate-limit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login - authenticate a user and issue a JWT session cookie.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    // Rate limiting by IP
    const ip = getIp(req) || "unknown";
    const rateCheck = loginLimiter.check(ip);
    if (!rateCheck.allowed) {
      const retryAfterSec = Math.ceil(rateCheck.retryAfterMs / 1000);
      throw new HttpError(
        `Too many login attempts. Please try again in ${retryAfterSec} seconds.`,
        429,
      );
    }

    const body = await parseBody(req, loginSchema);

    const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase()));
    if (!user || !user.isActive) {
      throw new HttpError("Invalid email or password", 401);
    }

    // Check account lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60_000);
      throw new HttpError(
        `Account is locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`,
        423,
      );
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      // Increment failed attempts
      const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const updates: Record<string, unknown> = {
        failedLoginAttempts: newAttempts,
        updatedAt: new Date(),
      };

      // Lock account if threshold reached
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await db.update(users).set(updates).where(eq(users.id, user.id));

        await audit({
          userId: user.id,
          action: "ACCOUNT_LOCKED",
          resource: "auth",
          resourceId: user.id,
          description: `Account locked after ${newAttempts} failed login attempts`,
          ipAddress: ip,
        });

        throw new HttpError(
          "Account has been locked due to too many failed attempts. Please try again in 30 minutes.",
          423,
        );
      }

      await db.update(users).set(updates).where(eq(users.id, user.id));
      throw new HttpError("Invalid email or password", 401);
    }

    // Successful login — reset failed attempts and clear lockout
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

    await db.update(users).set({
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    // Reset rate limiter for this IP on successful login
    loginLimiter.reset(ip);

    await audit({
      userId: user.id,
      action: "LOGIN",
      resource: "auth",
      resourceId: user.id,
      description: `${user.email} logged in`,
      ipAddress: ip,
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
