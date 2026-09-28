import { z } from "zod";
import { db } from "@/db";
import { registrationRequests, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, withErrorHandling, HttpError } from "@/lib/api";
import { parseBody } from "@/lib/validate";

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().max(20).optional(),
});

// POST /api/auth/register - submit a new employee registration request.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const body = await parseBody(req, registerSchema);
    const emailLower = body.email.toLowerCase().trim();

    // Check if a user with this email already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, emailLower));
    if (existingUser) {
      throw new HttpError("An account with this email already exists. Please log in.", 409);
    }

    // Check if a pending request already exists for this email
    const [existingReq] = await db
      .select()
      .from(registrationRequests)
      .where(eq(registrationRequests.email, emailLower));
    if (existingReq && existingReq.status === "pending") {
      throw new HttpError(
        "A registration request for this email is already pending approval.",
        409,
      );
    }
    if (existingReq && existingReq.status === "approved") {
      throw new HttpError(
        "This email has already been approved. Please check your setup link or contact HR.",
        409,
      );
    }

    // If previously rejected, allow re-registration by updating
    if (existingReq && existingReq.status === "rejected") {
      const [updated] = await db
        .update(registrationRequests)
        .set({
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          phone: body.phone?.trim() || null,
          status: "pending",
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
          createdAt: new Date(),
        })
        .where(eq(registrationRequests.id, existingReq.id))
        .returning();
      return apiSuccess({ id: updated.id, message: "Registration request re-submitted successfully." }, 201);
    }

    const [request] = await db
      .insert(registrationRequests)
      .values({
        email: emailLower,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        phone: body.phone?.trim() || null,
      })
      .returning();

    return apiSuccess(
      { id: request.id, message: "Registration request submitted successfully. An admin will review your request." },
      201,
    );
  });
}
