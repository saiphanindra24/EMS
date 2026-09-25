"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Table, Badge, Button, Modal, Field, inputClass, EmptyState } from "@/components/ui";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, PASSWORD_TOO_SHORT } from "@/lib/password";

interface EmployeeRow {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  departmentName: string | null;
  designationTitle: string | null;
  employmentStatus: string;
  employmentType: string;
}

interface Department {
  id: number;
  name: string;
}
interface Designation {
  id: number;
  title: string;
  departmentId: number;
}

interface CreateForm {
  email: string;
  password: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  dateOfJoining: string;
  departmentId: string;
  designationId: string;
  role: string;
}

const HR_ROLES = ["super_admin", "hr_admin", "hr_executive"];

export default function EmployeesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCreate = user && HR_ROLES.includes(user.role);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateForm>({
    defaultValues: { role: "employee" },
  });
  const selectedDept = watch("departmentId");

  const load = async (q?: string) => {
    const res = await api.get<{ items: EmployeeRow[] }>(`/api/employees${q ? `?search=${q}` : ""}`);
    setRows(res.items);
  };

  useEffect(() => {
    load();
    api.get<Department[]>("/api/departments").then(setDepartments);
    api.get<Designation[]>("/api/designations").then(setDesignations);
  }, []);

  const onSubmit = async (values: CreateForm) => {
    setError(null);
    try {
      await api.post("/api/employees", {
        ...values,
        departmentId: values.departmentId ? Number(values.departmentId) : null,
        designationId: values.designationId ? Number(values.designationId) : null,
      });
      setOpen(false);
      reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to create employee");
    }
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Directory scoped to your role's visibility."
        actions={
          <div className="flex gap-2">
            <input
              placeholder="Search name or code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                load(e.target.value);
              }}
              className={inputClass + " w-56"}
            />
            {canCreate && <Button onClick={() => setOpen(true)}>+ New Employee</Button>}
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="No employees found." />
      ) : (
        <Table headers={["Code", "Name", "Department", "Designation", "Type", "Status", ""]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.employeeCode}</td>
              <td className="px-4 py-3 font-medium text-slate-900">
                {r.firstName} {r.lastName}
              </td>
              <td className="px-4 py-3 text-slate-600">{r.departmentName ?? "-"}</td>
              <td className="px-4 py-3 text-slate-600">{r.designationTitle ?? "-"}</td>
              <td className="px-4 py-3 text-slate-600">{r.employmentType}</td>
              <td className="px-4 py-3">
                <Badge tone={r.employmentStatus === "active" ? "green" : "red"}>{r.employmentStatus}</Badge>
              </td>
              <td className="px-4 py-3">
                <Link href={`/employees/${r.id}`} className="text-violet-600 hover:underline">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Onboard new employee">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Employee Code">
            <input className={inputClass} {...register("employeeCode", { required: true })} />
          </Field>
          <Field label="First name">
            <input className={inputClass} {...register("firstName", { required: true })} />
          </Field>
          <Field label="Last name">
            <input className={inputClass} {...register("lastName", { required: true })} />
          </Field>
          <Field label="Login email">
            <input type="email" className={inputClass} {...register("email", { required: true })} />
          </Field>
          <Field label="Temporary password">
            <input type="password" className={inputClass} {...register("password", { required: true, minLength: 8 })} />
          </Field>
          <Field label="Date of joining">
            <input type="date" className={inputClass} {...register("dateOfJoining", { required: true })} />
          </Field>
          <Field label="Department">
            <select className={inputClass} {...register("departmentId")}>
              <option value="">-- select --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Designation">
            <select className={inputClass} {...register("designationId")}>
              <option value="">-- select --</option>
              {designations
                .filter((d) => !selectedDept || String(d.departmentId) === selectedDept)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="System role">
            <select className={inputClass} {...register("role")}>
              {[
                "employee",
                "team_lead",
                "department_manager",
                "hr_executive",
                "hr_admin",
                "finance_admin",
                "training_admin",
                "trainer",
                "auditor",
                "super_admin",
              ].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">
            Create employee
          </Button>
        </form>
      </Modal>
    </div>
  );
}
