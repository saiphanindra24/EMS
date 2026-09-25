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

const QUICK_LINKS = [
  { label: "Apply for leave", href: "/leaves", icon: "🗓️", color: "from-blue-500 to-indigo-500" },
  { label: "Browse trainings", href: "/trainings", icon: "🎓", color: "from-violet-500 to-purple-500" },
  { label: "Upload a document", href: "/documents", icon: "📄", color: "from-emerald-500 to-teal-500" },
  { label: "View certificates", href: "/certificates", icon: "📜", color: "from-amber-500 to-orange-500" },
];

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

  // Get current greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageHeader
        title={`${greeting}${employee ? `, ${employee.firstName}` : ""} 👋`}
        description="Here's what's happening across the organization today."
      />

      {/* Attendance Card */}
      {employee && (
        <div className="animate-fade-in-up mb-8">
          <Card className="relative overflow-hidden">
            {/* Decorative background */}
            <div className="absolute inset-0 bg-gradient-to-r from-violet-50/50 via-transparent to-indigo-50/50 pointer-events-none" />

            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl shadow-lg shadow-violet-500/20">
                  🕐
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Today&apos;s Attendance</p>
                  <p className="text-xs text-slate-500">
                    {checkStatus.checkedInToday
                      ? checkStatus.checkedOutToday
                        ? "✅ You have completed today's attendance."
                        : "🟢 You are checked in. Don't forget to check out."
                      : "⏳ You have not checked in today."}
                  </p>
                  {msg && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                      {msg}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={doCheckIn} disabled={busy || checkStatus.checkedInToday}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                  Check In
                </Button>
                <Button
                  variant="secondary"
                  onClick={doCheckOut}
                  disabled={busy || !checkStatus.checkedInToday || checkStatus.checkedOutToday}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Check Out
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Stat Cards */}
      {data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 stagger-children">
          {Object.entries(data.widgets)
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
      ) : (
        /* Skeleton loading */
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-6">
              <div className="skeleton h-3 w-20 mb-3" />
              <div className="skeleton h-8 w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Quick Links */}
      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-left transition-all duration-300 hover:shadow-lg hover:border-violet-200/50 hover:-translate-y-0.5"
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${link.color} text-lg shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                {link.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-violet-700 transition-colors duration-200">
                  {link.label}
                </p>
                <p className="text-xs text-slate-400">Click to open →</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
