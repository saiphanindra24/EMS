import { db } from "@/db";
import { employees, users, departments, designations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { apiSuccess, withErrorHandling } from "@/lib/api";

// GET /api/auth/me - return the currently authenticated user + employee profile.
export async function GET() {
  return withErrorHandling(async () => {
    const session = await getSession();
    if (!session) {
      return apiSuccess({ user: null, employee: null }, 200);
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId));
    if (!user) {
      return apiSuccess({ user: null, employee: null });
    }

    const [employee] = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        profilePhotoUrl: employees.profilePhotoUrl,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        designationId: employees.designationId,
        designationTitle: designations.title,
        managerId: employees.managerId,
        employmentStatus: employees.employmentStatus,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .where(eq(employees.userId, user.id));

    return apiSuccess({
      user: { id: user.id, email: user.email, role: user.role, isActive: user.isActive },
      employee: employee ?? null,
    });
  });
}
