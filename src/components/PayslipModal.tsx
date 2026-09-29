"use client";

import { Modal, Button } from "./ui";
import { BrandLogo } from "./BrandLogo";

export interface PayslipData {
  id: number;
  employeeId: number;
  employeeName?: string;
  employeeCode?: string;
  department?: string;
  designation?: string;
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

interface Props {
  open: boolean;
  onClose: () => void;
  payslip: PayslipData | null;
}

export function PayslipModal({ open, onClose, payslip }: Props) {
  if (!payslip) return null;

  const handlePrint = () => {
    window.print();
  };

  const basicNum = parseFloat(payslip.basic) || 0;
  const allowancesNum = parseFloat(payslip.allowances) || 0;
  const deductionsNum = parseFloat(payslip.deductions) || 0;
  const grossNum = parseFloat(payslip.grossSalary) || 0;
  const netNum = parseFloat(payslip.netSalary) || 0;

  const dateObj = new Date(payslip.generatedAt);
  const monthYear = dateObj.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <Modal open={open} onClose={onClose} title="Payslip Preview">
      <div className="space-y-6">
        {/* Printable Payslip Card */}
        <div id="printable-payslip" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <BrandLogo className="h-7 w-auto" />
              <p className="mt-1 text-xs text-slate-500">VolkssKatt Technologies Inc. • HR & Payroll</p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-lg bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                Payslip: {monthYear}
              </span>
              <p className="mt-1 text-[11px] text-slate-400">Ref ID: #{payslip.id}</p>
            </div>
          </div>

          {/* Employee & Pay Details */}
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-xs">
            <div>
              <span className="text-slate-400">Employee ID / Code:</span>
              <p className="font-semibold text-slate-900">{payslip.employeeCode || `EMP-#${payslip.employeeId}`}</p>
            </div>
            <div>
              <span className="text-slate-400">Pay Period:</span>
              <p className="font-semibold text-slate-900">{monthYear}</p>
            </div>
            <div>
              <span className="text-slate-400">Present Days:</span>
              <p className="font-semibold text-slate-900">{payslip.presentDays} days</p>
            </div>
            <div>
              <span className="text-slate-400">Loss of Pay (LOP):</span>
              <p className="font-semibold text-slate-900">{payslip.lopDays} days</p>
            </div>
          </div>

          {/* Salary Breakdown Table */}
          <div className="mt-6 grid grid-cols-2 gap-6">
            {/* Earnings */}
            <div className="rounded-xl border border-slate-100 p-3">
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                Earnings
              </h4>
              <div className="mt-2 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Basic Salary</span>
                  <span className="font-medium text-slate-900">${basicNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Allowances</span>
                  <span className="font-medium text-slate-900">${allowancesNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                  <span>Gross Earnings</span>
                  <span>${grossNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="rounded-xl border border-slate-100 p-3">
              <h4 className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-rose-700">
                Deductions
              </h4>
              <div className="mt-2 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Standard Deductions / PF</span>
                  <span className="font-medium text-slate-900">${deductionsNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                  <span>Total Deductions</span>
                  <span>${deductionsNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Salary Banner */}
          <div className="mt-6 flex items-center justify-between rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-white">
            <div>
              <p className="text-xs uppercase tracking-wider text-violet-200">Net Take-Home Pay</p>
              <p className="text-2xl font-bold tracking-tight">
                ${netNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right text-[11px] text-violet-200">
              <span>Status: </span>
              <span className="font-semibold uppercase text-white">{payslip.status}</span>
            </div>
          </div>

          {/* Footer Note */}
          <p className="mt-4 text-center text-[10px] text-slate-400">
            This is a computer-generated payslip and requires no physical signature.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 print:hidden">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-3.414 2.45-6.329 5.86-6.329s6.1 2.915 5.86 6.329m-11.72 0h11.72m-11.72 0L5 18h14l-1.72-4.171M6 18v3h12v-3" />
            </svg>
            Print / Save as PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}
