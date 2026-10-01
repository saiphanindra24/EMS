import { db } from "@/db";
import { employees, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit, parseId } from "@/lib/api";
import { HR_ROLES } from "@/lib/rbac";
import { v4 as uuidv4 } from "uuid";
import { sendEmail, emailTemplates } from "@/lib/email";

// POST /api/employees/:id/resend-invitation
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();

    // Only HR/Admin can resend invitations
    if (!HR_ROLES.includes(session.role)) {
      throw new HttpError("Only HR/Admin roles can resend invitations", 403);
    }

    const employeeId = parseId((await params).id);

    // 1. Get the employee and their user record
    const [employee] = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        userId: employees.userId,
      })
      .from(employees)
      .where(eq(employees.id, employeeId));

    if (!employee || !employee.userId) {
      throw new HttpError("Employee or associated user not found", 404);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, employee.userId));

    if (!user) {
      throw new HttpError("User record not found", 404);
    }

    // 2. Generate a new setup token
    const setupToken = uuidv4();

    await db
      .update(users)
      .set({
        setupToken,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await audit({
      userId: session.userId,
      action: "RESEND_INVITATION",
      resource: "employee",
      resourceId: employee.id,
      description: `Resent onboarding invitation to ${user.email}`,
    });

    // 3. Send the email
    const origin = req.headers.get("origin") || req.headers.get("host") || "http://localhost:3000";
    const fullUrl = origin.startsWith("http") ? `${origin}/setup/${setupToken}` : `https://${origin}/setup/${setupToken}`;

    const template = emailTemplates.onboardingInvitation({
      name: `${employee.firstName} ${employee.lastName}`,
      setupUrl: fullUrl,
    });

    const { success, error } = await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
    });

    if (!success) {
      throw new HttpError(error || "Failed to send email", 500);
    }

    return apiSuccess({ message: "Invitation resent successfully" });
  });
}
