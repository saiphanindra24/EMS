import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, users, departments, designations } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
  parseId,
} from "@/lib/api";
import { parseBody } from "@/lib/validate";
import {
  HR_ROLES,
  FINANCE_ROLES,
  canViewAllEmployees,
  canViewFinancialData,
  isPeopleManager,
  ROLES,
} from "@/lib/rbac";

const FINANCIAL_FIELDS = ["bankAccountNumber", "bankName", "bankIfsc", "pan", "uan", "salary"] as const;

function sanitize(row: Record<string, unknown>, canSeeFinancial: boolean) {
  if (canSeeFinancial) return row;
  const clone = { ...row };
  for (const field of FINANCIAL_FIELDS) clone[field] = null;
  return clone;
}

async function loadEmployee(id: number) {
  const [row] = await db
    .select({
      id: employees.id,
      userId: employees.userId,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      dateOfBirth: employees.dateOfBirth,
      gender: employees.gender,
      phone: employees.phone,
      personalEmail: employees.personalEmail,
      address: employees.address,
      profilePhotoUrl: employees.profilePhotoUrl,
      emergencyContactName: employees.emergencyContactName,
      emergencyContactPhone: employees.emergencyContactPhone,
      emergencyContactRelation: employees.emergencyContactRelation,
      dateOfJoining: employees.dateOfJoining,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      designationId: employees.designationId,
      designationTitle: designations.title,
      managerId: employees.managerId,
      employmentType: employees.employmentType,
      employmentStatus: employees.employmentStatus,
      workLocation: employees.workLocation,
      shift: employees.shift,
      qualification: employees.qualification,
      skills: employees.skills,
      certifications: employees.certifications,
      previousExperience: employees.previousExperience,
      bankAccountNumber: employees.bankAccountNumber,
      bankName: employees.bankName,
      bankIfsc: employees.bankIfsc,
      pan: employees.pan,
      uan: employees.uan,
      salary: employees.salary,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(designations, eq(employees.designationId, designations.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(eq(employees.id, id));
  return row ?? null;
}

async function canAccess(session: Awaited<ReturnType<typeof requireAuth>>, target: { id: number; managerId: number | null; departmentId: number | null }) {
  if (canViewAllEmployees(session.role)) return true;
  const self = await getEmployeeForSession(session);
  if (!self) return false;
  if (self.id === target.id) return true;
  if (isPeopleManager(session.role)) {
    return target.managerId === self.id || (target.departmentId != null && target.departmentId === self.departmentId);
  }
  return false;
}

// GET /api/employees/:id - view a single employee profile (ownership/role scoped).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const employee = await loadEmployee(id);
    if (!employee) throw new HttpError("Employee not found", 404);

    const allowed = await canAccess(session, employee);
    if (!allowed) throw new HttpError("You cannot view this employee's profile", 403);

    const canSeeFinancial =
      canViewFinancialData(session.role) || (await getEmployeeForSession(session))?.id === employee.id;

    return apiSuccess(sanitize(employee, canSeeFinancial));
  });
}

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  phone: z.string().optional().nullable(),
  personalEmail: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  profilePhotoUrl: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  emergencyContactRelation: z.string().optional().nullable(),
  departmentId: z.number().int().optional().nullable(),
  designationId: z.number().int().optional().nullable(),
  managerId: z.number().int().optional().nullable(),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern", "consultant"]).optional(),
  employmentStatus: z
    .enum(["active", "on_leave", "suspended", "terminated", "resigned"])
    .optional(),
  workLocation: z.enum(["onsite", "remote", "hybrid"]).optional(),
  shift: z.enum(["morning", "evening", "night", "general"]).optional(),
  qualification: z.string().optional().nullable(),
  skills: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  previousExperience: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankIfsc: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  uan: z.string().optional().nullable(),
  salary: z.number().optional().nullable(),
  role: z.enum(ROLES).optional(),
});

const SELF_EDITABLE_FIELDS = [
  "phone",
  "personalEmail",
  "address",
  "profilePhotoUrl",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelation",
  "qualification",
  "skills",
  "certifications",
] as const;

// PATCH /api/employees/:id - update an employee profile. Field-level rules:
// - HR/Admin: everything except role (see below)
// - Super Admin / HR Admin: may also change `role`
// - Finance roles: financial fields
// - The employee themself: limited personal-info fields only
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const employee = await loadEmployee(id);
    if (!employee) throw new HttpError("Employee not found", 404);

    const body = await parseBody(req, updateSchema);
    const self = await getEmployeeForSession(session);
    const isSelf = self?.id === employee.id;
    const isHr = HR_ROLES.includes(session.role);
    const isFinance = FINANCE_ROLES.includes(session.role);

    if (!isHr && !isSelf) throw new HttpError("You cannot update this employee", 403);

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      const isFinancialField = (FINANCIAL_FIELDS as readonly string[]).includes(key);
      const isSelfEditable = (SELF_EDITABLE_FIELDS as readonly string[]).includes(key);
      if (key === "role") {
        if (!HR_ROLES.includes(session.role)) continue;
      } else if (isFinancialField) {
        if (!isFinance && !isHr) continue;
      } else if (!isHr && !isSelfEditable) {
        continue; // self can only touch the whitelisted fields
      }
      updates[key] = key === "salary" && value != null ? String(value) : value;
    }

    if (Object.keys(updates).length === 0) {
      throw new HttpError("No permitted fields supplied for update", 400);
    }

    const { role, ...employeeUpdates } = updates;
    if (Object.keys(employeeUpdates).length > 0) {
      await db
        .update(employees)
        .set({ ...employeeUpdates, updatedAt: new Date() })
        .where(eq(employees.id, id));
    }
    if (role && employee.userId) {
      await db.update(users).set({ role: role as (typeof ROLES)[number] }).where(eq(users.id, employee.userId));
    }

    await audit({
      userId: session.userId,
      action: "EMPLOYEE_UPDATE",
      resource: "employee",
      resourceId: id,
      description: `Updated fields: ${Object.keys(updates).join(", ")}`,
    });

    const updated = await loadEmployee(id);
    return apiSuccess(updated);
  });
}

// DELETE /api/employees/:id - soft-delete: mark terminated + disable login.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!HR_ROLES.includes(session.role)) {
      throw new HttpError("Only HR/Admin roles can remove an employee", 403);
    }
    const id = parseId((await params).id);
    const employee = await loadEmployee(id);
    if (!employee) throw new HttpError("Employee not found", 404);

    await db
      .update(employees)
      .set({ employmentStatus: "terminated", updatedAt: new Date() })
      .where(eq(employees.id, id));
    if (employee.userId) {
      await db.update(users).set({ isActive: false }).where(eq(users.id, employee.userId));
    }

    await audit({
      userId: session.userId,
      action: "EMPLOYEE_DEACTIVATE",
      resource: "employee",
      resourceId: id,
      description: `Deactivated employee ${employee.employeeCode}`,
    });

    return apiSuccess({ deactivated: true });
  });
}
