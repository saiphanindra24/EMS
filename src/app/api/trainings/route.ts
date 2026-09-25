import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trainings, employees } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit } from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { isTrainingAdmin } from "@/lib/rbac";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.enum([
    "technical",
    "soft_skills",
    "leadership",
    "communication",
    "security",
    "compliance",
    "management",
    "programming",
    "database",
    "cloud",
    "devops",
    "ai_ml",
  ]),
  trainerId: z.number().int().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  durationHours: z.number().min(0).default(0),
  trainingType: z.enum([
    "online",
    "offline",
    "hybrid",
    "workshop",
    "certification",
    "on_the_job",
    "internal",
    "external",
  ]),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  maxParticipants: z.number().int().min(1).default(30),
  status: z.enum(["draft", "scheduled", "ongoing", "completed", "cancelled"]).default("draft"),
});

// GET /api/trainings - list trainings. Visible to everyone (used for browsing/enrolling).
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    await requireAuth();
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");

    const rows = await db
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
      .where(
        category
          ? eq(trainings.category, category as typeof trainings.$inferSelect.category)
          : status
            ? eq(trainings.status, status as typeof trainings.$inferSelect.status)
            : undefined,
      )
      .orderBy(trainings.startDate);

    return apiSuccess(rows);
  });
}

// POST /api/trainings - create a training program (Training Admin / Super Admin).
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!isTrainingAdmin(session.role)) {
      throw new HttpError("Only Training Admin / Super Admin can create trainings", 403);
    }
    const body = await parseBody(req, createSchema);
    const [row] = await db
      .insert(trainings)
      .values({ ...body, durationHours: String(body.durationHours), createdBy: session.userId })
      .returning();

    await audit({
      userId: session.userId,
      action: "TRAINING_CREATE",
      resource: "training",
      resourceId: row.id,
      description: `Created training "${row.title}"`,
    });

    return apiSuccess(row, 201);
  });
}
