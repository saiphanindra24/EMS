import { db } from "@/db";
import { registrationRequests, departments, designations } from "@/db/schema";
import { desc } from "drizzle-orm";
import { apiSuccess, requireRole, withErrorHandling } from "@/lib/api";
import { HR_ROLES } from "@/lib/rbac";

// GET /api/admin/registrations - list all registration requests (admin only).
export async function GET() {
  return withErrorHandling(async () => {
    await requireRole([...HR_ROLES, "super_admin"]);

    const rows = await db
      .select()
      .from(registrationRequests)
      .orderBy(desc(registrationRequests.createdAt));

    // Also return departments/designations for the approval form
    const depts = await db.select().from(departments);
    const desigs = await db.select().from(designations);

    return apiSuccess({ requests: rows, departments: depts, designations: desigs });
  });
}
