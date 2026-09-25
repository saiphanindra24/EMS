"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Table, Badge, Button, Modal, Field, inputClass, EmptyState, Card } from "@/components/ui";

interface Payslip {
  id: number;
  employeeId: number;
  basic: string;
  allowances: string;
  deductions: string;
  grossSalary: string;
  netSalary: string;
  presentDays: string;
  lopDays: string;
  status: string;
  generatedAt: string;
}

const FINANCE_ROLES = ["super_admin", "finance_admin", "hr_admin"];

export default function PayrollPage() {
  const { user, employee } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [structureOpen, setStructureOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const canManage = user && FINANCE_ROLES.includes(user.role);

  const structureForm = useForm<{
    employeeId: string;
    basic: string;
    hra: string;
    conveyance: string;
    specialAllowance: string;
    providentFund: string;
    effectiveFrom: string;
  }>();
  const runForm = useForm<{ month: string; year: string }>({
    defaultValues: { month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()) },
  });

  const load = () => api.get<Payslip[]>("/api/payroll/payslips").then(setPayslips);
  useEffect(() => {
    load();
  }, []);

  const saveStructure = async (v: Record<string, string>) => {
    setError(null);
    try {
      await api.post("/api/payroll/structures", {
        employeeId: Number(v.employeeId),
        basic: Number(v.basic),
        hra: Number(v.hra || 0),
        conveyance: Number(v.conveyance || 0),
        specialAllowance: Number(v.specialAllowance || 0),
        providentFund: Number(v.providentFund || 0),
        effectiveFrom: v.effectiveFrom,
      });
      setStructureOpen(false);
      structureForm.reset();
      setMsg("Salary structure saved.");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  const runPayroll = async (v: { month: string; year: string }) => {
    setError(null);
    try {
      await api.post("/api/payroll/run", { month: Number(v.month), year: Number(v.year) });
      setRunOpen(false);
      setMsg("Payroll processed successfully.");
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Payroll"
        description={canManage ? "Salary structures, payroll processing, and payslips." : "Your payslip history."}
        actions={
          canManage && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStructureOpen(true)}>
                Set salary structure
              </Button>
              <Button onClick={() => setRunOpen(true)}>Run payroll</Button>
            </div>
          )
        }
      />
      {msg && <Card className="mb-4 border-emerald-200 bg-emerald-50 text-sm text-emerald-700">{msg}</Card>}

      {payslips.length === 0 ? (
        <EmptyState message="No payslips generated yet." />
      ) : (
        <Table headers={["Employee ID", "Basic", "Allowances", "Deductions", "Gross", "Net", "Present Days", "LOP Days", "Generated"]}>
          {payslips.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 text-slate-600">{p.employeeId}</td>
              <td className="px-4 py-3 text-slate-600">{p.basic}</td>
              <td className="px-4 py-3 text-slate-600">{p.allowances}</td>
              <td className="px-4 py-3 text-slate-600">{p.deductions}</td>
              <td className="px-4 py-3 text-slate-600">{p.grossSalary}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{p.netSalary}</td>
              <td className="px-4 py-3 text-slate-600">{p.presentDays}</td>
              <td className="px-4 py-3 text-slate-600">{p.lopDays}</td>
              <td className="px-4 py-3 text-slate-500">{new Date(p.generatedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={structureOpen} onClose={() => setStructureOpen(false)} title="Set salary structure">
        <form onSubmit={structureForm.handleSubmit(saveStructure)} className="space-y-3">
          <Field label="Employee ID">
            <input className={inputClass} {...structureForm.register("employeeId", { required: true })} defaultValue={String(employee?.id ?? "")} />
          </Field>
          <Field label="Basic">
            <input className={inputClass} {...structureForm.register("basic", { required: true })} />
          </Field>
          <Field label="HRA">
            <input className={inputClass} {...structureForm.register("hra")} />
          </Field>
          <Field label="Conveyance">
            <input className={inputClass} {...structureForm.register("conveyance")} />
          </Field>
          <Field label="Special allowance">
            <input className={inputClass} {...structureForm.register("specialAllowance")} />
          </Field>
          <Field label="Provident fund (deduction)">
            <input className={inputClass} {...structureForm.register("providentFund")} />
          </Field>
          <Field label="Effective from">
            <input type="date" className={inputClass} {...structureForm.register("effectiveFrom", { required: true })} />
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">
            Save
          </Button>
        </form>
      </Modal>

      <Modal open={runOpen} onClose={() => setRunOpen(false)} title="Process payroll">
        <form onSubmit={runForm.handleSubmit(runPayroll)} className="space-y-3">
          <Field label="Month (1-12)">
            <input className={inputClass} {...runForm.register("month", { required: true })} />
          </Field>
          <Field label="Year">
            <input className={inputClass} {...runForm.register("year", { required: true })} />
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">
            Process
          </Button>
        </form>
      </Modal>
    </div>
  );
}
