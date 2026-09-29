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
import { exportToCsv } from "@/lib/export";

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
  const [approvedUser, setApprovedUser] = useState<{ name: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
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
      setApprovedUser({
        name: `${approveModal.firstName} ${approveModal.lastName}`,
        email: approveModal.email,
      });
      setCopied(false);
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

  const copyToClipboard = () => {
    if (!setupLink) return;
    navigator.clipboard.writeText(setupLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    exportToCsv("registration-requests", rows, [
      { header: "First Name", accessor: "firstName" },
      { header: "Last Name", accessor: "lastName" },
      { header: "Email", accessor: "email" },
      { header: "Phone", accessor: (r) => r.phone ?? "" },
      { header: "Status", accessor: "status" },
      { header: "Assigned Code", accessor: (r) => r.assignedEmployeeCode ?? "" },
      { header: "Submitted Date", accessor: (r) => new Date(r.createdAt).toLocaleDateString() },
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Registration Requests"
        description="Review and approve employee self-registration requests."
        actions={
          <div className="flex items-center gap-3">
            {rows.length > 0 && (
              <Button variant="secondary" onClick={handleExport}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export CSV
              </Button>
            )}
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
          </div>
        }
      />

      {/* Setup link banner */}
      {setupLink && (
        <div className="mb-6 animate-fade-in-up">
          <Card className="relative overflow-hidden border-emerald-200 bg-emerald-50 p-5">
            <button
              onClick={() => setSetupLink(null)}
              className="absolute top-3 right-3 text-emerald-400 hover:text-emerald-600"
            >
              ✕
            </button>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                ✓
              </span>
              <p className="text-sm font-semibold text-emerald-900">
                {approvedUser?.name || "Employee"} approved successfully!
              </p>
            </div>
            <p className="mt-2 text-xs text-emerald-700">
              Share the personalized onboarding setup link with <strong>{approvedUser?.email}</strong>:
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-[280px] rounded-lg bg-white px-3 py-2 text-xs font-mono text-emerald-800 border border-emerald-200 break-all">
                {setupLink}
              </code>
              <Button
                variant="secondary"
                onClick={copyToClipboard}
                className="shrink-0"
              >
                {copied ? "✓ Copied!" : "Copy URL"}
              </Button>
              {approvedUser && (
                <a
                  href={`mailto:${approvedUser.email}?subject=${encodeURIComponent("Welcome to VolkssKatt — Complete Your Account Setup")}&body=${encodeURIComponent(`Hello ${approvedUser.name},\n\nYour employee account request at VolkssKatt has been approved!\n\nPlease complete your account profile and password setup by clicking the secure link below:\n${setupLink}\n\nBest regards,\nVolkssKatt HR Team`)}`}
                  className="brand-gradient-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-95"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  Send Email Invite
                </a>
              )}
            </div>
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
                  {r.phone && <p className="text-xs text-slate-400">{r.phone}</p>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge tone={TONE_MAP[r.status]}>{r.status}</Badge>

                {r.status === "approved" && r.assignedEmployeeCode && (
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {r.assignedEmployeeCode}
                  </span>
                )}

                {r.status === "rejected" && r.rejectionReason && (
                  <span className="text-xs text-red-500 max-w-xs truncate" title={r.rejectionReason}>
                    {r.rejectionReason}
                  </span>
                )}

                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setApproveModal(r);
                        approveForm.setValue("employeeCode", `EMP-${String(r.id).padStart(4, "0")}`);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setRejectModal(r)}
                    >
                      Reject
                    </Button>
                  </div>
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
        <form onSubmit={approveForm.handleSubmit(handleApprove)} className="space-y-4">
          <Field label="Employee Code" required>
            <input
              className={inputClass}
              {...approveForm.register("employeeCode", { required: true })}
              placeholder="e.g. EMP-0042"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Department">
              <select className={inputClass} {...approveForm.register("departmentId")}>
                <option value="">-- select department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Designation">
              <select className={inputClass} {...approveForm.register("designationId")}>
                <option value="">-- select designation --</option>
                {designations
                  .filter((d) => !selectedDept || d.departmentId === Number(selectedDept))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Assigned Role" required>
              <select className={inputClass} {...approveForm.register("role", { required: true })}>
                <option value="employee">Employee</option>
                <option value="hr_executive">HR Executive</option>
                <option value="hr_admin">HR Admin</option>
                <option value="department_manager">Department Manager</option>
                <option value="team_lead">Team Lead</option>
                <option value="finance_admin">Finance Admin</option>
                <option value="training_admin">Training Admin</option>
                <option value="trainer">Trainer</option>
                <option value="auditor">Auditor</option>
              </select>
            </Field>

            <Field label="Date of Joining" required>
              <input
                type="date"
                className={inputClass}
                {...approveForm.register("dateOfJoining", { required: true })}
              />
            </Field>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setApproveModal(null)}>
              Cancel
            </Button>
            <Button type="submit">Approve & Generate Setup Link</Button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title={`Reject ${rejectModal?.firstName} ${rejectModal?.lastName}`}
      >
        <form onSubmit={rejectForm.handleSubmit(handleReject)} className="space-y-4">
          <Field label="Reason for Rejection" required>
            <textarea
              className={inputClass + " min-h-[80px]"}
              {...rejectForm.register("reason", { required: true })}
              placeholder="Explain why this request is being rejected..."
            />
          </Field>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setRejectModal(null)}>
              Cancel
            </Button>
            <Button type="submit">Confirm Rejection</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
