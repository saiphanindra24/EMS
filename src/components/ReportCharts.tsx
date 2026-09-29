"use client";

import { useMemo } from "react";

interface Props {
  type: string;
  data: Record<string, unknown>[];
}

const COLORS = [
  "from-violet-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-blue-500 to-cyan-600",
  "from-rose-500 to-pink-600",
  "from-purple-500 to-fuchsia-600",
];

const BADGE_COLORS: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-800 border-emerald-200",
  absent: "bg-rose-100 text-rose-800 border-rose-200",
  half_day: "bg-amber-100 text-amber-800 border-amber-200",
  late: "bg-orange-100 text-orange-800 border-orange-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  completed: "bg-indigo-100 text-indigo-800 border-indigo-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  enrolled: "bg-slate-100 text-slate-800 border-slate-200",
};

export function ReportCharts({ type, data }: Props) {
  if (!data || data.length === 0) return null;

  // 1. Headcount Breakdown Chart
  if (type === "headcount") {
    const items = data.map((d) => ({
      label: String(d.department || "Unknown"),
      value: Number(d.total || 0),
    }));
    const maxVal = Math.max(...items.map((i) => i.value), 1);
    const totalHeadcount = items.reduce((sum, i) => sum + i.value, 0);

    return (
      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900">Department Headcount Distribution</h3>
            <p className="text-xs text-slate-500">Active personnel by department</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-violet-700">{totalHeadcount}</span>
            <p className="text-[11px] font-medium text-slate-400">Total Active</p>
          </div>
        </div>

        <div className="grid gap-3 pt-2">
          {items.map((item, idx) => {
            const pct = Math.round((item.value / totalHeadcount) * 100) || 0;
            const barWidth = Math.round((item.value / maxVal) * 100);
            return (
              <div key={item.label} className="group">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">{item.label}</span>
                  <span className="text-slate-500 font-mono">{item.value} ({pct}%)</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${COLORS[idx % COLORS.length]} transition-all duration-500 group-hover:opacity-90`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. Attendance Breakdown Chart
  if (type === "attendance") {
    const items = data.map((d) => ({
      label: String(d.status || "Unknown").replace(/_/g, " "),
      status: String(d.status || ""),
      value: Number(d.total || 0),
    }));
    const totalLogs = items.reduce((sum, i) => sum + i.value, 0);

    return (
      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900">Attendance Status Distribution</h3>
            <p className="text-xs text-slate-500">Check-in statuses recorded</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-slate-900">{totalLogs}</span>
            <p className="text-[11px] font-medium text-slate-400">Total Records</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
          {items.map((item) => {
            const pct = Math.round((item.value / totalLogs) * 100) || 0;
            const badgeClass = BADGE_COLORS[item.status] || "bg-slate-100 text-slate-700";
            return (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center">
                <span className={`inline-block rounded-lg border px-2.5 py-0.5 text-xs font-semibold capitalize ${badgeClass}`}>
                  {item.label}
                </span>
                <p className="mt-2 text-xl font-bold text-slate-900">{item.value}</p>
                <p className="text-[10px] text-slate-400 font-mono">{pct}% of total</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. Payroll Expense Summary Chart
  if (type === "payroll") {
    const items = data.map((d) => ({
      label: `${d.month}/${d.year}`,
      net: parseFloat(String(d.totalNet || "0")) || 0,
      gross: parseFloat(String(d.totalGross || "0")) || 0,
      headcount: Number(d.headcount || 0),
    }));
    const maxGross = Math.max(...items.map((i) => i.gross), 1);
    const totalDisbursed = items.reduce((sum, i) => sum + i.net, 0);

    return (
      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900">Monthly Payroll Disbursements</h3>
            <p className="text-xs text-slate-500">Gross & Net salary expenses by run</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-emerald-600">
              ${totalDisbursed.toLocaleString("en-US", { minimumFractionDigits: 0 })}
            </span>
            <p className="text-[11px] font-medium text-slate-400">Total Net Disbursed</p>
          </div>
        </div>

        <div className="grid gap-3 pt-2">
          {items.map((item) => {
            const barWidth = Math.round((item.gross / maxGross) * 100);
            return (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/30 p-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-bold text-slate-800">Pay Period: {item.label} ({item.headcount} employees)</span>
                  <span className="font-mono text-emerald-700 font-semibold">Net: ${item.net.toLocaleString()} / Gross: ${item.gross.toLocaleString()}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 4. Training Completion Chart
  if (type === "training") {
    const items = data.map((d) => ({
      title: String(d.trainingTitle || "Unknown"),
      status: String(d.status || ""),
      value: Number(d.total || 0),
    }));
    const totalEnrollments = items.reduce((sum, i) => sum + i.value, 0);

    return (
      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900">Training Program Enrollments & Outcomes</h3>
            <p className="text-xs text-slate-500">Breakdown by course and status</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-indigo-600">{totalEnrollments}</span>
            <p className="text-[11px] font-medium text-slate-400">Total Enrollments</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          {items.map((item, idx) => (
            <div key={`${item.title}-${item.status}-${idx}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
              <div>
                <p className="font-semibold text-slate-800">{item.title}</p>
                <span className={`inline-block mt-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${BADGE_COLORS[item.status] || "bg-slate-200 text-slate-700"}`}>
                  {item.status}
                </span>
              </div>
              <span className="font-mono text-base font-bold text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 5. Leave Breakdown
  if (type === "leave") {
    const items = data.map((d) => ({
      type: String(d.leaveType || "Unknown"),
      status: String(d.status || ""),
      value: Number(d.total || 0),
    }));
    const totalLeaves = items.reduce((sum, i) => sum + i.value, 0);

    return (
      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900">Leave Applications by Category & Status</h3>
            <p className="text-xs text-slate-500">Breakdown of leave requests</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-amber-600">{totalLeaves}</span>
            <p className="text-[11px] font-medium text-slate-400">Total Requests</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {items.map((item, idx) => (
            <div key={`${item.type}-${item.status}-${idx}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
              <div>
                <p className="font-semibold text-slate-800">{item.type}</p>
                <span className={`inline-block mt-1 rounded-md px-2 py-0.5 text-[10px] font-bold capitalize ${BADGE_COLORS[item.status] || "bg-slate-200 text-slate-700"}`}>
                  {item.status}
                </span>
              </div>
              <span className="font-mono text-base font-bold text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
