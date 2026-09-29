"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader, Card, Table, EmptyState, Button } from "@/components/ui";
import { ReportCharts } from "@/components/ReportCharts";
import { exportToCsv } from "@/lib/export";

interface ReportRow {
  [key: string]: unknown;
}

const REPORT_TYPES = [
  { value: "headcount", label: "Headcount by Department" },
  { value: "attendance", label: "Attendance Breakdown" },
  { value: "leave", label: "Leave Breakdown" },
  { value: "payroll", label: "Payroll Summary" },
  { value: "training", label: "Training Completion" },
];

export default function ReportsPage() {
  const [type, setType] = useState("headcount");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setLoading(true);
    api
      .get<{ breakdown: ReportRow[] }>(`/api/reports?type=${type}`)
      .then((res) => setRows(res.breakdown))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Failed to load report"))
      .finally(() => setLoading(false));
  }, [type]);

  const headers = rows.length ? Object.keys(rows[0]) : [];

  const handleExport = () => {
    if (!rows.length) return;
    exportToCsv(
      `report-${type}`,
      rows,
      headers.map((h) => ({ header: h.charAt(0).toUpperCase() + h.slice(1), accessor: h }))
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Cross-module aggregate insights and KPIs for HR, Finance, and Training Admin."
        actions={
          rows.length > 0 ? (
            <Button variant="secondary" onClick={handleExport}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Report CSV
            </Button>
          ) : undefined
        }
      />

      {/* Report Switcher Tabs */}
      <Card className="p-3">
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map((r) => (
            <button
              key={r.value}
              onClick={() => setType(r.value)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                type === r.value
                  ? "brand-gradient-btn text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Card>

      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {/* Visual Charts Section */}
      {!loading && rows.length > 0 && <ReportCharts type={type} data={rows} />}

      {/* Detailed Data Table */}
      {rows.length === 0 && !loading ? (
        <EmptyState message="No data available for this report type." />
      ) : (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Detailed Data Records</h4>
          <Table headers={headers.map((h) => h.replace(/([A-Z])/g, " $1").toUpperCase())}>
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                {headers.map((h) => (
                  <td key={h} className="px-5 py-3.5 text-slate-700 font-medium">
                    {String(row[h] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
