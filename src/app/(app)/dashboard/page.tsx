"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { PageHeader, StatCard, Card, Button } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

interface DashboardResponse {
  role: string;
  widgets: Record<string, unknown>;
}

const LABELS: Record<string, { label: string; icon: string }> = {
  totalEmployees: { label: "Total Employees", icon: "🧑‍💼" },
  totalDepartments: { label: "Departments", icon: "🏢" },
  presentToday: { label: "Present Today", icon: "✅" },
  pendingLeave: { label: "Pending Leave", icon: "🗓️" },
  activeTrainings: { label: "Active Trainings", icon: "🎓" },
  systemActivityLast24h: { label: "Activity (24h)", icon: "🛡️" },
  totalTrainings: { label: "Total Trainings", icon: "🎓" },
  totalEnrollments: { label: "Total Enrollments", icon: "📚" },
  completed: { label: "Completed", icon: "✅" },
  certsIssued: { label: "Certificates Issued", icon: "📜" },
  assignedTrainings: { label: "Assigned Trainings", icon: "🎓" },
  teamSize: { label: "Team Size", icon: "👥" },
  myEnrollments: { label: "My Trainings", icon: "📚" },
  myCertificates: { label: "My Certificates", icon: "📜" },
  myPendingLeave: { label: "My Pending Leave", icon: "🗓️" },
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const { employee } = useAuth();
  const router = useRouter();
  const [checkStatus, setCheckStatus] = useState<{ checkedInToday?: boolean; checkedOutToday?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await api.get<DashboardResponse>("/api/dashboard");
    setData(res);
    setCheckStatus({
      checkedInToday: res.widgets.checkedInToday as boolean | undefined,
      checkedOutToday: res.widgets.checkedOutToday as boolean | undefined,
    });
  };

  useEffect(() => {
    load();
  }, []);

  const doCheckIn = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.post("/api/attendance/checkin");
      setMsg("Checked in successfully");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const doCheckOut = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.post("/api/attendance/checkout");
      setMsg("Checked out successfully");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={`Welcome${employee ? `, ${employee.firstName}` : ""}`}
        description="Here is what's happening across the organization."
      />

      {employee && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Attendance</p>
            <p className="text-xs text-slate-500">
              {checkStatus.checkedInToday
                ? checkStatus.checkedOutToday
                  ? "You have completed today's attendance."
                  : "You are checked in. Don't forget to check out."
                : "You have not checked in today."}
            </p>
            {msg && <p className="mt-1 text-xs text-violet-600">{msg}</p>}
          </div>
          <div className="flex gap-2">
            <Button onClick={doCheckIn} disabled={busy || checkStatus.checkedInToday}>
              Check In
            </Button>
            <Button
              variant="secondary"
              onClick={doCheckOut}
              disabled={busy || !checkStatus.checkedInToday || checkStatus.checkedOutToday}
            >
              Check Out
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {data &&
          Object.entries(data.widgets)
            .filter(([key]) => LABELS[key])
            .map(([key, value]) => (
              <StatCard
                key={key}
                label={LABELS[key].label}
                icon={LABELS[key].icon}
                value={
                  typeof value === "object" && value !== null
                    ? JSON.stringify(value)
                    : String(value ?? "-")
                }
              />
            ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="mb-2 font-semibold text-slate-900">Quick links</p>
          <div className="flex flex-col gap-2 text-sm">
            <button onClick={() => router.push("/leaves")} className="text-left text-violet-600 hover:underline">
              Apply for leave →
            </button>
            <button onClick={() => router.push("/trainings")} className="text-left text-violet-600 hover:underline">
              Browse trainings →
            </button>
            <button onClick={() => router.push("/documents")} className="text-left text-violet-600 hover:underline">
              Upload a document →
            </button>
            <button onClick={() => router.push("/certificates")} className="text-left text-violet-600 hover:underline">
              View my certificates →
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
