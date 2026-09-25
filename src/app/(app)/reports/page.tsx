"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader, Card, Table, EmptyState } from "@/components/ui";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api
      .get<{ breakdown: ReportRow[] }>(`/api/reports?type=${type}`)
      .then((res) => setRows(res.breakdown))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Failed to load report"));
  }, [type]);

  const headers = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div>
      <PageHeader title="Reports" description="Cross-module aggregate reports for HR, Finance, and Training Admin roles." />
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map((r) => (
            <button
              key={r.value}
              onClick={() => setType(r.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                type === r.value ? "brand-gradient-btn text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Card>

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {rows.length === 0 ? (
        <EmptyState message="No data available for this report." />
      ) : (
        <Table headers={headers}>
          {rows.map((row, i) => (
            <tr key={i}>
              {headers.map((h) => (
                <td key={h} className="px-4 py-3 text-slate-700">
                  {String(row[h] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
