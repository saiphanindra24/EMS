"use client";

import { useEffect, useState, use as usePromise } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Card, Field, inputClass, Button, Badge } from "@/components/ui";

interface EmployeeDetail {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  personalEmail: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  dateOfJoining: string;
  departmentName: string | null;
  designationTitle: string | null;
  employmentType: string;
  employmentStatus: string;
  workLocation: string;
  shift: string;
  qualification: string | null;
  skills: string[] | null;
  certifications: string[] | null;
  previousExperience: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankIfsc: string | null;
  pan: string | null;
  uan: string | null;
  salary: string | null;
  email: string;
  role: string;
}

const FINANCE_VISIBLE_ROLES = ["super_admin", "hr_admin", "finance_admin"];

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { user, employee: self } = useAuth();
  const [data, setData] = useState<EmployeeDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const res = await api.get<EmployeeDetail>(`/api/employees/${id}`);
    setData(res);
    setForm({
      phone: res.phone ?? "",
      personalEmail: res.personalEmail ?? "",
      address: res.address ?? "",
      emergencyContactName: res.emergencyContactName ?? "",
      emergencyContactPhone: res.emergencyContactPhone ?? "",
      qualification: res.qualification ?? "",
    });
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!data) return <p className="text-slate-400">Loading...</p>;

  const isSelf = self?.id === data.id;
  const canSeeFinancial = user && (FINANCE_VISIBLE_ROLES.includes(user.role) || isSelf);
  const canEdit = user && (["super_admin", "hr_admin", "hr_executive"].includes(user.role) || isSelf);

  const save = async () => {
    setError(null);
    setSaved(false);
    try {
      await api.patch(`/api/employees/${id}`, form);
      setEditing(false);
      setSaved(true);
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to save");
    }
  };

  return (
    <div>
      <PageHeader
        title={`${data.firstName} ${data.lastName}`}
        description={`${data.employeeCode} • ${data.designationTitle ?? "No designation"} • ${data.departmentName ?? "No department"}`}
        actions={
          canEdit && (
            <Button variant={editing ? "secondary" : "primary"} onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : "Edit profile"}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 font-semibold text-slate-900">Personal</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Date of birth" value={data.dateOfBirth ?? "-"} />
            <Row label="Gender" value={data.gender ?? "-"} />
            {editing ? (
              <>
                <Field label="Phone">
                  <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
                <Field label="Personal email">
                  <input
                    className={inputClass}
                    value={form.personalEmail}
                    onChange={(e) => setForm({ ...form, personalEmail: e.target.value })}
                  />
                </Field>
                <Field label="Address">
                  <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </Field>
                <Field label="Emergency contact name">
                  <input
                    className={inputClass}
                    value={form.emergencyContactName}
                    onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                  />
                </Field>
                <Field label="Emergency contact phone">
                  <input
                    className={inputClass}
                    value={form.emergencyContactPhone}
                    onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                  />
                </Field>
              </>
            ) : (
              <>
                <Row label="Phone" value={data.phone ?? "-"} />
                <Row label="Personal email" value={data.personalEmail ?? "-"} />
                <Row label="Address" value={data.address ?? "-"} />
                <Row label="Emergency contact" value={`${data.emergencyContactName ?? "-"} (${data.emergencyContactPhone ?? "-"})`} />
              </>
            )}
          </dl>
        </Card>

        <Card>
          <h3 className="mb-3 font-semibold text-slate-900">Employment</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Login email" value={data.email} />
            <Row label="System role" value={<Badge tone="indigo">{data.role}</Badge>} />
            <Row label="Date of joining" value={data.dateOfJoining} />
            <Row label="Employment type" value={data.employmentType} />
            <Row label="Status" value={<Badge tone={data.employmentStatus === "active" ? "green" : "red"}>{data.employmentStatus}</Badge>} />
            <Row label="Work location" value={data.workLocation} />
            <Row label="Shift" value={data.shift} />
          </dl>
        </Card>

        <Card>
          <h3 className="mb-3 font-semibold text-slate-900">Professional</h3>
          <dl className="space-y-2 text-sm">
            {editing ? (
              <Field label="Qualification">
                <input
                  className={inputClass}
                  value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                />
              </Field>
            ) : (
              <Row label="Qualification" value={data.qualification ?? "-"} />
            )}
            <Row label="Skills" value={(data.skills ?? []).join(", ") || "-"} />
            <Row label="Certifications" value={(data.certifications ?? []).join(", ") || "-"} />
            <Row label="Previous experience" value={data.previousExperience ?? "-"} />
          </dl>
        </Card>

        <Card className={canSeeFinancial ? "" : "opacity-60"}>
          <h3 className="mb-3 font-semibold text-slate-900">Financial (restricted)</h3>
          {canSeeFinancial ? (
            <dl className="space-y-2 text-sm">
              <Row label="Salary" value={data.salary ?? "-"} />
              <Row label="Bank" value={data.bankName ?? "-"} />
              <Row label="Account No." value={data.bankAccountNumber ?? "-"} />
              <Row label="IFSC" value={data.bankIfsc ?? "-"} />
              <Row label="PAN" value={data.pan ?? "-"} />
              <Row label="UAN" value={data.uan ?? "-"} />
            </dl>
          ) : (
            <p className="text-sm text-slate-400">You do not have permission to view financial details.</p>
          )}
        </Card>
      </div>

      {editing && (
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save}>Save changes</Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
      {saved && <p className="mt-2 text-sm text-emerald-600">Profile updated.</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-700">{value}</dd>
    </div>
  );
}
