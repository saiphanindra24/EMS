"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader, Table, Badge, Button, Modal, Field, inputClass, EmptyState } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";

interface DocumentRow {
  id: number;
  documentType: string;
  title: string;
  fileUrl: string;
  fileName: string;
  status: string;
  uploadedAt: string;
}

const DOC_TYPES = [
  "resume",
  "id_proof",
  "educational_certificate",
  "experience_certificate",
  "joining_document",
  "other",
];

const TONE: Record<string, "green" | "red" | "amber"> = {
  verified: "green",
  rejected: "red",
  pending: "amber",
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState(DOC_TYPES[0]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canVerify = user && ["super_admin", "hr_admin", "hr_executive"].includes(user.role);

  const load = () => api.get<DocumentRow[]>("/api/documents").then(setRows);
  useEffect(() => {
    load();
  }, []);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please choose a file");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    form.append("documentType", documentType);
    try {
      await api.post("/api/documents", form);
      setOpen(false);
      setTitle("");
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Upload failed");
    }
  };

  const verify = async (id: number, status: "verified" | "rejected") => {
    await api.patch(`/api/documents/${id}`, { status });
    load();
  };

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Resume, ID proof, certificates, and other HR documents. PDF/JPG/PNG/DOC up to 5MB."
        actions={<Button onClick={() => setOpen(true)}>+ Upload document</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState message="No documents uploaded yet." />
      ) : (
        <Table headers={["Title", "Type", "File", "Status", "Uploaded", canVerify ? "Actions" : ""]}>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="px-4 py-3 font-medium text-slate-900">{d.title}</td>
              <td className="px-4 py-3 text-slate-600">{d.documentType.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">
                <a href={d.fileUrl} target="_blank" className="text-violet-600 hover:underline">
                  {d.fileName}
                </a>
              </td>
              <td className="px-4 py-3">
                <Badge tone={TONE[d.status] ?? "amber"}>{d.status}</Badge>
              </td>
              <td className="px-4 py-3 text-slate-500">{new Date(d.uploadedAt).toLocaleDateString()}</td>
              <td className="px-4 py-3 space-x-2">
                {canVerify && d.status === "pending" && (
                  <>
                    <button onClick={() => verify(d.id, "verified")} className="text-emerald-600 hover:underline">
                      Verify
                    </button>
                    <button onClick={() => verify(d.id, "rejected")} className="text-red-600 hover:underline">
                      Reject
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Upload document">
        <form onSubmit={upload} className="space-y-3">
          <Field label="Title">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Document type">
            <select className={inputClass} value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="File (PDF, JPG, PNG, DOC — max 5MB)">
            <input type="file" ref={fileRef} className={inputClass} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" required />
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">
            Upload
          </Button>
        </form>
      </Modal>
    </div>
  );
}
