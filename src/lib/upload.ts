import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
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
 * Validate + persist an uploaded file.
 * Automatically supports:
 * 1. @vercel/blob when BLOB_READ_WRITE_TOKEN is configured in production.
 * 2. Local public/uploads directory during development.
 * 3. Resilient Base64 Data URI fallback if the environment has a read-only filesystem.
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

  const ext = path.extname(file.name) || "";
  const fileName = `${randomUUID()}${ext}`;

  // 1. Cloud Storage: Vercel Blob (if token available)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(`${subdir}/${fileName}`, file, {
        access: "public",
      });
      return {
        fileUrl: blob.url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      };
    } catch (blobErr) {
      console.warn("Vercel Blob upload failed, falling back to local/data storage:", blobErr);
    }
  }

  // 2. Local Disk Storage (standard dev environment)
  try {
    const dir = path.join(process.cwd(), "public", "uploads", subdir);
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return {
      fileUrl: `/uploads/${subdir}/${fileName}`,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
  } catch (fsErr) {
    // 3. Serverless Read-Only Filesystem Fallback (Data URI)
    console.warn("Filesystem is read-only. Storing as Data URI fallback:", fsErr);
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    return {
      fileUrl: dataUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
  }
}
