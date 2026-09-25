import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, employees } from "@/db/schema";
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
import { HR_ROLES, canViewAllEmployees } from "@/lib/rbac";

const verifySchema = z.object({
  status: z.enum(["pending", "verified", "rejected"]),
});

// GET /api/documents/:id - fetch metadata for one document.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [row] = await db.select().from(documents).where(eq(documents.id, id));
    if (!row) throw new HttpError("Document not found", 404);

    const self = await getEmployeeForSession(session);
    if (row.employeeId !== self?.id && !canViewAllEmployees(session.role)) {
      throw new HttpError("You cannot view this document", 403);
    }
    return apiSuccess(row);
  });
}

// PATCH /api/documents/:id - HR verifies/rejects a document.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!HR_ROLES.includes(session.role)) {
      throw new HttpError("Only HR/Admin can verify documents", 403);
    }
    const id = parseId((await params).id);
    const body = await parseBody(req, verifySchema);

    const [updated] = await db
      .update(documents)
      .set({ status: body.status, verifiedBy: session.userId, verifiedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    if (!updated) throw new HttpError("Document not found", 404);

    await audit({
      userId: session.userId,
      action: "DOCUMENT_VERIFY",
      resource: "document",
      resourceId: id,
      description: `Marked document as ${body.status}`,
    });

    return apiSuccess(updated);
  });
}

// DELETE /api/documents/:id - remove a document (owner or HR/Admin).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [row] = await db.select().from(documents).where(eq(documents.id, id));
    if (!row) throw new HttpError("Document not found", 404);

    const self = await getEmployeeForSession(session);
    if (row.employeeId !== self?.id && !HR_ROLES.includes(session.role)) {
      throw new HttpError("You cannot delete this document", 403);
    }

    await db.delete(documents).where(eq(documents.id, id));
    await audit({
      userId: session.userId,
      action: "DOCUMENT_DELETE",
      resource: "document",
      resourceId: id,
      description: `Deleted document "${row.title}"`,
    });

    return apiSuccess({ deleted: true });
  });
}

void employees;
