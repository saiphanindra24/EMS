import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { performanceReviews } from "@/db/schema";
import { apiSuccess, requireAuth, withErrorHandling, HttpError, audit, parseId } from "@/lib/api";
import { parseBody } from "@/lib/validate";

const updateSchema = z.object({
  rating: z.number().min(0).max(5).optional().nullable(),
  strengths: z.string().optional().nullable(),
  improvements: z.string().optional().nullable(),
  feedback: z.string().optional().nullable(),
  status: z.enum(["draft", "submitted"]).optional(),
});

// PATCH /api/performance/reviews/:id - the reviewer edits/finalizes their own review.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const id = parseId((await params).id);
    const [review] = await db.select().from(performanceReviews).where(eq(performanceReviews.id, id));
    if (!review) throw new HttpError("Review not found", 404);
    if (review.reviewerId !== session.userId) {
      throw new HttpError("You can only edit reviews you authored", 403);
    }

    const body = await parseBody(req, updateSchema);
    const [updated] = await db
      .update(performanceReviews)
      .set({
        ...body,
        rating: body.rating != null ? String(body.rating) : undefined,
        submittedAt: body.status === "submitted" ? new Date() : review.submittedAt,
      })
      .where(eq(performanceReviews.id, id))
      .returning();

    await audit({
      userId: session.userId,
      action: "PERFORMANCE_REVIEW_UPDATE",
      resource: "performance_review",
      resourceId: id,
      description: "Updated performance review",
    });

    return apiSuccess(updated);
  });
}
