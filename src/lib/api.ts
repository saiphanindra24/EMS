import { NextResponse } from "next/server";
import { getSession, type AuthTokenPayload } from "./auth";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Role } from "./rbac";

/** Standard error envelope used by every API route in this project. */
export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status });
}

/** Standard success envelope used by every API route in this project. */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Require a logged-in user. Throws HttpError(401) if not authenticated. */
export async function requireAuth(): Promise<AuthTokenPayload> {
  const session = await getSession();
  if (!session) {
    throw new HttpError("Authentication required", 401);
  }
  return session;
}

/** Require a logged-in user whose role is in the allowed list. */
export async function requireRole(allowed: Role[]): Promise<AuthTokenPayload> {
  const session = await requireAuth();
  if (!allowed.includes(session.role)) {
    throw new HttpError("You do not have permission to perform this action", 403);
  }
  return session;
}

/** Resolve the employee profile row belonging to the current session user. */
export async function getEmployeeForSession(session: AuthTokenPayload) {
  const [row] = await db.select().from(employees).where(eq(employees.userId, session.userId));
  return row ?? null;
}

/** Wrap a route handler body so thrown HttpErrors become proper JSON responses. */
export async function withErrorHandling(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) {
      return apiError(err.message, err.status, err.details);
    }
    console.error(err);
    return apiError("Internal server error", 500);
  }
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError("Invalid id parameter", 400);
  }
  return id;
}

/** Record an audit log entry. Never throws - audit failures must not break requests. */
export async function audit(params: {
  userId?: number | null;
  action: string;
  resource: string;
  resourceId?: string | number | null;
  description?: string;
  ipAddress?: string | null;
}) {
  try {
    const { auditLogs } = await import("@/db/schema");
    await db.insert(auditLogs).values({
      userId: params.userId ?? null,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId != null ? String(params.resourceId) : null,
      description: params.description,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}

export function getIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}
