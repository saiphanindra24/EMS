import { z } from "zod";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  payrollRuns,
  payslips,
  salaryStructures,
  employees,
  attendanceRecords,
  leaveRequests,
} from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { FINANCE_ROLES } from "@/lib/rbac";

const runSchema = z.object({ month: z.number().int().min(1).max(12), year: z.number().int().min(2000) });

// GET /api/payroll/run - list all payroll runs.
export async function GET() {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!FINANCE_ROLES.includes(session.role)) {
      throw new HttpError("Only Finance/HR/Admin can view payroll runs", 403);
    }
    const rows = await db.select().from(payrollRuns).orderBy(payrollRuns.year, payrollRuns.month);
    return apiSuccess(rows);
  });
}

// POST /api/payroll/run - process payroll for every active employee with a
// salary structure for the given month/year, generating payslips.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!FINANCE_ROLES.includes(session.role)) {
      throw new HttpError("Only Finance/HR/Admin can process payroll", 403);
    }
    const body = await parseBody(req, runSchema);

    const existingRun = await db
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.month, body.month), eq(payrollRuns.year, body.year)));
    if (existingRun.length) throw new HttpError("Payroll for this month/year is already processed", 409);

    const monthStart = `${body.year}-${String(body.month).padStart(2, "0")}-01`;
    const lastDay = new Date(body.year, body.month, 0).getDate();
    const monthEnd = `${body.year}-${String(body.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const structures = await db
      .select()
      .from(salaryStructures)
      .innerJoin(employees, eq(salaryStructures.employeeId, employees.id))
      .where(eq(employees.employmentStatus, "active"));

    const [run] = await db
      .insert(payrollRuns)
      .values({ month: body.month, year: body.year, status: "processed", processedBy: session.userId, processedAt: new Date() })
      .returning();

    const generated = [];
    for (const { salary_structures: structure, employees: employee } of structures) {
      const allowances =
        Number(structure.hra) +
        Number(structure.conveyance) +
        Number(structure.medicalAllowance) +
        Number(structure.specialAllowance) +
        Number(structure.otherAllowances);
      const deductions =
        Number(structure.providentFund) + Number(structure.professionalTax) + Number(structure.incomeTax) + Number(structure.otherDeductions);
      const gross = Number(structure.basic) + allowances;

      const lopRequests = await db
        .select()
        .from(leaveRequests)
        .where(
          and(
            eq(leaveRequests.employeeId, employee.id),
            eq(leaveRequests.status, "approved"),
            gte(leaveRequests.startDate, monthStart),
            lte(leaveRequests.endDate, monthEnd),
          ),
        );
      const lopDays = lopRequests.reduce((sum, r) => sum + Number(r.days), 0);

      const attendanceRows = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.employeeId, employee.id),
            gte(attendanceRecords.date, monthStart),
            lte(attendanceRecords.date, monthEnd),
          ),
        );
      const presentDays = attendanceRows.filter((a) => a.status === "present" || a.status === "late" || a.status === "work_from_home").length;

      const perDayGross = gross / lastDay;
      const lopDeduction = perDayGross * lopDays;
      const netSalary = Math.max(0, gross - deductions - lopDeduction);

      const [slip] = await db
        .insert(payslips)
        .values({
          payrollRunId: run.id,
          employeeId: employee.id,
          basic: structure.basic,
          allowances: String(allowances),
          deductions: String(deductions + lopDeduction),
          bonus: "0",
          grossSalary: String(gross),
          netSalary: String(netSalary),
          workingDays: lastDay,
          presentDays: String(presentDays),
          lopDays: String(lopDays),
          status: "processed",
        })
        .returning();
      generated.push(slip);
    }

    await audit({
      userId: session.userId,
      action: "PAYROLL_RUN",
      resource: "payroll_run",
      resourceId: run.id,
      description: `Processed payroll for ${body.month}/${body.year} (${generated.length} payslips)`,
    });

    return apiSuccess({ run, payslips: generated }, 201);
  });
}
