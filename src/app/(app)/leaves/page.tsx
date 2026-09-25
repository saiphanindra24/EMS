"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Table, Badge, Button, Modal, Field, inputClass, EmptyState, Card } from "@/components/ui";

interface LeaveType {
  id: number;
  name: string;
  code: string;
}
interface LeaveBalance {
  id: number;
  leaveTypeName: string;
  allocated: string;
  used: string;
}
interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeLastName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: string;
  reason: string | null;
  status: string;
  approverComment: string | null;
}

interface ApplyForm {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

const TONE: Record<string, "green" | "red" | "amber" | "slate"> = {
  approved: "green",
  rejected: "red",
  pending: "amber",
  cancelled: "slate",
};

const APPROVER_ROLES = ["super_admin", "hr_admin", "hr_executive", "department_manager", "team_lead"];

export default function LeavesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<ApplyForm>();
  const canApprove = user && APPROVER_ROLES.includes(user.role);

  const load = () => {
    api.get<LeaveRequest[]>("/api/leaves").then(setRows);
    api.get<LeaveBalance[]>("/api/leave-balances").then(setBalances);
  };

  useEffect(() => {
    load();
    api.get<LeaveType[]>("/api/leave-types").then(setLeaveTypes);
  }, []);

  const onSubmit = async (values: ApplyForm) => {
    setError(null);
    try {
      await api.post("/api/leaves", { ...values, leaveTypeId: Number(values.leaveTypeId) });
      setOpen(false);
      reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to apply");
    }
  };

  const decide = async (id: number, action: "approve" | "reject" | "cancel") => {
    try {
      await api.patch(`/api/leaves/${id}`, { action });
      load();
    } catch (e) {
      alert(e instanceof ApiClientError ? e.message : "Action failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Leave Management"
        description="Apply, track, and (if authorized) approve leave requests."
        actions={<Button onClick={() => setOpen(true)}>+ Apply for leave</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {balances.map((b) => (
          <Card key={b.id}>
            <p className="text-xs font-medium uppercase text-slate-400">{b.leaveTypeName}</p>
            <p className="text-lg font-bold text-slate-900">
              {Number(b.allocated) - Number(b.used)} <span className="text-xs font-normal text-slate-400">/ {b.allocated} left</span>
            </p>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No leave requests yet." />
      ) : (
        <Table headers={["Employee", "Type", "Dates", "Days", "Status", "Reason", "Actions"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-slate-700">
                {r.employeeName} {r.employeeLastName}
              </td>
              <td className="px-4 py-3 text-slate-600">{r.leaveTypeName}</td>
              <td className="px-4 py-3 text-slate-600">
                {r.startDate} → {r.endDate}
              </td>
              <td className="px-4 py-3 text-slate-600">{r.days}</td>
              <td className="px-4 py-3">
                <Badge tone={TONE[r.status] ?? "slate"}>{r.status}</Badge>
              </td>
              <td className="px-4 py-3 text-slate-500">{r.reason ?? "-"}</td>
              <td className="px-4 py-3 space-x-2">
                {r.status === "pending" && canApprove && (
                  <>
                    <button onClick={() => decide(r.id, "approve")} className="text-emerald-600 hover:underline">
                      Approve
                    </button>
                    <button onClick={() => decide(r.id, "reject")} className="text-red-600 hover:underline">
                      Reject
                    </button>
                  </>
                )}
                {r.status === "pending" && (
                  <button onClick={() => decide(r.id, "cancel")} className="text-slate-500 hover:underline">
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Apply for leave">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Leave type">
            <select className={inputClass} {...register("leaveTypeId", { required: true })}>
              <option value="">-- select --</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date">
            <input type="date" className={inputClass} {...register("startDate", { required: true })} />
          </Field>
          <Field label="End date">
            <input type="date" className={inputClass} {...register("endDate", { required: true })} />
          </Field>
          <Field label="Reason">
            <textarea className={inputClass} {...register("reason")} />
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">
            Submit request
          </Button>
        </form>
      </Modal>
    </div>
  );
}
