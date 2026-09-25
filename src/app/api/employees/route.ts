import { z } from "zod";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { employees, users, departments, designations } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
} from "@/lib/api";
import { parseBody, parsePagination } from "@/lib/validate";
import {
  HR_ROLES,
  canViewAllEmployees,
  isPeopleManager,
  canViewFinancialData,
} from "@/lib/rbac";
import { ROLES } from "@/lib/rbac";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT } from "@/lib/password";

const FINANCIAL_FIELDS = ["bankAccountNumber", "bankName", "bankIfsc", "pan", "uan", "salary"] as const;

// Strip sensitive financial fields from an employee row unless the viewer is
// permitted to see them (self, HR, finance, or super admin).
function sanitizeEmployee(row: Record<string, unknown>, canSeeFinancial: boolean) {
  if (canSeeFinancial) return row;
  const clone = { ...row };
  for (const field of FINANCIAL_FIELDS) clone[field] = null;
  return clone;
}

const createEmployeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT),
  role: z.enum(ROLES).default("employee"),
  employeeCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  phone: z.string().optional().nullable(),
  personalEmail: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  profilePhotoUrl: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  emergencyContactRelation: z.string().optional().nullable(),
  dateOfJoining: z.string().min(1),
  departmentId: z.number().int().optional().nullable(),
  designationId: z.number().int().optional().nullable(),
  managerId: z.number().int().optional().nullable(),
  employmentType: z
    .enum(["full_time", "part_time", "contract", "intern", "consultant"])
    .default("full_time"),
  employmentStatus: z
    .enum(["active", "on_leave", "suspended", "terminated", "resigned"])
    .default("active"),
  workLocation: z.enum(["onsite", "remote", "hybrid"]).default("onsite"),
  shift: z.enum(["morning", "evening", "night", "general"]).default("general"),
  qualification: z.string().optional().nullable(),
  skills: z.array(z.string()).optional().default([]),
  certifications: z.array(z.string()).optional().default([]),
  previousExperience: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankIfsc: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  uan: z.string().optional().nullable(),
  salary: z.number().optional().nullable(),
});

// GET /api/employees - list employees, scoped by role.
// - HR/Admin/Auditor: full directory
// - Department Manager / Team Lead: their direct reports + department peers
// - Everyone else (Employee, Trainer, etc.): only themselves
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const { page, pageSize, offset } = parsePagination(url);
    const search = url.searchParams.get("search");
    const departmentId = url.searchParams.get("departmentId");
    const status = url.searchParams.get("status");

    const self = await getEmployeeForSession(session);
    const canSeeFinancial = canViewFinancialData(session.role);

    const filters = [];
    if (search) {
      filters.push(
        or(
          ilike(employees.firstName, `%${search}%`),
          ilike(employees.lastName, `%${search}%`),
          ilike(employees.employeeCode, `%${search}%`),
        ),
      );
    }
    if (departmentId) filters.push(eq(employees.departmentId, Number(departmentId)));
    if (status) filters.push(eq(employees.employmentStatus, status as "active"));

    if (!canViewAllEmployees(session.role)) {
      if (isPeopleManager(session.role) && self) {
        filters.push(
          or(eq(employees.managerId, self.id), eq(employees.departmentId, self.departmentId ?? -1)),
        );
      } else if (self) {
        filters.push(eq(employees.id, self.id));
      } else {
        return apiSuccess({ items: [], page, pageSize, total: 0 });
      }
    }

    const where = filters.length ? and(...filters) : undefined;

    const rows = await db
      .select({
        id: employees.id,
        employeeCode: employees.employeeCode,
        firstName: employees.firstName,
        lastName: employees.lastName,
        phone: employees.phone,
        profilePhotoUrl: employees.profilePhotoUrl,
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
        salary: employees.salary,
        bankAccountNumber: employees.bankAccountNumber,
        bankName: employees.bankName,
        bankIfsc: employees.bankIfsc,
        pan: employees.pan,
        uan: employees.uan,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .where(where)
      .orderBy(asc(employees.id))
      .limit(pageSize)
      .offset(offset);

    const sanitized = rows.map((r) => sanitizeEmployee(r, canSeeFinancial));

    return apiSuccess({ items: sanitized, page, pageSize, total: sanitized.length });
  });
}

// POST /api/employees - onboard a new employee (creates the login + profile).
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!HR_ROLES.includes(session.role)) {
      throw new HttpError("Only HR/Admin roles can create employees", 403);
    }
    const body = await parseBody(req, createEmployeeSchema);

    const existing = await db.select().from(users).where(eq(users.email, body.email.toLowerCase()));
    if (existing.length) throw new HttpError("A user with this email already exists", 409);

    const passwordHash = await hashPassword(body.password);

    const employee = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email: body.email.toLowerCase(), passwordHash, role: body.role })
        .returning();

      const [emp] = await tx
        .insert(employees)
        .values({
          userId: user.id,
          employeeCode: body.employeeCode,
          firstName: body.firstName,
          lastName: body.lastName,
          dateOfBirth: body.dateOfBirth ?? null,
          gender: body.gender ?? null,
          phone: body.phone ?? null,
          personalEmail: body.personalEmail ?? null,
          address: body.address ?? null,
          profilePhotoUrl: body.profilePhotoUrl ?? null,
          emergencyContactName: body.emergencyContactName ?? null,
          emergencyContactPhone: body.emergencyContactPhone ?? null,
          emergencyContactRelation: body.emergencyContactRelation ?? null,
          dateOfJoining: body.dateOfJoining,
          departmentId: body.departmentId ?? null,
          designationId: body.designationId ?? null,
          managerId: body.managerId ?? null,
          employmentType: body.employmentType,
          employmentStatus: body.employmentStatus,
          workLocation: body.workLocation,
          shift: body.shift,
          qualification: body.qualification ?? null,
          skills: body.skills ?? [],
          certifications: body.certifications ?? [],
          previousExperience: body.previousExperience ?? null,
          bankAccountNumber: body.bankAccountNumber ?? null,
          bankName: body.bankName ?? null,
          bankIfsc: body.bankIfsc ?? null,
          pan: body.pan ?? null,
          uan: body.uan ?? null,
          salary: body.salary != null ? String(body.salary) : null,
        })
        .returning();

      return emp;
    });

    await audit({
      userId: session.userId,
      action: "EMPLOYEE_CREATE",
      resource: "employee",
      resourceId: employee.id,
      description: `Created employee ${employee.employeeCode}`,
    });

    return apiSuccess({ employee }, 201);
  });
}
