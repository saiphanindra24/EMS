import { HttpError } from "./api";
import { z } from "zod";

/** Parse a JSON request body against a zod schema, raising a 400 HttpError on failure. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError("Request body must be valid JSON", 400);
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new HttpError("Validation failed", 422, result.error.flatten());
  }
  return result.data;
}

export function parsePagination(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
