"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Table, Badge, Button, Modal, Field, inputClass, EmptyState } from "@/components/ui";

interface Holiday {
  id: number;
  name: string;
  date: string;
  description: string | null;
  isOptional: boolean;
}
interface FormValues {
  name: string;
  date: string;
  description: string;
  isOptional: boolean;
}

export default function HolidaysPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Holiday[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = user && ["super_admin", "hr_admin", "hr_executive"].includes(user.role);
  const { register, handleSubmit, reset } = useForm<FormValues>();

  const load = () => api.get<Holiday[]>("/api/holidays").then(setRows);
  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await api.post("/api/holidays", values);
      setOpen(false);
      reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  const remove = async (id: number) => {
    await api.delete(`/api/holidays/${id}`);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Holiday Calendar"
        description="Company-wide holidays."
        actions={canManage && <Button onClick={() => setOpen(true)}>+ Add Holiday</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState message="No holidays configured." />
      ) : (
        <Table headers={["Name", "Date", "Type", canManage ? "Actions" : ""]}>
          {rows.map((h) => (
            <tr key={h.id}>
              <td className="px-4 py-3 font-medium text-slate-900">{h.name}</td>
              <td className="px-4 py-3 text-slate-600">{h.date}</td>
              <td className="px-4 py-3">
                <Badge tone={h.isOptional ? "amber" : "indigo"}>{h.isOptional ? "Optional" : "Mandatory"}</Badge>
              </td>
              <td className="px-4 py-3">
                {canManage && (
                  <button onClick={() => remove(h.id)} className="text-red-600 hover:underline">
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add holiday">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Name">
            <input className={inputClass} {...register("name", { required: true })} />
          </Field>
          <Field label="Date">
            <input type="date" className={inputClass} {...register("date", { required: true })} />
          </Field>
          <Field label="Description">
            <textarea className={inputClass} {...register("description")} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" {...register("isOptional")} /> Optional holiday
          </label>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">
            Add
          </Button>
        </form>
      </Modal>
    </div>
  );
}
