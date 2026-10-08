import { useEffect, useState } from "react";
import { attendanceService } from "../services/attendanceService";
import { taskService } from "../services/taskService";
import { employeeService } from "../services/employeeService";
import { leaveService } from "../services/leaveService";
import { formatApiError } from "../services/apiClient";
import { useAuth } from "../context/AuthContext";

export default function Dashboard({ onNavigate }) {
  const { user } = useAuth();
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
      if (empRes.status === "fulfilled") setTotalHeadcount(empRes.value?.count || 0);
      if (leaveRes.status === "fulfilled") setPendingLeavesCount(leaveRes.value?.count || 0);
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

  const totalTasks = taskStats?.total_tasks || 0;
  const completedTasks = taskStats?.completed_tasks || 0;
  const inProgressTasks = taskStats?.in_progress_tasks || 0;
  const pendingTasks = taskStats?.todo_tasks || 0;
  const overdueTasks = taskStats?.overdue_tasks || 0;
  const completionRate = taskStats?.completion_rate || (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);

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
