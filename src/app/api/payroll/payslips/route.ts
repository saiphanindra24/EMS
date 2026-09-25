import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payslips } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  getEmployeeForSession,
} from "@/lib/api";
import { FINANCE_ROLES } from "@/lib/rbac";

// GET /api/payroll/payslips?employeeId=&runId= - list payslips.
// Employees see only their own; Finance/HR/Admin can view anyone's.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const employeeIdParam = url.searchParams.get("employeeId");
    const runId = url.searchParams.get("runId");
    const self = await getEmployeeForSession(session);

    const filters = [];
    if (runId) filters.push(eq(payslips.payrollRunId, Number(runId)));

    if (FINANCE_ROLES.includes(session.role)) {
      if (employeeIdParam) filters.push(eq(payslips.employeeId, Number(employeeIdParam)));
    } else if (self) {
      filters.push(eq(payslips.employeeId, self.id));
    } else {
      throw new HttpError("No employee profile linked to this account", 400);
    }

    const rows = await db.select().from(payslips).where(and(...filters)).orderBy(payslips.generatedAt);
    return apiSuccess(rows);
  });
}
