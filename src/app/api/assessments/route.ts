import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessments, questions, trainings } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
} from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { isTrainingAdmin } from "@/lib/rbac";

const questionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(["mcq", "true_false", "short_answer", "practical", "final"]).default("mcq"),
  options: z.array(z.string()).optional().default([]),
  correctAnswer: z.string().optional().nullable(),
  marks: z.number().min(0).default(1),
});

const createSchema = z.object({
  trainingId: z.number().int(),
  title: z.string().min(1),
  assessmentType: z.enum(["mcq", "true_false", "short_answer", "practical", "final"]).default("mcq"),
  totalMarks: z.number().min(0).default(100),
  passingMarks: z.number().min(0).default(40),
  durationMinutes: z.number().int().min(1).default(30),
  questions: z.array(questionSchema).default([]),
});

// GET /api/assessments?trainingId= - list assessments for a training.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    await requireAuth();
    const url = new URL(req.url);
    const trainingId = url.searchParams.get("trainingId");
    const rows = await db
      .select()
      .from(assessments)
      .where(trainingId ? eq(assessments.trainingId, Number(trainingId)) : undefined)
      .orderBy(assessments.createdAt);
    return apiSuccess(rows);
  });
}

// POST /api/assessments - create an assessment with its questions
// (Training Admin, or the trainer assigned to that training).
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const body = await parseBody(req, createSchema);

    const [training] = await db.select().from(trainings).where(eq(trainings.id, body.trainingId));
    if (!training) throw new HttpError("Training not found", 404);

    const self = await getEmployeeForSession(session);
    const isAssignedTrainer = session.role === "trainer" && self?.id === training.trainerId;
    if (!isTrainingAdmin(session.role) && !isAssignedTrainer) {
      throw new HttpError("Only the assigned trainer or training admin can create assessments", 403);
    }

    const { questions: questionInputs, ...assessmentInput } = body;
    const [assessment] = await db
      .insert(assessments)
      .values({
        ...assessmentInput,
        totalMarks: String(assessmentInput.totalMarks),
        passingMarks: String(assessmentInput.passingMarks),
        createdBy: session.userId,
      })
      .returning();

    if (questionInputs.length) {
      await db.insert(questions).values(
        questionInputs.map((q) => ({
          assessmentId: assessment.id,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          correctAnswer: q.correctAnswer ?? null,
          marks: String(q.marks),
        })),
      );
    }

    await audit({
      userId: session.userId,
      action: "ASSESSMENT_CREATE",
      resource: "assessment",
      resourceId: assessment.id,
      description: `Created assessment "${assessment.title}" with ${questionInputs.length} question(s)`,
    });

    return apiSuccess(assessment, 201);
  });
}
