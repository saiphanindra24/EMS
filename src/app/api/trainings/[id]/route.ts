import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trainings, employees } from "@/db/schema";
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
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  trainerId: z.number().int().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  durationHours: z.number().min(0).optional(),
  maxParticipants: z.number().int().min(1).optional(),
  status: z.enum(["draft", "scheduled", "ongoing", "completed", "cancelled"]).optional(),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

// GET /api/trainings/:id - view a training's details.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    await requireAuth();
    const id = parseId((await params).id);
    const [row] = await db
      .select({
        id: trainings.id,
        title: trainings.title,
        description: trainings.description,
        category: trainings.category,
        trainerId: trainings.trainerId,
        trainerFirstName: employees.firstName,
        trainerLastName: employees.lastName,
        startDate: trainings.startDate,
        endDate: trainings.endDate,
        durationHours: trainings.durationHours,
        trainingType: trainings.trainingType,
        skillLevel: trainings.skillLevel,
        maxParticipants: trainings.maxParticipants,
        status: trainings.status,
      })
      .from(trainings)
      .leftJoin(employees, eq(trainings.trainerId, employees.id))
      .where(eq(trainings.id, id));
    if (!row) throw new HttpError("Training not found", 404);
    return apiSuccess(row);
  });
}

// PATCH /api/trainings/:id - update a training (Training Admin, or its assigned Trainer).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [training] = await db.select().from(trainings).where(eq(trainings.id, id));
    if (!training) throw new HttpError("Training not found", 404);

    const self = await getEmployeeForSession(session);
    const isAssignedTrainer = session.role === "trainer" && self?.id === training.trainerId;
    if (!isTrainingAdmin(session.role) && !isAssignedTrainer) {
      throw new HttpError("You cannot update this training", 403);
    }

    const body = await parseBody(req, updateSchema);
    const updates: Record<string, unknown> = { ...body };
    if (body.durationHours != null) updates.durationHours = String(body.durationHours);

    const [updated] = await db.update(trainings).set(updates).where(eq(trainings.id, id)).returning();

    await audit({
      userId: session.userId,
      action: "TRAINING_UPDATE",
      resource: "training",
      resourceId: id,
      description: `Updated training "${updated.title}"`,
    });

    return apiSuccess(updated);
  });
}

// DELETE /api/trainings/:id - cancel a training (Training Admin / Super Admin only).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!isTrainingAdmin(session.role)) {
      throw new HttpError("Only Training Admin / Super Admin can cancel trainings", 403);
    }
    const id = parseId((await params).id);
    const [updated] = await db
      .update(trainings)
      .set({ status: "cancelled" })
      .where(eq(trainings.id, id))
      .returning();
    if (!updated) throw new HttpError("Training not found", 404);

    await audit({
      userId: session.userId,
      action: "TRAINING_CANCEL",
      resource: "training",
      resourceId: id,
      description: `Cancelled training "${updated.title}"`,
    });

    return apiSuccess({ cancelled: true });
  });
}
