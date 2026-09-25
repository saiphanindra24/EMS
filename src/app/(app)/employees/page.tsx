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
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                placeholder="Search name or code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  load(e.target.value);
                }}
                className={inputClass + " w-64 pl-9"}
              />
            </div>
            {canCreate && (
              <Button onClick={() => setOpen(true)}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Employee
              </Button>
            )}
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="No employees found." />
      ) : (
        <Table headers={["Code", "Name", "Department", "Designation", "Type", "Status", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className="group transition-colors hover:bg-slate-50/80">
              <td className="px-5 py-4 font-mono text-xs text-slate-500">{r.employeeCode}</td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 text-xs font-bold text-violet-700">
                    {r.firstName[0]}{r.lastName[0]}
                  </div>
                  <span className="font-medium text-slate-900">
                    {r.firstName} {r.lastName}
                  </span>
                </div>
              </td>
              <td className="px-5 py-4 text-slate-600">{r.departmentName ?? "—"}</td>
              <td className="px-5 py-4 text-slate-600">{r.designationTitle ?? "—"}</td>
              <td className="px-5 py-4">
                <span className="text-xs font-medium text-slate-500">{r.employmentType}</span>
              </td>
              <td className="px-5 py-4">
                <Badge tone={r.employmentStatus === "active" ? "green" : "red"}>
                  {r.employmentStatus}
                </Badge>
              </td>
              <td className="px-5 py-4">
                <Link
                  href={`/employees/${r.id}`}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-violet-600 transition-all duration-200 hover:bg-violet-50 hover:text-violet-700"
                >
                  View
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Onboard new employee">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Employee Code">
              <input className={inputClass} {...register("employeeCode", { required: true })} />
            </Field>
            <Field label="Date of joining">
              <input type="date" className={inputClass} {...register("dateOfJoining", { required: true })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name">
              <input className={inputClass} {...register("firstName", { required: true })} />
            </Field>
            <Field label="Last name">
              <input className={inputClass} {...register("lastName", { required: true })} />
            </Field>
          </div>
          <Field label="Login email">
            <input type="email" className={inputClass} {...register("email", { required: true })} />
          </Field>
          <Field label="Temporary password">
            <input type="password" className={inputClass} {...register("password", { required: true, minLength: 8 })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
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
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200/50">
              <span>⚠️</span> {error}
            </div>
          )}
          <Button type="submit" className="w-full">
            Create employee
          </Button>
        </form>
      </Modal>
    </div>
  );
}
