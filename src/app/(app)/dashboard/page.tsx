"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

const WORK_HOURS = 8;       // 8 hours work quota
const BREAK_HOURS = 1;      // 1 hour break quota
const TOTAL_SECONDS = WORK_HOURS * 3600;
const BREAK_SECONDS = BREAK_HOURS * 3600;

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ─── Work Timer Component ─── */
function WorkTimer({
  checkInTime,
  checkedOut,
}: {
  checkInTime: string;
  checkedOut: boolean;
}) {
  const [workSeconds, setWorkSeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [onBreak, setOnBreak] = useState(false);
  const breakAccumulatedRef = useRef(0);
  const breakStartRef = useRef<number | null>(null);
  const checkInMs = useRef(new Date(checkInTime).getTime());

  // Load break state from localStorage on mount
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const stored = localStorage.getItem(`ems-break-${today}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      breakAccumulatedRef.current = parsed.accumulated || 0;
      if (parsed.breakStart && !checkedOut) {
        breakStartRef.current = parsed.breakStart;
        setOnBreak(true);
      }
    }
  }, [checkedOut]);

  // Persist break state to localStorage
  const persistBreak = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      `ems-break-${today}`,
      JSON.stringify({
        accumulated: breakAccumulatedRef.current,
        breakStart: breakStartRef.current,
      }),
    );
  }, []);

  // Timer tick every second
  useEffect(() => {
    if (checkedOut) {
      // Calculate final values
      const now = Date.now();
      const totalElapsed = Math.floor((now - checkInMs.current) / 1000);
      const currentBreak = breakStartRef.current
        ? Math.floor((now - breakStartRef.current) / 1000)
        : 0;
      const totalBreak = breakAccumulatedRef.current + currentBreak;
      setBreakSeconds(Math.min(totalBreak, BREAK_SECONDS));
      setWorkSeconds(Math.max(0, totalElapsed - totalBreak));
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const totalElapsed = Math.floor((now - checkInMs.current) / 1000);

      if (breakStartRef.current) {
        // Currently on break
        const currentBreakDuration = Math.floor((now - breakStartRef.current) / 1000);
        const totalBreak = breakAccumulatedRef.current + currentBreakDuration;
        setBreakSeconds(Math.min(totalBreak, BREAK_SECONDS));
        setWorkSeconds(Math.max(0, totalElapsed - totalBreak));
      } else {
        const totalBreak = breakAccumulatedRef.current;
        setBreakSeconds(Math.min(totalBreak, BREAK_SECONDS));
        setWorkSeconds(Math.max(0, totalElapsed - totalBreak));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [checkedOut]);

  const toggleBreak = () => {
    if (onBreak) {
      // End break
      if (breakStartRef.current) {
        const elapsed = Math.floor((Date.now() - breakStartRef.current) / 1000);
        breakAccumulatedRef.current += elapsed;
        breakStartRef.current = null;
      }
      setOnBreak(false);
    } else {
      // Start break
      breakStartRef.current = Date.now();
      setOnBreak(true);
    }
    persistBreak();
  };

  const workProgress = Math.min((workSeconds / TOTAL_SECONDS) * 100, 100);
  const breakProgress = Math.min((breakSeconds / BREAK_SECONDS) * 100, 100);
  const workComplete = workSeconds >= TOTAL_SECONDS;
  const breakExceeded = breakSeconds >= BREAK_SECONDS;

  // Circular progress dimensions
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const workStroke = circumference - (workProgress / 100) * circumference;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-stretch">
      {/* Main circular timer */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <svg width="180" height="180" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="90" cy="90" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-slate-100"
            />
            {/* Progress arc */}
            <circle
              cx="90" cy="90" r={radius}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={workStroke}
              className={`transition-all duration-1000 ease-out ${
                workComplete
                  ? "text-emerald-500"
                  : onBreak
                  ? "text-amber-400"
                  : "text-violet-500"
              }`}
              stroke="currentColor"
              style={{
                filter: workComplete
                  ? "drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))"
                  : onBreak
                  ? "drop-shadow(0 0 8px rgba(251, 191, 36, 0.4))"
                  : "drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))",
              }}
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
              onBreak ? "text-amber-500" : workComplete ? "text-emerald-500" : "text-slate-400"
            }`}>
              {onBreak ? "On Break" : workComplete ? "Complete" : "Working"}
            </span>
            <span className={`text-3xl font-extrabold tabular-nums tracking-tight ${
              onBreak ? "text-amber-600" : workComplete ? "text-emerald-600" : "text-slate-900"
            }`}>
              {formatTime(workSeconds)}
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              / {WORK_HOURS}h quota
            </span>
          </div>
        </div>

        {/* Break button */}
        {!checkedOut && (
          <button
            onClick={toggleBreak}
            disabled={breakExceeded && !onBreak}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
              onBreak
                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600 animate-pulse"
                : breakExceeded
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700"
            }`}
          >
            {onBreak ? (
              <>
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Resume Work
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                </svg>
                {breakExceeded ? "Break Limit Reached" : "Take a Break"}
              </>
            )}
          </button>
        )}
      </div>

      {/* Time breakdown */}
      <div className="flex-1 flex flex-col justify-center gap-4 min-w-0">
        {/* Work hours bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${
                workComplete ? "bg-emerald-500" : "bg-violet-500"
              } ${!checkedOut && !onBreak && !workComplete ? "animate-pulse" : ""}`} />
              <span className="text-sm font-semibold text-slate-700">Work Hours</span>
            </div>
            <span className="text-sm font-bold tabular-nums text-slate-900">
              {formatTime(workSeconds)} <span className="text-slate-400 font-normal">/ {WORK_HOURS}:00:00</span>
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                workComplete
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                  : "bg-gradient-to-r from-violet-400 to-indigo-500"
              }`}
              style={{ width: `${workProgress}%` }}
            />
          </div>
        </div>

        {/* Break time bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${
                breakExceeded ? "bg-red-500" : "bg-amber-400"
              } ${onBreak ? "animate-pulse" : ""}`} />
              <span className="text-sm font-semibold text-slate-700">Break Time</span>
            </div>
            <span className="text-sm font-bold tabular-nums text-slate-900">
              {formatTime(breakSeconds)} <span className={`font-normal ${breakExceeded ? "text-red-500" : "text-slate-400"}`}>/ {BREAK_HOURS}:00:00</span>
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                breakExceeded
                  ? "bg-gradient-to-r from-red-400 to-red-500"
                  : "bg-gradient-to-r from-amber-300 to-amber-400"
              }`}
              style={{ width: `${breakProgress}%` }}
            />
          </div>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2 mt-1">
          {workComplete && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/60">
              ✅ Work quota completed
            </span>
          )}
          {breakExceeded && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200/60">
              ⚠️ Break limit exceeded
            </span>
          )}
          {onBreak && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200/60 animate-pulse">
              ☕ Currently on break
            </span>
          )}
          {checkedOut && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/60">
              🏁 Checked out for today
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Dashboard Page ─── */
export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const { employee } = useAuth();
  const router = useRouter();
  const [checkStatus, setCheckStatus] = useState<{
    checkedInToday?: boolean;
    checkedOutToday?: boolean;
    checkInTime?: string | null;
    checkOutTime?: string | null;
  }>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await api.get<DashboardResponse>("/api/dashboard");
    setData(res);
    setCheckStatus({
      checkedInToday: res.widgets.checkedInToday as boolean | undefined,
      checkedOutToday: res.widgets.checkedOutToday as boolean | undefined,
      checkInTime: res.widgets.checkInTime as string | null | undefined,
      checkOutTime: res.widgets.checkOutTime as string | null | undefined,
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
      // Clear old break data for new day
      const today = new Date().toISOString().slice(0, 10);
      localStorage.removeItem(`ems-break-${today}`);
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

      {/* Attendance & Timer Card */}
      {employee && (
        <div className="animate-fade-in-up mb-8">
          <Card className="relative overflow-hidden">
            {/* Decorative background */}
            <div className="absolute inset-0 bg-gradient-to-r from-violet-50/50 via-transparent to-indigo-50/50 pointer-events-none" />

            <div className="relative">
              {/* Header row with check-in/out buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl shadow-lg shadow-violet-500/20">
                    🕐
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-900">Today&apos;s Attendance</p>
                    <p className="text-xs text-slate-500">
                      {checkStatus.checkedInToday
                        ? checkStatus.checkedOutToday
                          ? "✅ You have completed today's attendance."
                          : "🟢 Timer is running — have a productive day!"
                        : "⏳ Click Check In to start your workday."}
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

              {/* Timer section — only show after check-in */}
              {checkStatus.checkedInToday && checkStatus.checkInTime && (
                <div className="border-t border-slate-100 pt-6">
                  <WorkTimer
                    checkInTime={checkStatus.checkInTime}
                    checkedOut={!!checkStatus.checkedOutToday}
                  />
                </div>
              )}
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
