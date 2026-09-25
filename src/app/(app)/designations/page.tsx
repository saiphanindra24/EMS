"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Table, Badge, Button, Modal, Field, inputClass, EmptyState } from "@/components/ui";

interface Designation {
  id: number;
  title: string;
  departmentId: number;
  departmentName: string | null;
  level: string;
  status: string;
}
interface Department {
  id: number;
  name: string;
}
interface FormValues {
  title: string;
  departmentId: string;
  level: string;
  description: string;
}

const LEVELS = ["entry", "junior", "mid", "senior", "lead", "manager", "director", "executive"];

export default function DesignationsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = user && ["super_admin", "hr_admin"].includes(user.role);
  const { register, handleSubmit, reset } = useForm<FormValues>({ defaultValues: { level: "entry" } });

  const load = () => api.get<Designation[]>("/api/designations").then(setRows);
  useEffect(() => {
    load();
    api.get<Department[]>("/api/departments").then(setDepartments);
  }, []);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await api.post("/api/designations", { ...values, departmentId: Number(values.departmentId) });
      setOpen(false);
      reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Designations"
        description="Job titles and seniority levels per department."
        actions={canManage && <Button onClick={() => setOpen(true)}>+ New Designation</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState message="No designations yet." />
      ) : (
        <Table headers={["Title", "Department", "Level", "Status"]}>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="px-4 py-3 font-medium text-slate-900">{d.title}</td>
              <td className="px-4 py-3 text-slate-600">{d.departmentName ?? "-"}</td>
              <td className="px-4 py-3 text-slate-600">{d.level}</td>
              <td className="px-4 py-3">
                <Badge tone={d.status === "active" ? "green" : "red"}>{d.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New designation">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Title">
            <input className={inputClass} {...register("title", { required: true })} />
          </Field>
          <Field label="Department">
            <select className={inputClass} {...register("departmentId", { required: true })}>
              <option value="">-- select --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Level">
            <select className={inputClass} {...register("level")}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea className={inputClass} {...register("description")} />
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
