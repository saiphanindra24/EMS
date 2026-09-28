import { z } from "zod";
import { db } from "@/db";
import { registrationRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, requireRole, withErrorHandling, HttpError, audit, parseId } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { HR_ROLES } from "@/lib/rbac";

const rejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required").max(500),
});

// POST /api/admin/registrations/[id]/reject - reject a registration.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireRole([...HR_ROLES, "super_admin"]);
    const { id } = await params;
    const regId = parseId(id);
    const body = await parseBody(req, rejectSchema);

    const [request] = await db
      .select()
      .from(registrationRequests)
      .where(eq(registrationRequests.id, regId));

    if (!request) throw new HttpError("Registration request not found", 404);
    if (request.status !== "pending") {
      throw new HttpError(`This request has already been ${request.status}`, 400);
    }

    await db
      .update(registrationRequests)
      .set({
        status: "rejected",
        reviewedBy: session.userId,
        reviewedAt: new Date(),
        rejectionReason: body.reason,
      })
      .where(eq(registrationRequests.id, regId));

    await audit({
      userId: session.userId,
      action: "REGISTRATION_REJECTED",
      resource: "registration",
      resourceId: regId,
      description: `Rejected registration for ${request.email}: ${body.reason}`,
    });

    return apiSuccess({ message: "Registration request rejected." });
  });
}
