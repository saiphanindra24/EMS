import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessments, questions, assessmentAttempts, enrollments } from "@/db/schema";
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

const submitSchema = z.object({ answers: z.record(z.string(), z.string()) });

// GET /api/assessments/:id/attempt - list attempts. Employee sees own; trainer/admin see all.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const self = await getEmployeeForSession(session);

    const filters = [eq(assessmentAttempts.assessmentId, id)];
    if (!isTrainingAdmin(session.role) && session.role !== "trainer") {
      if (!self) return apiSuccess([]);
      filters.push(eq(assessmentAttempts.employeeId, self.id));
    }
    const rows = await db.select().from(assessmentAttempts).where(and(...filters));
    return apiSuccess(rows);
  });
}

// POST /api/assessments/:id/attempt - submit an attempt.
// Objective question types (mcq/true_false) are auto-graded immediately;
// subjective types (short_answer/practical) are left pending trainer evaluation.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const self = await getEmployeeForSession(session);
    if (!self) throw new HttpError("No employee profile linked to this account", 400);

    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, id));
    if (!assessment) throw new HttpError("Assessment not found", 404);

    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.trainingId, assessment.trainingId), eq(enrollments.employeeId, self.id)));
    if (!enrollment) throw new HttpError("You must be enrolled in this training to attempt its assessment", 403);

    const existing = await db
      .select()
      .from(assessmentAttempts)
      .where(and(eq(assessmentAttempts.assessmentId, id), eq(assessmentAttempts.employeeId, self.id)));
    if (existing.length) throw new HttpError("You have already attempted this assessment", 409);

    const body = await parseBody(req, submitSchema);
    const questionRows = await db.select().from(questions).where(eq(questions.assessmentId, id));

    let score = 0;
    let gradableMarks = 0;
    let hasSubjective = false;
    for (const q of questionRows) {
      if (q.questionType === "mcq" || q.questionType === "true_false") {
        gradableMarks += Number(q.marks);
        const given = body.answers[String(q.id)];
        if (given != null && q.correctAnswer != null && given.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
          score += Number(q.marks);
        }
      } else {
        hasSubjective = true;
      }
    }

    const totalMarks = Number(assessment.totalMarks) || 1;
    const percentage = Math.round((score / totalMarks) * 10000) / 100;
    const passed = hasSubjective ? null : score >= Number(assessment.passingMarks);

    const [attempt] = await db
      .insert(assessmentAttempts)
      .values({
        assessmentId: id,
        employeeId: self.id,
        answers: body.answers,
        score: hasSubjective ? null : String(score),
        percentage: hasSubjective ? null : String(percentage),
        passed,
      })
      .returning();

    await audit({
      userId: session.userId,
      action: "ASSESSMENT_ATTEMPT",
      resource: "assessment_attempt",
      resourceId: attempt.id,
      description: `Attempted assessment ${id}${hasSubjective ? " (pending manual grading)" : ` scored ${score}/${totalMarks}`}`,
    });

    return apiSuccess(attempt, 201);
  });
}
