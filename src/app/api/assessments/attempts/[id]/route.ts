import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentAttempts, assessments, trainings, notifications, employees } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit, getEmployeeForSession, parseId } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { isTrainingAdmin } from "@/lib/rbac";

const evaluateSchema = z.object({
  score: z.number().min(0),
  trainerFeedback: z.string().optional().nullable(),
});

// PATCH /api/assessments/attempts/:id - trainer/training admin evaluates a
// subjective attempt (short answer / practical), assigning a final score.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [attempt] = await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, id));
    if (!attempt) throw new HttpError("Attempt not found", 404);

    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, attempt.assessmentId));
    if (!assessment) throw new HttpError("Assessment not found", 404);
    const [training] = await db.select().from(trainings).where(eq(trainings.id, assessment.trainingId));

    const self = await getEmployeeForSession(session);
    const isAssignedTrainer = session.role === "trainer" && self?.id === training?.trainerId;
    if (!isTrainingAdmin(session.role) && !isAssignedTrainer) {
      throw new HttpError("Only the assigned trainer or training admin can evaluate attempts", 403);
    }

    const body = await parseBody(req, evaluateSchema);
    const totalMarks = Number(assessment.totalMarks) || 1;
    const percentage = Math.round((body.score / totalMarks) * 10000) / 100;
    const passed = body.score >= Number(assessment.passingMarks);

    const [updated] = await db
      .update(assessmentAttempts)
      .set({
        score: String(body.score),
        percentage: String(percentage),
        passed,
        trainerFeedback: body.trainerFeedback ?? null,
        evaluatedBy: session.userId,
      })
      .where(eq(assessmentAttempts.id, id))
      .returning();

    const [employee] = await db.select().from(employees).where(eq(employees.id, attempt.employeeId));
    if (employee) {
      await db.insert(notifications).values({
        userId: employee.userId,
        type: "assessment",
        title: "Assessment evaluated",
        message: `Your attempt for "${assessment.title}" was graded: ${body.score}/${totalMarks} (${passed ? "Passed" : "Failed"}).`,
        relatedEntityType: "assessment_attempt",
        relatedEntityId: id,
      });
    }

    await audit({
      userId: session.userId,
      action: "ASSESSMENT_EVALUATE",
      resource: "assessment_attempt",
      resourceId: id,
      description: `Evaluated attempt with score ${body.score}/${totalMarks}`,
    });

    return apiSuccess(updated);
  });
}
