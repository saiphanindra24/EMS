import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trainingMaterials, trainings } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
  parseId,
} from "@/lib/api";
import { saveUploadedFile } from "@/lib/upload";
import { isTrainingAdmin } from "@/lib/rbac";

// GET /api/trainings/:id/materials - list materials for a training (enrolled/anyone authenticated).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    await requireAuth();
    const id = parseId((await params).id);
    const rows = await db
      .select()
      .from(trainingMaterials)
      .where(eq(trainingMaterials.trainingId, id))
      .orderBy(trainingMaterials.uploadedAt);
    return apiSuccess(rows);
  });
}

// POST /api/trainings/:id/materials - upload training material (Training Admin or assigned Trainer).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [training] = await db.select().from(trainings).where(eq(trainings.id, id));
    if (!training) throw new HttpError("Training not found", 404);

    const self = await getEmployeeForSession(session);
    const isAssignedTrainer = session.role === "trainer" && self?.id === training.trainerId;
    if (!isTrainingAdmin(session.role) && !isAssignedTrainer) {
      throw new HttpError("Only the assigned trainer or training admin can upload materials", 403);
    }

    const form = await req.formData();
    const file = form.get("file");
    const title = String(form.get("title") ?? "");
    if (!(file instanceof File)) throw new HttpError("A file is required", 400);
    if (!title) throw new HttpError("Title is required", 400);

    const meta = await saveUploadedFile(file, "training-materials");
    const [row] = await db
      .insert(trainingMaterials)
      .values({
        trainingId: id,
        title,
        fileUrl: meta.fileUrl,
        fileType: meta.mimeType,
        uploadedBy: session.userId,
      })
      .returning();

    await audit({
      userId: session.userId,
      action: "TRAINING_MATERIAL_UPLOAD",
      resource: "training_material",
      resourceId: row.id,
      description: `Uploaded material "${title}" for training ${id}`,
    });

    return apiSuccess(row, 201);
  });
}
