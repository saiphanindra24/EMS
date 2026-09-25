import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { salaryStructures } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
} from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { FINANCE_ROLES } from "@/lib/rbac";

const upsertSchema = z.object({
  employeeId: z.number().int(),
  basic: z.number().min(0),
  hra: z.number().min(0).default(0),
  conveyance: z.number().min(0).default(0),
  medicalAllowance: z.number().min(0).default(0),
  specialAllowance: z.number().min(0).default(0),
  otherAllowances: z.number().min(0).default(0),
  providentFund: z.number().min(0).default(0),
  professionalTax: z.number().min(0).default(0),
  incomeTax: z.number().min(0).default(0),
  otherDeductions: z.number().min(0).default(0),
  effectiveFrom: z.string().min(1),
});

// GET /api/payroll/structures?employeeId= - view a salary structure.
// Restricted to Finance/HR/Admin roles, or the employee viewing their own.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const employeeIdParam = url.searchParams.get("employeeId");
    const self = await getEmployeeForSession(session);

    let employeeId = self?.id ?? null;
    if (employeeIdParam) {
      const requested = Number(employeeIdParam);
      if (requested !== self?.id && !FINANCE_ROLES.includes(session.role)) {
        throw new HttpError("Only Finance/HR/Admin can view others' salary structures", 403);
      }
      employeeId = requested;
    }
    if (!employeeId) return apiSuccess(null);

    const [row] = await db.select().from(salaryStructures).where(eq(salaryStructures.employeeId, employeeId));
    return apiSuccess(row ?? null);
  });
}

// POST /api/payroll/structures - create/update an employee's salary structure.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!FINANCE_ROLES.includes(session.role)) {
      throw new HttpError("Only Finance/HR/Admin can manage salary structures", 403);
    }
    const body = await parseBody(req, upsertSchema);
    const values = {
      employeeId: body.employeeId,
      basic: String(body.basic),
      hra: String(body.hra),
      conveyance: String(body.conveyance),
      medicalAllowance: String(body.medicalAllowance),
      specialAllowance: String(body.specialAllowance),
      otherAllowances: String(body.otherAllowances),
      providentFund: String(body.providentFund),
      professionalTax: String(body.professionalTax),
      incomeTax: String(body.incomeTax),
      otherDeductions: String(body.otherDeductions),
      effectiveFrom: body.effectiveFrom,
      updatedAt: new Date(),
    };

    const [row] = await db
      .insert(salaryStructures)
      .values(values)
      .onConflictDoUpdate({ target: salaryStructures.employeeId, set: values })
      .returning();

    await audit({
      userId: session.userId,
      action: "SALARY_STRUCTURE_UPSERT",
      resource: "salary_structure",
      resourceId: row.id,
      description: `Updated salary structure for employee ${body.employeeId}`,
    });

    return apiSuccess(row, 201);
  });
}
