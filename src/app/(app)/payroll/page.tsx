"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Table, Button, Modal, Field, inputClass, EmptyState, Card } from "@/components/ui";
import { exportToCsv } from "@/lib/export";
import { PayslipModal, type PayslipData } from "@/components/PayslipModal";

interface Payslip extends PayslipData {}

const FINANCE_ROLES = ["super_admin", "finance_admin", "hr_admin"];

export default function PayrollPage() {
  const { user, employee } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [structureOpen, setStructureOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
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

  const handleExport = () => {
    exportToCsv("payroll-summary", payslips, [
      { header: "Employee ID", accessor: "employeeId" },
      { header: "Basic Salary", accessor: "basic" },
      { header: "Allowances", accessor: "allowances" },
      { header: "Deductions", accessor: "deductions" },
      { header: "Gross Salary", accessor: "grossSalary" },
      { header: "Net Salary", accessor: "netSalary" },
      { header: "Present Days", accessor: "presentDays" },
      { header: "LOP Days", accessor: "lopDays" },
      { header: "Status", accessor: "status" },
      { header: "Generated Date", accessor: (p) => new Date(p.generatedAt).toLocaleDateString() },
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Payroll"
        description={canManage ? "Salary structures, payroll processing, and payslips." : "Your payslip history."}
        actions={
          <div className="flex gap-2">
            {payslips.length > 0 && (
              <Button variant="secondary" onClick={handleExport}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export CSV
              </Button>
            )}
            {canManage && (
              <>
                <Button variant="secondary" onClick={() => setStructureOpen(true)}>
                  Set salary structure
                </Button>
                <Button onClick={() => setRunOpen(true)}>Run payroll</Button>
              </>
            )}
          </div>
        }
      />
      {msg && <Card className="mb-4 border-emerald-200 bg-emerald-50 text-sm text-emerald-700">{msg}</Card>}

      {payslips.length === 0 ? (
        <EmptyState message="No payslips generated yet." />
      ) : (
        <Table headers={["Employee ID", "Basic", "Allowances", "Deductions", "Gross", "Net", "Present", "LOP", "Date", "Action"]}>
          {payslips.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 text-slate-600">{p.employeeId}</td>
              <td className="px-4 py-3 text-slate-600">${p.basic}</td>
              <td className="px-4 py-3 text-slate-600">${p.allowances}</td>
              <td className="px-4 py-3 text-slate-600">${p.deductions}</td>
              <td className="px-4 py-3 text-slate-600">${p.grossSalary}</td>
              <td className="px-4 py-3 font-semibold text-emerald-700">${p.netSalary}</td>
              <td className="px-4 py-3 text-slate-600">{p.presentDays}d</td>
              <td className="px-4 py-3 text-slate-600">{p.lopDays}d</td>
              <td className="px-4 py-3 text-slate-500">{new Date(p.generatedAt).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <Button size="sm" variant="secondary" onClick={() => setSelectedPayslip(p)}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  View / Print
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Salary Structure Modal */}
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

      {/* Process Payroll Modal */}
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

      {/* Printable Payslip Modal */}
      <PayslipModal
        open={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        payslip={selectedPayslip}
      />
    </div>
  );
}
