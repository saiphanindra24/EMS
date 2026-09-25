import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { apiSuccess, requireRole, withErrorHandling } from "@/lib/api";
import { eq } from "drizzle-orm";
import { parsePagination } from "@/lib/validate";

// GET /api/audit-logs - system-wide audit trail (Super Admin / Auditor only).
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    await requireRole(["super_admin", "auditor"]);
    const url = new URL(req.url);
    const { page, pageSize, offset } = parsePagination(url);

    const rows = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: users.email,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        description: auditLogs.description,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    return apiSuccess({ items: rows, page, pageSize });
  });
}
