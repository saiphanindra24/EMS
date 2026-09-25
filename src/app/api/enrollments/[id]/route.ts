import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { enrollments, employees } from "@/db/schema";
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
import { isTrainingAdmin } from "@/lib/rbac";

const updateSchema = z.object({
  status: z.enum(["enrolled", "in_progress", "completed", "failed", "cancelled"]).optional(),
  progress: z.number().min(0).max(100).optional(),
});

// PATCH /api/enrollments/:id - update progress/status (owner can update own progress;
// trainer/training admin can set completion/failed status).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, id));
    if (!enrollment) throw new HttpError("Enrollment not found", 404);

    const self = await getEmployeeForSession(session);
    const isOwner = self?.id === enrollment.employeeId;
    const isPrivileged = isTrainingAdmin(session.role) || session.role === "trainer";
    if (!isOwner && !isPrivileged) throw new HttpError("You cannot update this enrollment", 403);

    const body = await parseBody(req, updateSchema);
    if (body.status && !isPrivileged && body.status !== "cancelled") {
      throw new HttpError("Only trainers/training admin can set that status", 403);
    }

    const updates: Record<string, unknown> = { ...body };
    if (body.status === "completed") updates.completionDate = new Date();

    const [updated] = await db.update(enrollments).set(updates).where(eq(enrollments.id, id)).returning();

    await audit({
      userId: session.userId,
      action: "ENROLLMENT_UPDATE",
      resource: "enrollment",
      resourceId: id,
      description: `Updated enrollment status/progress`,
    });

    return apiSuccess(updated);
  });
}

void employees;
