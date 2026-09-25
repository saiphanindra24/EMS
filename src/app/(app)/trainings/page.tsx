"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Table, Badge, Button, Modal, Field, inputClass, EmptyState } from "@/components/ui";

interface Training {
  id: number;
  title: string;
  category: string;
  trainerFirstName: string | null;
  trainerLastName: string | null;
  startDate: string;
  endDate: string;
  trainingType: string;
  skillLevel: string;
  maxParticipants: number;
  status: string;
}

interface FormValues {
  title: string;
  description: string;
  category: string;
  trainerId: string;
  startDate: string;
  endDate: string;
  durationHours: string;
  trainingType: string;
  skillLevel: string;
  maxParticipants: string;
}

const CATEGORIES = [
  "technical",
  "soft_skills",
  "leadership",
  "communication",
  "security",
  "compliance",
  "management",
  "programming",
  "database",
  "cloud",
  "devops",
  "ai_ml",
];
const TYPES = ["online", "offline", "hybrid", "workshop", "certification", "on_the_job", "internal", "external"];

const STATUS_TONE: Record<string, "green" | "amber" | "slate" | "red" | "indigo"> = {
  draft: "slate",
  scheduled: "indigo",
  ongoing: "amber",
  completed: "green",
  cancelled: "red",
};

export default function TrainingsPage() {
  const { user, employee } = useAuth();
  const [rows, setRows] = useState<Training[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = user && ["super_admin", "training_admin"].includes(user.role);
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { trainingType: "online", skillLevel: "beginner", maxParticipants: "30", durationHours: "8" },
  });

  const load = () => api.get<Training[]>("/api/trainings").then(setRows);
  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (v: FormValues) => {
    setError(null);
    try {
      await api.post("/api/trainings", {
        ...v,
        trainerId: v.trainerId ? Number(v.trainerId) : null,
        durationHours: Number(v.durationHours),
        maxParticipants: Number(v.maxParticipants),
      });
      setOpen(false);
      reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  const enroll = async (trainingId: number) => {
    try {
      await api.post("/api/enrollments", { trainingId });
      alert("Enrolled successfully!");
    } catch (e) {
      alert(e instanceof ApiClientError ? e.message : "Enrollment failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Trainings (ETS)"
        description="Browse the training catalog. Employees can self-enroll where permitted."
        actions={canManage && <Button onClick={() => setOpen(true)}>+ New training</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState message="No trainings available yet." />
      ) : (
        <Table headers={["Title", "Category", "Trainer", "Dates", "Type", "Level", "Status", ""]}>
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3 font-medium text-slate-900">
                <Link href={`/trainings/${t.id}`} className="hover:underline">
                  {t.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{t.category.replace(/_/g, " ")}</td>
              <td className="px-4 py-3 text-slate-600">
                {t.trainerFirstName ? `${t.trainerFirstName} ${t.trainerLastName}` : "Unassigned"}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {t.startDate} → {t.endDate}
              </td>
              <td className="px-4 py-3 text-slate-600">{t.trainingType}</td>
              <td className="px-4 py-3 text-slate-600">{t.skillLevel}</td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[t.status] ?? "slate"}>{t.status}</Badge>
              </td>
              <td className="px-4 py-3">
                {employee && (
                  <button onClick={() => enroll(t.id)} className="text-violet-600 hover:underline">
                    Enroll
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create training program">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Title">
            <input className={inputClass} {...register("title", { required: true })} />
          </Field>
          <Field label="Description">
            <textarea className={inputClass} {...register("description")} />
          </Field>
          <Field label="Category">
            <select className={inputClass} {...register("category", { required: true })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trainer employee ID (optional)">
            <input className={inputClass} {...register("trainerId")} />
          </Field>
          <Field label="Start date">
            <input type="date" className={inputClass} {...register("startDate", { required: true })} />
          </Field>
          <Field label="End date">
            <input type="date" className={inputClass} {...register("endDate", { required: true })} />
          </Field>
          <Field label="Duration (hours)">
            <input className={inputClass} {...register("durationHours")} />
          </Field>
          <Field label="Training type">
            <select className={inputClass} {...register("trainingType")}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Skill level">
            <select className={inputClass} {...register("skillLevel")}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </Field>
          <Field label="Max participants">
            <input className={inputClass} {...register("maxParticipants")} />
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">
            Create
          </Button>
        </form>
      </Modal>
    </div>
  );
}
