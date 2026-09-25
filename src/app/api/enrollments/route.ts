import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { enrollments, trainings, employees, notifications } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
} from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { isTrainingAdmin, canViewAllEmployees, isPeopleManager, HR_ROLES } from "@/lib/rbac";

const createSchema = z.object({
  trainingId: z.number().int(),
  employeeId: z.number().int().optional(), // omitted => self-enroll
});

// GET /api/enrollments?trainingId=&employeeId= - list enrollments, scoped by role.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const trainingId = url.searchParams.get("trainingId");
    const employeeIdParam = url.searchParams.get("employeeId");
    const self = await getEmployeeForSession(session);

    const filters = [];
    if (trainingId) filters.push(eq(enrollments.trainingId, Number(trainingId)));

    if (canViewAllEmployees(session.role) || isTrainingAdmin(session.role) || session.role === "trainer") {
      if (employeeIdParam) filters.push(eq(enrollments.employeeId, Number(employeeIdParam)));
    } else if (self) {
      filters.push(eq(enrollments.employeeId, self.id));
    } else {
      return apiSuccess([]);
    }

    const rows = await db
      .select({
        id: enrollments.id,
        trainingId: enrollments.trainingId,
        trainingTitle: trainings.title,
        employeeId: enrollments.employeeId,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
        enrollmentDate: enrollments.enrollmentDate,
        status: enrollments.status,
        progress: enrollments.progress,
        completionDate: enrollments.completionDate,
      })
      .from(enrollments)
      .innerJoin(trainings, eq(enrollments.trainingId, trainings.id))
      .innerJoin(employees, eq(enrollments.employeeId, employees.id))
      .where(and(...filters))
      .orderBy(enrollments.enrollmentDate);

    return apiSuccess(rows);
  });
}

// POST /api/enrollments - self-enroll, or Training Admin/HR assigns an employee.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const self = await getEmployeeForSession(session);
    const body = await parseBody(req, createSchema);

    let employeeId = body.employeeId ?? self?.id;
    if (!employeeId) throw new HttpError("No employee profile linked to this account", 400);

    if (body.employeeId && body.employeeId !== self?.id) {
      if (!isTrainingAdmin(session.role) && !HR_ROLES.includes(session.role) && !isPeopleManager(session.role)) {
        throw new HttpError("Only Training Admin/HR/Manager can assign training to others", 403);
      }
    }

    const [training] = await db.select().from(trainings).where(eq(trainings.id, body.trainingId));
    if (!training) throw new HttpError("Training not found", 404);

    const [{ value: enrolledCount }] = await db
      .select({ value: count() })
      .from(enrollments)
      .where(eq(enrollments.trainingId, body.trainingId));
    if (enrolledCount >= training.maxParticipants) {
      throw new HttpError("This training has reached its maximum number of participants", 409);
    }

    const existing = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.trainingId, body.trainingId), eq(enrollments.employeeId, employeeId)));
    if (existing.length) throw new HttpError("Employee is already enrolled in this training", 409);

    const [row] = await db.insert(enrollments).values({ trainingId: body.trainingId, employeeId }).returning();

    const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId));
    if (employee) {
      await db.insert(notifications).values({
        userId: employee.userId,
        type: "training",
        title: "Training assigned",
        message: `You have been enrolled in "${training.title}".`,
        relatedEntityType: "training",
        relatedEntityId: training.id,
      });
    }

    await audit({
      userId: session.userId,
      action: "ENROLLMENT_CREATE",
      resource: "enrollment",
      resourceId: row.id,
      description: `Enrolled employee ${employeeId} in training ${body.trainingId}`,
    });

    return apiSuccess(row, 201);
  });
}
