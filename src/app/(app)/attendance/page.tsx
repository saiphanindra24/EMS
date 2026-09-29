"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { PageHeader, Table, Badge, EmptyState, Button } from "@/components/ui";
import { exportToCsv } from "@/lib/export";

interface AttendanceRow {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workingHours: string;
  overtimeHours: string;
  lateMinutes: number;
  status: string;
}

const TONE: Record<string, "green" | "red" | "amber" | "indigo" | "slate"> = {
  present: "green",
  absent: "red",
  half_day: "amber",
  late: "amber",
  work_from_home: "indigo",
  on_leave: "slate",
  holiday: "slate",
};

export default function AttendancePage() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  useEffect(() => {
    api.get<AttendanceRow[]>("/api/attendance").then(setRows);
  }, []);

  const handleExport = () => {
    exportToCsv("attendance-history", rows, [
      { header: "Date", accessor: "date" },
      { header: "Check In", accessor: (r) => (r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "") },
      { header: "Check Out", accessor: (r) => (r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "") },
      { header: "Working Hours", accessor: "workingHours" },
      { header: "Overtime Hours", accessor: "overtimeHours" },
      { header: "Late (Minutes)", accessor: "lateMinutes" },
      { header: "Status", accessor: "status" },
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Check-in/out history with computed working & overtime hours."
        actions={
          rows.length > 0 ? (
            <Button variant="secondary" onClick={handleExport}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </Button>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <EmptyState message="No attendance records yet. Check in from the dashboard to get started." />
      ) : (
        <Table headers={["Date", "Check In", "Check Out", "Working Hrs", "Overtime", "Late (min)", "Status"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-slate-700">{r.date}</td>
              <td className="px-4 py-3 text-slate-600">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "-"}</td>
              <td className="px-4 py-3 text-slate-600">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "-"}</td>
              <td className="px-4 py-3 text-slate-600">{r.workingHours}</td>
              <td className="px-4 py-3 text-slate-600">{r.overtimeHours}</td>
              <td className="px-4 py-3 text-slate-600">{r.lateMinutes}</td>
              <td className="px-4 py-3">
                <Badge tone={TONE[r.status] ?? "slate"}>{r.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
