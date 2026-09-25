"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Table, Badge, Button, Modal, Field, inputClass, EmptyState } from "@/components/ui";

interface Department {
  id: number;
  name: string;
  code: string;
  description: string | null;
  status: string;
  employeeCount: number;
}

interface FormValues {
  name: string;
  code: string;
  description: string;
}

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Department[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = user && ["super_admin", "hr_admin"].includes(user.role);
  const { register, handleSubmit, reset } = useForm<FormValues>();

  const load = () => api.get<Department[]>("/api/departments").then(setRows);
  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await api.post("/api/departments", values);
      setOpen(false);
      reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  const toggleStatus = async (dept: Department) => {
    if (dept.status === "active") {
      await api.delete(`/api/departments/${dept.id}`);
    } else {
      await api.patch(`/api/departments/${dept.id}`, { status: "active" });
    }
    load();
  };

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Organizational units with live headcount."
        actions={canManage && <Button onClick={() => setOpen(true)}>+ New Department</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState message="No departments yet." />
      ) : (
        <Table headers={["Name", "Code", "Employees", "Status", canManage ? "Actions" : ""]}>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="px-4 py-3 font-medium text-slate-900">{d.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.code}</td>
              <td className="px-4 py-3 text-slate-600">{d.employeeCount}</td>
              <td className="px-4 py-3">
                <Badge tone={d.status === "active" ? "green" : "red"}>{d.status}</Badge>
              </td>
              <td className="px-4 py-3">
                {canManage && (
                  <button onClick={() => toggleStatus(d)} className="text-violet-600 hover:underline">
                    {d.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New department">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Name">
            <input className={inputClass} {...register("name", { required: true })} />
          </Field>
          <Field label="Code">
            <input className={inputClass} {...register("code", { required: true })} />
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
