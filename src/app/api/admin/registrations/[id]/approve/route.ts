import { z } from "zod";
import { db } from "@/db";
import { registrationRequests, users, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, requireRole, withErrorHandling, HttpError, audit, parseId } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { hashPassword } from "@/lib/auth";
import { HR_ROLES } from "@/lib/rbac";
import { v4 as uuidv4 } from "uuid";

const approveSchema = z.object({
  employeeCode: z.string().min(1, "Employee code is required"),
  departmentId: z.number().int().optional().nullable(),
  designationId: z.number().int().optional().nullable(),
  role: z.string().default("employee"),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
});

import { sendEmail, emailTemplates } from "@/lib/email";

// POST /api/admin/registrations/[id]/approve - approve a registration.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireRole([...HR_ROLES, "super_admin"]);
    const { id } = await params;
    const regId = parseId(id);
    const body = await parseBody(req, approveSchema);

    const [request] = await db
      .select()
      .from(registrationRequests)
      .where(eq(registrationRequests.id, regId));

    if (!request) throw new HttpError("Registration request not found", 404);
    if (request.status !== "pending") {
      throw new HttpError(`This request has already been ${request.status}`, 400);
    }

    // Check email not taken
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, request.email));
    if (existingUser) {
      throw new HttpError("A user with this email already exists", 409);
    }

    // Generate a setup token so the employee can set their own password
    const setupToken = uuidv4();
    const tempPasswordHash = await hashPassword(uuidv4()); // random unguessable temp password

    // Wrap all writes in a transaction so partial failures don't leave corrupt data
    const result = await db.transaction(async (tx) => {
      // Create user
      const [newUser] = await tx
        .insert(users)
        .values({
          email: request.email,
          passwordHash: tempPasswordHash,
          role: body.role as typeof users.role.enumValues[number],
          isActive: true,
          mustChangePassword: true,
          setupToken,
        })
        .returning();

      // Create employee record
      const [newEmployee] = await tx
        .insert(employees)
        .values({
          userId: newUser.id,
          employeeCode: body.employeeCode,
          firstName: request.firstName,
          lastName: request.lastName,
          dateOfJoining: body.dateOfJoining,
          departmentId: body.departmentId ?? null,
          designationId: body.designationId ?? null,
          phone: request.phone,
          employmentType: "full_time",
          employmentStatus: "active",
          workLocation: "onsite",
          shift: "general",
        })
        .returning();

      // Update registration request
      await tx
        .update(registrationRequests)
        .set({
          status: "approved",
          reviewedBy: session.userId,
          reviewedAt: new Date(),
          assignedEmployeeCode: body.employeeCode,
          assignedDepartmentId: body.departmentId ?? null,
          assignedDesignationId: body.designationId ?? null,
          assignedRole: body.role as typeof registrationRequests.assignedRole.enumValues[number],
          createdUserId: newUser.id,
        })
        .where(eq(registrationRequests.id, regId));

      return { newUser, newEmployee };
    });

    await audit({
      userId: session.userId,
      action: "REGISTRATION_APPROVED",
      resource: "registration",
      resourceId: regId,
      description: `Approved registration for ${request.email} as ${body.employeeCode}`,
    });

    // Auto-dispatch onboarding email invitation
    const origin = req.headers.get("origin") || req.headers.get("host") || "http://localhost:3000";
    const fullUrl = origin.startsWith("http") ? `${origin}/setup/${setupToken}` : `https://${origin}/setup/${setupToken}`;
    
    const template = emailTemplates.onboardingInvitation({
      name: `${request.firstName} ${request.lastName}`,
      setupUrl: fullUrl,
    });

    sendEmail({
      to: request.email,
      subject: template.subject,
      html: template.html,
    }).catch((err) => console.error("Background email dispatch error:", err));

    return apiSuccess({
      user: { id: result.newUser.id, email: result.newUser.email },
      employee: { id: result.newEmployee.id, employeeCode: result.newEmployee.employeeCode },
      setupToken,
      setupUrl: `/setup/${setupToken}`,
    });
  });
}
