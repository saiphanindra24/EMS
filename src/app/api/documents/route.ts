import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { documents, employees } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
} from "@/lib/api";
import { saveUploadedFile } from "@/lib/upload";
import { canViewAllEmployees, isPeopleManager, HR_ROLES } from "@/lib/rbac";

const DOCUMENT_TYPES = [
  "resume",
  "id_proof",
  "educational_certificate",
  "experience_certificate",
  "joining_document",
  "other",
];

// GET /api/documents - list documents (own, team, or all depending on role).
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const employeeIdParam = url.searchParams.get("employeeId");
    const self = await getEmployeeForSession(session);

    const filters = [];
    if (canViewAllEmployees(session.role)) {
      if (employeeIdParam) filters.push(eq(documents.employeeId, Number(employeeIdParam)));
    } else if (isPeopleManager(session.role) && self) {
      const requested = employeeIdParam ? Number(employeeIdParam) : self.id;
      if (requested !== self.id) {
        const [target] = await db.select().from(employees).where(eq(employees.id, requested));
        if (!target || (target.managerId !== self.id && target.departmentId !== self.departmentId)) {
          throw new HttpError("You cannot view this employee's documents", 403);
        }
      }
      filters.push(eq(documents.employeeId, requested));
    } else if (self) {
      filters.push(eq(documents.employeeId, self.id));
    } else {
      return apiSuccess([]);
    }

    const rows = await db.select().from(documents).where(and(...filters)).orderBy(documents.uploadedAt);
    return apiSuccess(rows);
  });
}

// POST /api/documents - upload a document (multipart/form-data).
// Employees upload their own; HR/Admin may upload on behalf of any employee.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const form = await req.formData();
    const file = form.get("file");
    const documentType = String(form.get("documentType") ?? "");
    const title = String(form.get("title") ?? "");
    const employeeIdField = form.get("employeeId");

    if (!(file instanceof File)) throw new HttpError("A file is required", 400);
    if (!DOCUMENT_TYPES.includes(documentType)) throw new HttpError("Invalid document type", 400);
    if (!title) throw new HttpError("Title is required", 400);

    const self = await getEmployeeForSession(session);
    let employeeId = self?.id ?? null;
    if (employeeIdField) {
      const requested = Number(employeeIdField);
      if (requested !== self?.id && !HR_ROLES.includes(session.role)) {
        throw new HttpError("Only HR/Admin can upload documents for other employees", 403);
      }
      employeeId = requested;
    }
    if (!employeeId) throw new HttpError("No employee profile linked to this account", 400);

    const meta = await saveUploadedFile(file, "documents");

    const [row] = await db
      .insert(documents)
      .values({
        employeeId,
        documentType: documentType as
          | "resume"
          | "id_proof"
          | "educational_certificate"
          | "experience_certificate"
          | "joining_document"
          | "other",
        title,
        ...meta,
      })
      .returning();

    await audit({
      userId: session.userId,
      action: "DOCUMENT_UPLOAD",
      resource: "document",
      resourceId: row.id,
      description: `Uploaded document "${title}" (${documentType})`,
    });

    return apiSuccess(row, 201);
  });
}
