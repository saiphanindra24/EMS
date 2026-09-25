import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates, trainings, employees, enrollments, notifications } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
} from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { isTrainingAdmin, canViewAllEmployees } from "@/lib/rbac";

const issueSchema = z.object({
  employeeId: z.number().int(),
  trainingId: z.number().int(),
  score: z.number().min(0).optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

function generateCertificateNumber(trainingId: number, employeeId: number) {
  const stamp = Date.now().toString(36).toUpperCase();
  return `CERT-${trainingId}-${employeeId}-${stamp}`;
}

// GET /api/certificates?employeeId= - list certificates.
// Employees see their own; Training Admin/HR/Auditor see all.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const employeeIdParam = url.searchParams.get("employeeId");
    const self = await getEmployeeForSession(session);

    const filters = [];
    if (isTrainingAdmin(session.role) || canViewAllEmployees(session.role) || session.role === "trainer") {
      if (employeeIdParam) filters.push(eq(certificates.employeeId, Number(employeeIdParam)));
    } else if (self) {
      filters.push(eq(certificates.employeeId, self.id));
    } else {
      return apiSuccess([]);
    }

    const rows = await db
      .select({
        id: certificates.id,
        certificateNumber: certificates.certificateNumber,
        employeeId: certificates.employeeId,
        trainingId: certificates.trainingId,
        trainingTitle: trainings.title,
        trainerId: certificates.trainerId,
        completionDate: certificates.completionDate,
        score: certificates.score,
        issueDate: certificates.issueDate,
        expiryDate: certificates.expiryDate,
      })
      .from(certificates)
      .innerJoin(trainings, eq(certificates.trainingId, trainings.id))
      .where(and(...filters))
      .orderBy(certificates.issueDate);

    return apiSuccess(rows);
  });
}

// POST /api/certificates - issue a certificate after successful training completion
// (Training Admin, or the training's assigned Trainer).
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const body = await parseBody(req, issueSchema);

    const [training] = await db.select().from(trainings).where(eq(trainings.id, body.trainingId));
    if (!training) throw new HttpError("Training not found", 404);

    const self = await getEmployeeForSession(session);
    const isAssignedTrainer = session.role === "trainer" && self?.id === training.trainerId;
    if (!isTrainingAdmin(session.role) && !isAssignedTrainer) {
      throw new HttpError("Only the assigned trainer or training admin can issue certificates", 403);
    }

    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.trainingId, body.trainingId), eq(enrollments.employeeId, body.employeeId)));
    if (!enrollment) throw new HttpError("Employee is not enrolled in this training", 400);

    await db
      .update(enrollments)
      .set({ status: "completed", progress: 100, completionDate: new Date() })
      .where(eq(enrollments.id, enrollment.id));

    const today = new Date().toISOString().slice(0, 10);
    const [certificate] = await db
      .insert(certificates)
      .values({
        certificateNumber: generateCertificateNumber(body.trainingId, body.employeeId),
        employeeId: body.employeeId,
        trainingId: body.trainingId,
        trainerId: training.trainerId,
        completionDate: today,
        score: body.score != null ? String(body.score) : null,
        issueDate: today,
        expiryDate: body.expiryDate ?? null,
      })
      .returning();

    const [employee] = await db.select().from(employees).where(eq(employees.id, body.employeeId));
    if (employee) {
      await db.insert(notifications).values({
        userId: employee.userId,
        type: "certificate",
        title: "Certificate issued",
        message: `Your certificate for "${training.title}" is now available.`,
        relatedEntityType: "certificate",
        relatedEntityId: certificate.id,
      });
    }

    await audit({
      userId: session.userId,
      action: "CERTIFICATE_ISSUE",
      resource: "certificate",
      resourceId: certificate.id,
      description: `Issued certificate ${certificate.certificateNumber}`,
    });

    return apiSuccess(certificate, 201);
  });
}
