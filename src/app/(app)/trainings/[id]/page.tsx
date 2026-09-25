"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Card, Table, Badge, Button, Modal, Field, inputClass, EmptyState } from "@/components/ui";

interface Training {
  id: number;
  title: string;
  description: string | null;
  category: string;
  trainerId: number | null;
  trainerFirstName: string | null;
  trainerLastName: string | null;
  startDate: string;
  endDate: string;
  status: string;
}
interface Material {
  id: number;
  title: string;
  fileUrl: string;
  fileType: string | null;
}
interface Enrollment {
  id: number;
  employeeId: number;
  employeeFirstName: string;
  employeeLastName: string;
  status: string;
  progress: number;
}
interface Assessment {
  id: number;
  title: string;
  assessmentType: string;
  totalMarks: string;
  passingMarks: string;
}

const PRIVILEGED_ROLES = ["super_admin", "training_admin", "trainer"];

export default function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { user } = useAuth();
  const [training, setTraining] = useState<Training | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = user && PRIVILEGED_ROLES.includes(user.role);

  const materialForm = useForm<{ title: string }>();
  const assessmentForm = useForm<{
    title: string;
    assessmentType: string;
    totalMarks: string;
    passingMarks: string;
    durationMinutes: string;
  }>({ defaultValues: { assessmentType: "mcq", totalMarks: "100", passingMarks: "40", durationMinutes: "30" } });
  const certForm = useForm<{ employeeId: string; score: string }>();

  const load = () => {
    api.get<Training>(`/api/trainings/${id}`).then(setTraining);
    api.get<Material[]>(`/api/trainings/${id}/materials`).then(setMaterials);
    api.get<Enrollment[]>(`/api/enrollments?trainingId=${id}`).then(setEnrollments);
    api.get<Assessment[]>(`/api/assessments?trainingId=${id}`).then(setAssessments);
  };
  useEffect(() => {
    load();
  }, [id]);

  const uploadMaterial = async (v: { title: string }, fileInput: HTMLInputElement | null) => {
    setError(null);
    const file = fileInput?.files?.[0];
    if (!file) {
      setError("Choose a file");
      return;
    }
    const form = new FormData();
    form.append("title", v.title);
    form.append("file", file);
    try {
      await api.post(`/api/trainings/${id}/materials`, form);
      setMaterialOpen(false);
      materialForm.reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Upload failed");
    }
  };

  const createAssessment = async (v: {
    title: string;
    assessmentType: string;
    totalMarks: string;
    passingMarks: string;
    durationMinutes: string;
  }) => {
    setError(null);
    try {
      await api.post("/api/assessments", {
        trainingId: Number(id),
        title: v.title,
        assessmentType: v.assessmentType,
        totalMarks: Number(v.totalMarks),
        passingMarks: Number(v.passingMarks),
        durationMinutes: Number(v.durationMinutes),
        questions: [],
      });
      setAssessmentOpen(false);
      assessmentForm.reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  const issueCertificate = async (v: { employeeId: string; score: string }) => {
    setError(null);
    try {
      await api.post("/api/certificates", {
        employeeId: Number(v.employeeId),
        trainingId: Number(id),
        score: v.score ? Number(v.score) : null,
      });
      setCertOpen(false);
      certForm.reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  if (!training) return <p className="text-slate-400">Loading...</p>;

  return (
    <div>
      <PageHeader
        title={training.title}
        description={`${training.category.replace(/_/g, " ")} • ${training.startDate} → ${training.endDate} • Trainer: ${
          training.trainerFirstName ? `${training.trainerFirstName} ${training.trainerLastName}` : "Unassigned"
        }`}
        actions={<Badge tone="indigo">{training.status}</Badge>}
      />
      <p className="mb-6 max-w-3xl text-sm text-slate-600">{training.description}</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Materials</h3>
            {canManage && (
              <Button variant="secondary" onClick={() => setMaterialOpen(true)}>
                + Upload
              </Button>
            )}
          </div>
          {materials.length === 0 ? (
            <EmptyState message="No materials uploaded yet." />
          ) : (
            <ul className="space-y-1 text-sm">
              {materials.map((m) => (
                <li key={m.id}>
                  <a href={m.fileUrl} target="_blank" className="text-violet-600 hover:underline">
                    {m.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Assessments</h3>
            {canManage && (
              <Button variant="secondary" onClick={() => setAssessmentOpen(true)}>
                + Create
              </Button>
            )}
          </div>
          {assessments.length === 0 ? (
            <EmptyState message="No assessments yet." />
          ) : (
            <ul className="space-y-1 text-sm">
              {assessments.map((a) => (
                <li key={a.id}>
                  <Link href={`/assessments/${a.id}`} className="text-violet-600 hover:underline">
                    {a.title}
                  </Link>{" "}
                  <span className="text-slate-400">
                    ({a.assessmentType}, pass {a.passingMarks}/{a.totalMarks})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Participants</h3>
          {canManage && (
            <Button variant="secondary" onClick={() => setCertOpen(true)}>
              Issue certificate
            </Button>
          )}
        </div>
        {enrollments.length === 0 ? (
          <EmptyState message="No one enrolled yet." />
        ) : (
          <Table headers={["Employee", "Status", "Progress"]}>
            {enrollments.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 text-slate-700">
                  {e.employeeFirstName} {e.employeeLastName} (#{e.employeeId})
                </td>
                <td className="px-4 py-3">
                  <Badge tone={e.status === "completed" ? "green" : e.status === "failed" ? "red" : "amber"}>{e.status}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">{e.progress}%</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={materialOpen} onClose={() => setMaterialOpen(false)} title="Upload material">
        <MaterialForm onSubmit={uploadMaterial} error={error} />
      </Modal>

      <Modal open={assessmentOpen} onClose={() => setAssessmentOpen(false)} title="Create assessment">
        <form onSubmit={assessmentForm.handleSubmit(createAssessment)} className="space-y-3">
          <Field label="Title">
            <input className={inputClass} {...assessmentForm.register("title", { required: true })} />
          </Field>
          <Field label="Assessment type">
            <select className={inputClass} {...assessmentForm.register("assessmentType")}>
              <option value="mcq">MCQ</option>
              <option value="true_false">True/False</option>
              <option value="short_answer">Short Answer</option>
              <option value="practical">Practical</option>
              <option value="final">Final</option>
            </select>
          </Field>
          <Field label="Total marks">
            <input className={inputClass} {...assessmentForm.register("totalMarks")} />
          </Field>
          <Field label="Passing marks">
            <input className={inputClass} {...assessmentForm.register("passingMarks")} />
          </Field>
          <Field label="Duration (minutes)">
            <input className={inputClass} {...assessmentForm.register("durationMinutes")} />
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">
            Create (add questions from the assessment page)
          </Button>
        </form>
      </Modal>

      <Modal open={certOpen} onClose={() => setCertOpen(false)} title="Issue certificate">
        <form onSubmit={certForm.handleSubmit(issueCertificate)} className="space-y-3">
          <Field label="Employee ID">
            <input className={inputClass} {...certForm.register("employeeId", { required: true })} />
          </Field>
          <Field label="Score (optional)">
            <input className={inputClass} {...certForm.register("score")} />
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">
            Issue
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function MaterialForm({
  onSubmit,
  error,
}: {
  onSubmit: (v: { title: string }, file: HTMLInputElement | null) => void;
  error: string | null;
}) {
  const [title, setTitle] = useState("");
  const [fileRef, setFileRef] = useState<HTMLInputElement | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title }, fileRef);
      }}
      className="space-y-3"
    >
      <Field label="Title">
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="File">
        <input type="file" ref={setFileRef} className={inputClass} required />
      </Field>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" className="w-full">
        Upload
      </Button>
    </form>
  );
}
