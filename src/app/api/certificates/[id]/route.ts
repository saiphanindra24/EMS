import { eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates, trainings, employees } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  getEmployeeForSession,
  parseId,
} from "@/lib/api";
import { canViewAllEmployees, isTrainingAdmin } from "@/lib/rbac";

// GET /api/certificates/:id - view/verify a single certificate.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [row] = await db
      .select({
        id: certificates.id,
        certificateNumber: certificates.certificateNumber,
        employeeId: certificates.employeeId,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
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
      .innerJoin(employees, eq(certificates.employeeId, employees.id))
      .where(eq(certificates.id, id));
    if (!row) throw new HttpError("Certificate not found", 404);

    const self = await getEmployeeForSession(session);
    if (row.employeeId !== self?.id && !canViewAllEmployees(session.role) && !isTrainingAdmin(session.role) && session.role !== "trainer") {
      throw new HttpError("You cannot view this certificate", 403);
    }
    return apiSuccess(row);
  });
}
