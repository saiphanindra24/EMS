import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { HttpError } from "./api";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Validate + persist an uploaded file to `public/uploads/<subdir>`.
 * Returns the web-accessible URL along with basic file metadata.
 */
export async function saveUploadedFile(file: File, subdir: string) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new HttpError(
      `Unsupported file type "${file.type}". Allowed: PDF, JPG, PNG, DOC, DOCX.`,
      400,
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new HttpError("File exceeds the 5MB size limit", 400);
  }

  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });

  const ext = path.extname(file.name) || "";
  const fileName = `${randomUUID()}${ext}`;
  const filePath = path.join(dir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return {
    fileUrl: `/uploads/${subdir}/${fileName}`,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
}
