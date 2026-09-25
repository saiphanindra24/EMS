import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { trainingAttendance, trainings } from "@/db/schema";
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

const markSchema = z.object({
  date: z.string().min(1),
  records: z.array(z.object({ employeeId: z.number().int(), present: z.boolean() })).min(1),
});

// GET /api/trainings/:id/attendance - list session attendance for a training.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    await requireAuth();
    const id = parseId((await params).id);
    const rows = await db.select().from(trainingAttendance).where(eq(trainingAttendance.trainingId, id));
    return apiSuccess(rows);
  });
}

// POST /api/trainings/:id/attendance - trainer/training admin marks attendance for a session date.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [training] = await db.select().from(trainings).where(eq(trainings.id, id));
    if (!training) throw new HttpError("Training not found", 404);

    const self = await getEmployeeForSession(session);
    const isAssignedTrainer = session.role === "trainer" && self?.id === training.trainerId;
    if (!isTrainingAdmin(session.role) && !isAssignedTrainer) {
      throw new HttpError("Only the assigned trainer or training admin can mark attendance", 403);
    }

    const body = await parseBody(req, markSchema);
    const rows = await db
      .insert(trainingAttendance)
      .values(
        body.records.map((r) => ({
          trainingId: id,
          employeeId: r.employeeId,
          date: body.date,
          present: r.present,
          markedBy: session.userId,
        })),
      )
      .onConflictDoUpdate({
        target: [trainingAttendance.trainingId, trainingAttendance.employeeId, trainingAttendance.date],
        set: { present: sql`excluded.present` },
      })
      .returning();

    await audit({
      userId: session.userId,
      action: "TRAINING_ATTENDANCE_MARK",
      resource: "training_attendance",
      resourceId: id,
      description: `Marked attendance for ${body.records.length} participant(s) on ${body.date}`,
    });

    return apiSuccess(rows, 201);
  });
}
