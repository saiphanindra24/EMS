import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessments, questions, trainings } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  getEmployeeForSession,
  parseId,
} from "@/lib/api";
import { isTrainingAdmin } from "@/lib/rbac";

// GET /api/assessments/:id - view an assessment + its questions.
// Correct answers are hidden from employees taking the assessment.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, id));
    if (!assessment) throw new HttpError("Assessment not found", 404);

    const [training] = await db.select().from(trainings).where(eq(trainings.id, assessment.trainingId));
    const self = await getEmployeeForSession(session);
    const isAssignedTrainer = session.role === "trainer" && self?.id === training?.trainerId;
    const canSeeAnswers = isTrainingAdmin(session.role) || isAssignedTrainer;

    const rows = await db.select().from(questions).where(eq(questions.assessmentId, id));
    const sanitizedQuestions = canSeeAnswers
      ? rows
      : rows.map(({ correctAnswer: _correctAnswer, ...rest }) => rest);

    return apiSuccess({ ...assessment, questions: sanitizedQuestions });
  });
}
