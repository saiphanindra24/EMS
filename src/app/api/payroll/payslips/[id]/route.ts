import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payslips } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  getEmployeeForSession,
  parseId,
} from "@/lib/api";
import { FINANCE_ROLES } from "@/lib/rbac";

// GET /api/payroll/payslips/:id - view a single payslip (owner or Finance/HR/Admin).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [row] = await db.select().from(payslips).where(eq(payslips.id, id));
    if (!row) throw new HttpError("Payslip not found", 404);

    const self = await getEmployeeForSession(session);
    if (row.employeeId !== self?.id && !FINANCE_ROLES.includes(session.role)) {
      throw new HttpError("You cannot view this payslip", 403);
    }
    return apiSuccess(row);
  });
}
