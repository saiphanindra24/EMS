"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Modal,
  Field,
  inputClass,
  EmptyState,
} from "@/components/ui";

interface RegistrationRow {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  assignedEmployeeCode: string | null;
  createdAt: string;
}

interface Dept {
  id: number;
  name: string;
}
interface Desig {
  id: number;
  title: string;
  departmentId: number;
}

interface ApproveForm {
  employeeCode: string;
  departmentId: string;
  designationId: string;
  role: string;
  dateOfJoining: string;
}

interface RejectForm {
  reason: string;
}

const TONE_MAP: Record<string, "green" | "amber" | "red"> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
};

export default function RegistrationsPage() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [designations, setDesignations] = useState<Desig[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [approveModal, setApproveModal] = useState<RegistrationRow | null>(null);
  const [rejectModal, setRejectModal] = useState<RegistrationRow | null>(null);
  const [setupLink, setSetupLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approveForm = useForm<ApproveForm>({
    defaultValues: {
      role: "employee",
      dateOfJoining: new Date().toISOString().slice(0, 10),
    },
  });
  const rejectForm = useForm<RejectForm>();
  const selectedDept = approveForm.watch("departmentId");

  const load = async () => {
    const data = await api.get<{
      requests: RegistrationRow[];
      departments: Dept[];
      designations: Desig[];
    }>("/api/admin/registrations");
    setRows(data.requests);
    setDepartments(data.departments);
    setDesignations(data.designations);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);

  const handleApprove = async (values: ApproveForm) => {
    if (!approveModal) return;
    setError(null);
    try {
      const data = await api.post<{
        setupToken: string;
        setupUrl: string;
      }>(`/api/admin/registrations/${approveModal.id}/approve`, {
        ...values,
        departmentId: values.departmentId ? Number(values.departmentId) : null,
        designationId: values.designationId
          ? Number(values.designationId)
          : null,
      });
      setSetupLink(`${window.location.origin}${data.setupUrl}`);
      setApproveModal(null);
      approveForm.reset();
      load();
    } catch (e) {
      setError(
        e instanceof ApiClientError ? e.message : "Failed to approve",
      );
    }
  };

  const handleReject = async (values: RejectForm) => {
    if (!rejectModal) return;
    setError(null);
    try {
      await api.post(`/api/admin/registrations/${rejectModal.id}/reject`, {
        reason: values.reason,
      });
      setRejectModal(null);
      rejectForm.reset();
      load();
    } catch (e) {
      setError(
        e instanceof ApiClientError ? e.message : "Failed to reject",
      );
    }
  };

  return (
    <div>
      <PageHeader
        title="Registration Requests"
        description="Review and approve employee registration requests."
        actions={
          <div className="flex gap-1.5">
            {(["all", "pending", "approved", "rejected"] as const).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                    filter === f
                      ? "bg-violet-100 text-violet-700"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {f}
                  {f !== "all" && (
                    <span className="ml-1.5 text-[10px]">
                      ({rows.filter((r) => r.status === f).length})
                    </span>
                  )}
                </button>
              ),
            )}
          </div>
        }
      />

      {/* Setup link banner */}
      {setupLink && (
        <div className="mb-6 animate-fade-in-up">
          <Card className="relative overflow-hidden border-emerald-200 bg-emerald-50">
            <button
              onClick={() => setSetupLink(null)}
              className="absolute top-3 right-3 text-emerald-400 hover:text-emerald-600"
            >
              ✕
            </button>
            <p className="text-sm font-semibold text-emerald-900">
              ✅ Employee approved! Share this setup link:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-white px-3 py-2 text-xs font-mono text-emerald-800 border border-emerald-200 break-all">
                {setupLink}
              </code>
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(setupLink)}
                className="shrink-0"
              >
                Copy
              </Button>
            </div>
            <p className="mt-2 text-xs text-emerald-600">
              The employee will use this link to set their password and fill in their details.
            </p>
          </Card>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          message={
            filter === "pending"
              ? "No pending registration requests."
              : "No registration requests found."
          }
        />
      ) : (
        <div className="grid gap-3 stagger-children">
          {filtered.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 text-sm font-bold text-violet-700">
                  {r.firstName[0]}
                  {r.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{r.email}</p>
                  {r.phone && (
                    <p className="text-xs text-slate-400">📞 {r.phone}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <Badge tone={TONE_MAP[r.status]}>{r.status}</Badge>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                  {r.assignedEmployeeCode && (
                    <p className="text-[10px] font-mono text-slate-400">
                      {r.assignedEmployeeCode}
                    </p>
                  )}
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setApproveModal(r);
                        setError(null);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        setRejectModal(r);
                        setError(null);
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                )}
                {r.status === "rejected" && r.rejectionReason && (
                  <p className="max-w-[200px] text-xs text-red-500 italic">
                    &quot;{r.rejectionReason}&quot;
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        open={!!approveModal}
        onClose={() => setApproveModal(null)}
        title={`Approve ${approveModal?.firstName} ${approveModal?.lastName}`}
      >
        <form
          onSubmit={approveForm.handleSubmit(handleApprove)}
          className="space-y-4"
        >
          <Field label="Employee Code">
            <input
              className={inputClass}
              placeholder="e.g. EMP-0001"
              {...approveForm.register("employeeCode", { required: true })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Department">
              <select
                className={inputClass}
                {...approveForm.register("departmentId")}
              >
                <option value="">— select —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Designation">
              <select
                className={inputClass}
                {...approveForm.register("designationId")}
              >
                <option value="">— select —</option>
                {designations
                  .filter(
                    (d) =>
                      !selectedDept ||
                      String(d.departmentId) === selectedDept,
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Role">
              <select className={inputClass} {...approveForm.register("role")}>
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
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date of Joining">
              <input
                type="date"
                className={inputClass}
                {...approveForm.register("dateOfJoining", { required: true })}
              />
            </Field>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200/50">
              <span>⚠️</span> {error}
            </div>
          )}
          <Button type="submit" className="w-full">
            Approve & Create Account
          </Button>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title={`Reject ${rejectModal?.firstName} ${rejectModal?.lastName}?`}
      >
        <form
          onSubmit={rejectForm.handleSubmit(handleReject)}
          className="space-y-4"
        >
          <Field label="Reason for rejection">
            <textarea
              className={inputClass + " resize-none"}
              rows={3}
              placeholder="Please provide a reason..."
              {...rejectForm.register("reason", { required: true })}
            />
          </Field>
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200/50">
              <span>⚠️</span> {error}
            </div>
          )}
          <Button type="submit" variant="danger" className="w-full">
            Reject Registration
          </Button>
        </form>
      </Modal>
    </div>
  );
}
