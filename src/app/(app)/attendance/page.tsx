"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { PageHeader, Table, Badge, EmptyState } from "@/components/ui";

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

  return (
    <div>
      <PageHeader title="Attendance" description="Check-in/out history with computed working & overtime hours." />
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
