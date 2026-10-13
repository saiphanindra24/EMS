import { useEffect, useState } from "react";
import { attendanceService } from "../services/attendanceService";
import { taskService } from "../services/taskService";
import { employeeService } from "../services/employeeService";
import { leaveService } from "../services/leaveService";
import { formatApiError } from "../services/apiClient";
import { useAuth } from "../context/AuthContext";
import { INITIAL_CONTACTS } from "./MeetChat";
import { getUserSlug } from "../services/chatSocket";

export default function Dashboard({ onNavigate }) {
  const { user } = useAuth();
  const mySlug = getUserSlug(user);
  const isManagerOrAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN" || user?.role === "MANAGER";

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [attendanceStats, setAttendanceStats] = useState(null);
  const [taskStats, setTaskStats] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [totalHeadcount, setTotalHeadcount] = useState(0);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [attRes, tasksRes, taskStatsRes, empRes, leaveRes] = await Promise.allSettled([
        attendanceService.getAttendanceStats(),
        taskService.getTasks({ page_size: 5 }),
        taskService.getTaskStats(),
        employeeService.getEmployees({ page_size: 1 }),
        leaveService.getLeaveRequests({ status: "PENDING", page_size: 1 }),
      ]);

      if (attRes.status === "fulfilled") setAttendanceStats(attRes.value);
      if (tasksRes.status === "fulfilled") setRecentTasks(tasksRes.value?.results || []);
      if (taskStatsRes.status === "fulfilled") setTaskStats(taskStatsRes.value);
      if (empRes.status === "fulfilled") {
        const d = empRes.value;
        setTotalHeadcount(typeof d?.count === "number" ? d.count : (Array.isArray(d) ? d.length : (d?.results?.length || 0)));
      }
      if (leaveRes.status === "fulfilled") {
        const d = leaveRes.value;
        setPendingLeavesCount(typeof d?.count === "number" ? d.count : (Array.isArray(d) ? d.length : (d?.results?.length || 0)));
      }
    } catch (err) {
      setErrorMessage(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Compute live presentation values
  const totalEmployees = totalHeadcount || attendanceStats?.total_employees || 0;
  const presentCount = attendanceStats?.present || 0;
  const lateCount = attendanceStats?.late || 0;
  const onLeaveCount = attendanceStats?.on_leave || 0;
  const absentCount = attendanceStats?.absent || 0;
  const presentRate = totalEmployees > 0 ? Math.round(((presentCount + lateCount) / totalEmployees) * 100) : 0;

  const totalTasks = taskStats?.total_tasks ?? taskStats?.total ?? 0;
  const completedTasks = taskStats?.completed_tasks ?? taskStats?.completed ?? 0;
  const inProgressTasks = taskStats?.in_progress_tasks ?? taskStats?.in_progress ?? 0;
  const pendingTasks = taskStats?.todo_tasks ?? taskStats?.todo ?? 0;
  const overdueTasks = taskStats?.overdue_tasks ?? taskStats?.overdue ?? 0;
  const completionRate = taskStats?.completion_rate ?? (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);

  const statsCards = [
    {
      label: "Total Workforce",
      value: String(totalEmployees),
      change: `${attendanceStats?.total_employees || 0} scheduled today`,
      icon: "👥",
      color: "blue",
    },
    {
      label: "Present Today",
      value: String(presentCount + lateCount),
      change: `${presentRate}% attendance rate`,
      icon: "✓",
      color: "green",
    },
    {
      label: "Tasks In Progress",
      value: String(inProgressTasks),
      change: `${overdueTasks} overdue items`,
      icon: "📋",
      color: "purple",
    },
    {
      label: "Pending Leaves",
      value: String(pendingLeavesCount),
      change: "Awaiting approval",
      icon: "🏖️",
      color: "orange",
    },
  ];

  if (isLoading) {
    return (
      <div className="state-container" style={{ padding: "80px 20px" }}>
        <div className="spinner" />
        <div className="state-title">Loading Real-Time Dashboard…</div>
        <div className="state-subtext">Fetching synchronized attendance, task metrics, and employee roster.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {errorMessage && (
        <div className="alert-feedback error">
          <span>⚠️</span>
          <span>{errorMessage}</span>
          <button className="btn-secondary" style={{ marginLeft: "auto", padding: "4px 10px" }} onClick={fetchDashboardData}>
            Retry
          </button>
        </div>
      )}

      {/* ── VolkssKatt / SSKATT EWTS Brand Hero Banner ── */}
      <section className="brand-hero-card">
        <div className="brand-hero-content">
          <div className="brand-hero-pill">
            <span className="hero-pill-dot" /> VolkssKatt Cloud 2026
          </div>
          <h2 className="brand-hero-title">
            Transform Your Ideas Into Digital Reality
          </h2>
          <p className="brand-hero-desc">
            Welcome to SSKATT EWTS — your enterprise workspace for synchronized attendance tracking, sprint deliverables execution, leave management, and live collaboration.
          </p>
          <div className="brand-hero-actions">
            <button
              type="button"
              className="hero-btn-primary"
              onClick={() => onNavigate && onNavigate("Attendance")}
            >
              Punch Attendance →
            </button>
            <button
              type="button"
              className="hero-btn-secondary"
              onClick={() => onNavigate && onNavigate("Tasks")}
            >
              View Active Tasks
            </button>
          </div>
        </div>
        <div className="brand-hero-media">
          <img src="/brand-hero.png" alt="VolkssKatt Digital Reality" className="brand-hero-img" />
        </div>
      </section>

      {/* ── 4 Top Stat KPI Cards ── */}
      <section className="stats-grid">
        {statsCards.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <div className="stat-top">
              <span className="stat-label">{stat.label}</span>
              <span className={`stat-icon ${stat.color}`}>{stat.icon}</span>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-change">{stat.change}</div>
          </article>
        ))}
      </section>

      {/* ── Middle Grid: Attendance Donut + Task Activity ── */}
      <section className="middle-grid">
        <article className="panel attendance-panel">
          <div className="panel-heading">
            <div>
              <h3>Attendance Overview</h3>
              <p>Today's live punch statistics ({attendanceStats?.date || "Today"})</p>
            </div>
            <button className="small-select" onClick={() => onNavigate && onNavigate("Attendance")}>
              Attendance →
            </button>
          </div>
          <div className="attendance-body">
            <div className="donut-wrap">
              <div
                className="donut"
                style={{
                  background: `conic-gradient(#10b981 0% ${presentRate}%, #e2e8f0 ${presentRate}% 100%)`,
                }}
              >
                <div className="donut-center">
                  <strong>{presentRate}%</strong>
                  <span>Present</span>
                </div>
              </div>
            </div>
            <div className="attendance-legend">
              <div><span className="legend-dot present" /><span>Present</span><strong>{presentCount}</strong></div>
              <div><span className="legend-dot late" style={{ background: "#eab308" }} /><span>Late</span><strong>{lateCount}</strong></div>
              <div><span className="legend-dot absent" /><span>Absent</span><strong>{absentCount}</strong></div>
              <div><span className="legend-dot leave" /><span>On Leave</span><strong>{onLeaveCount}</strong></div>
            </div>
          </div>
          <div className="attendance-footer">
            <span>Average logged session</span>
            <strong>{attendanceStats?.average_work_hours || 0} hrs</strong>
          </div>
        </article>

        <article className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h3>Team Task Execution</h3>
              <p>Overall completion &amp; workload distribution</p>
            </div>
            <button className="small-select" onClick={() => onNavigate && onNavigate("Tasks")}>
              All Tasks →
            </button>
          </div>
          <div className="activity-summary">
            <strong>{completionRate}%</strong>
            <span>Overall task delivery rate</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.min(completionRate, 100)}%` }} />
          </div>
          <div className="activity-breakdown">
            <div><span className="activity-marker blue-marker" /><span>Completed</span><strong>{completedTasks}</strong></div>
            <div><span className="activity-marker purple-marker" /><span>In Progress</span><strong>{inProgressTasks}</strong></div>
            <div><span className="activity-marker gray-marker" /><span>To Do</span><strong>{pendingTasks}</strong></div>
          </div>
        </article>
      </section>

      {/* ── Workplace Communications & Collaboration Quick Hub ── */}
      <section className="panel" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
              <span>💬</span> Team Communications &amp; Live Collaboration
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
              Instant standup meetings, team channels, and direct colleague chats
            </p>
          </div>
          <button
            className="small-select"
            onClick={() => onNavigate && onNavigate("Meet & Chat")}
            style={{ fontWeight: 600, cursor: "pointer" }}
          >
            Open Meet &amp; Chat →
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          {/* Daily Standup Card */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong style={{ fontSize: "14px", color: "#0f172a" }}>#daily-scrum</strong>
                <span style={{ fontSize: "11px", fontWeight: 700, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "999px" }}>
                  🟢 Active Standup
                </span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#64748b" }}>
                Daily Morning Scrum (09:30 AM) &amp; Evening Updates. Team status sync.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1, padding: "7px 12px", fontSize: "12px", cursor: "pointer" }}
                onClick={() => onNavigate && onNavigate("Meet & Chat")}
              >
                📹 Join Standup
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "7px 12px", fontSize: "12px", cursor: "pointer" }}
                onClick={() => onNavigate && onNavigate("Meet & Chat")}
              >
                💬 Chat
              </button>
            </div>
          </div>

          {/* Quick Colleague DMs */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              COLLABORATE WITH COLLEAGUES
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {INITIAL_CONTACTS.filter((c) => c.slug !== mySlug).slice(0, 3).map((contact) => (
                <div
                  key={contact.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    background: "#ffffff",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: contact.avatarColor,
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {contact.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#1e293b" }}>{contact.name}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{contact.role}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: "#f1f5f9",
                      border: "none",
                      borderRadius: "6px",
                      padding: "4px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#475569",
                      cursor: "pointer",
                    }}
                    onClick={() => onNavigate && onNavigate("Meet & Chat")}
                  >
                    💬 Message
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Recent Tasks from Real API ── */}
      <section className="panel tasks-panel">
        <div className="panel-heading tasks-heading">
          <div>
            <h3>Active Deliverables</h3>
            <p>Live tasks synchronized with Django backend</p>
          </div>
          {isManagerOrAdmin && (
            <button className="view-all" onClick={() => onNavigate && onNavigate("Tasks")}>
              View all tasks →
            </button>
          )}
        </div>
        <div className="table-scroll">
          {recentTasks.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
              No tasks currently assigned. Create deliverables in the Tasks module.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Task ID</th>
                  <th>Title</th>
                  <th>Assignee</th>
                  <th>Priority</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((t) => (
                  <tr key={t.id || t.task_id}>
                    <td><code>{t.task_id}</code></td>
                    <td className="task-name"><strong>{t.title}</strong></td>
                    <td>{t.assignee?.full_name || "Unassigned"}</td>
                    <td>
                      <span className={`status-tag ${t.priority?.toLowerCase()}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: t.is_overdue ? "#dc2626" : "inherit" }}>
                        {t.due_date || "-"} {t.is_overdue ? "⚠️ Overdue" : ""}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${t.status?.toLowerCase().replace(/_/g, "-")}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
