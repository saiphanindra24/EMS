import { useState, useEffect, useCallback } from "react";
import "./Tasks.css";
import { taskService } from "../services/taskService";
import { employeeService } from "../services/employeeService";
import { useAuth } from "../context/AuthContext";
import TaskModal from "./TaskModal";
import TaskDetailModal from "./TaskDetailModal";
import ConfirmationModal from "./ConfirmationModal";
import Pagination from "./common/Pagination";

export default function Tasks() {
  const { isManager, isHRAdmin, isSuperAdmin } = useAuth();
  const canManage = isManager || isHRAdmin || isSuperAdmin;

  // Data state
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    to_do: 0,
    in_progress: 0,
    in_review: 0,
    completed: 0,
    blocked: 0,
    overdue: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  // Filters state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "table"

  // Options for dropdowns
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState("create"); // "create" | "edit"
  const [selectedTask, setSelectedTask] = useState(null);
  const [isSavingTask, setIsSavingTask] = useState(false);

  const [selectedDetailTaskId, setSelectedDetailTaskId] = useState(null);

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [taskToArchive, setTaskToArchive] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Fetch filter options (departments & employees)
  useEffect(() => {
    employeeService.getDepartments({ page_size: 100, is_active: true })
      .then((res) => setDepartments(res.results || res || []))
      .catch(() => {});

    employeeService.getEmployees({ page_size: 100, status: "ACTIVE" })
      .then((res) => setEmployees(res.results || res || []))
      .catch(() => {});
  }, []);

  // Fetch tasks and live statistics
  const fetchTasksData = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (deptFilter) params.department = deptFilter;
      if (assigneeFilter) params.assignee = assigneeFilter;
      if (overdueOnly) params.overdue = "true";

      const [taskRes, statsRes] = await Promise.all([
        taskService.getTasks(params),
        taskService.getTaskStats().catch(() => null),
      ]);

      const list = taskRes.results || [];
      setTasks(list);
      setTotalCount(taskRes.count || list.length);
      setTotalPages(Math.ceil((taskRes.count || list.length) / pageSize) || 1);

      if (statsRes) {
        setStats(statsRes);
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, search, statusFilter, priorityFilter, deptFilter, assigneeFilter, overdueOnly]);

  useEffect(() => {
    fetchTasksData();
  }, [fetchTasksData]);

  // Handle Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchTasksData();
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setDeptFilter("");
    setAssigneeFilter("");
    setOverdueOnly(false);
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    search || statusFilter || priorityFilter || deptFilter || assigneeFilter || overdueOnly
  );

  // Open Create Task modal
  const handleOpenCreateModal = () => {
    setTaskModalMode("create");
    setSelectedTask(null);
    setIsTaskModalOpen(true);
  };

  // Open Edit Task modal
  const handleOpenEditModal = (task) => {
    setTaskModalMode("edit");
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  // Save task (create or edit)
  const handleSaveTask = async (payload) => {
    setIsSavingTask(true);
    setErrorMsg("");
    try {
      if (taskModalMode === "create") {
        await taskService.createTask(payload);
        setSuccessBanner("Task successfully created and assigned.");
      } else {
        await taskService.updateTask(selectedTask.id, payload);
        setSuccessBanner("Task updated successfully.");
      }
      setIsTaskModalOpen(false);
      fetchTasksData();
      setTimeout(() => setSuccessBanner(""), 4000);
    } catch (err) {
      const msg = err.error || err.detail || (typeof err === "object" ? JSON.stringify(err) : "Failed to save task.");
      setErrorMsg(msg);
    } finally {
      setIsSavingTask(false);
    }
  };

  // Archive Task confirmation
  const handlePromptArchive = (task) => {
    setTaskToArchive(task);
    setIsArchiveModalOpen(true);
  };

  const handleConfirmArchive = async () => {
    if (!taskToArchive) return;
    setIsArchiving(true);
    setErrorMsg("");
    try {
      await taskService.archiveTask(taskToArchive.id);
      setIsArchiveModalOpen(false);
      setTaskToArchive(null);
      setSuccessBanner(`Task ${taskToArchive.task_id} has been safely archived.`);
      fetchTasksData();
      setTimeout(() => setSuccessBanner(""), 4000);
    } catch (err) {
      const msg = err.error || err.detail || "Failed to archive task.";
      setErrorMsg(msg);
    } finally {
      setIsArchiving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="tasks-container">
      {/* Alert Banners */}
      {successBanner && (
        <div className="alert-banner success" style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#34d399", padding: "12px 18px", borderRadius: "10px", display: "flex", gap: "10px", alignItems: "center" }}>
          <span>✓</span>
          <span>{successBanner}</span>
        </div>
      )}
      {errorMsg && (
        <div className="alert-banner error" style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#f87171", padding: "12px 18px", borderRadius: "10px", display: "flex", gap: "10px", alignItems: "center" }}>
          <span>⚠</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Task Statistics Cards */}
      <section className="tasks-stats-grid">
        <article className="task-stat-card">
          <div className="task-stat-header">
            <span>Total Tasks</span>
            <span className="task-stat-icon total">☷</span>
          </div>
          <div className="task-stat-value">{stats.total}</div>
          <div className="task-stat-sub">Across active scopes</div>
        </article>

        <article className="task-stat-card">
          <div className="task-stat-header">
            <span>To Do</span>
            <span className="task-stat-icon todo">⏱</span>
          </div>
          <div className="task-stat-value">{stats.to_do}</div>
          <div className="task-stat-sub">Queued for work</div>
        </article>

        <article className="task-stat-card">
          <div className="task-stat-header">
            <span>In Progress</span>
            <span className="task-stat-icon inprogress">⚡</span>
          </div>
          <div className="task-stat-value">{stats.in_progress}</div>
          <div className="task-stat-sub">Active implementation</div>
        </article>

        <article className="task-stat-card">
          <div className="task-stat-header">
            <span>In Review</span>
            <span className="task-stat-icon inreview">🔍</span>
          </div>
          <div className="task-stat-value">{stats.in_review}</div>
          <div className="task-stat-sub">Pending QA &amp; review</div>
        </article>

        <article className="task-stat-card">
          <div className="task-stat-header">
            <span>Completed</span>
            <span className="task-stat-icon completed">✓</span>
          </div>
          <div className="task-stat-value">{stats.completed}</div>
          <div className="task-stat-sub">Delivered &amp; closed</div>
        </article>

        <article
          className={`task-stat-card overdue-alert ${overdueOnly ? "active" : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => setOverdueOnly((prev) => !prev)}
          title="Click to filter overdue tasks"
        >
          <div className="task-stat-header">
            <span style={{ color: "#f87171" }}>Overdue</span>
            <span className="task-stat-icon overdue">⏰</span>
          </div>
          <div className="task-stat-value" style={{ color: "#f87171" }}>{stats.overdue}</div>
          <div className="task-stat-sub" style={{ color: "#fca5a5" }}>
            {overdueOnly ? "Filtered: Active" : "Click to view overdue"}
          </div>
        </article>
      </section>

      {/* Toolbar & Filters */}
      <section className="tasks-toolbar">
        <div className="tasks-toolbar-top">
          {/* Search box */}
          <form onSubmit={handleSearchSubmit} className="tasks-search-wrap">
            <span>⌕</span>
            <input
              type="text"
              placeholder="Search by title, ID, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{ background: "transparent", border: "none", color: "var(--text)", cursor: "pointer" }}
              >
                ✕
              </button>
            )}
          </form>

          {/* Right Toolbar Actions */}
          <div className="tasks-toolbar-actions">
            {/* Overdue quick toggle */}
            <button
              type="button"
              className={`overdue-filter-btn ${overdueOnly ? "active" : ""}`}
              onClick={() => {
                setOverdueOnly((prev) => !prev);
                setCurrentPage(1);
              }}
            >
              ⏰ Overdue Only
              {stats.overdue > 0 && <span style={{ background: "rgba(0,0,0,0.25)", padding: "1px 6px", borderRadius: "10px", fontSize: "11px" }}>{stats.overdue}</span>}
            </button>

            {/* View Mode Switcher */}
            <div className="view-toggle">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === "cards" ? "active" : ""}`}
                onClick={() => setViewMode("cards")}
                title="Card Grid View"
              >
                ▦ Cards
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Table View"
              >
                ☰ Table
              </button>
            </div>

            {/* Assign Task Button (Managers & Admins) */}
            {canManage && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenCreateModal}
                style={{ padding: "8px 16px", fontSize: "13.5px" }}
              >
                + Assign Task
              </button>
            )}
          </div>
        </div>

        {/* Filters Row */}
        <div className="tasks-toolbar-filters">
          <select
            className="tasks-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="TO_DO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="COMPLETED">Completed</option>
            <option value="BLOCKED">Blocked</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            className="tasks-select"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent ⚡</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            className="tasks-select"
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {canManage && (
            <select
              className="tasks-select"
              value={assigneeFilter}
              onChange={(e) => {
                setAssigneeFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Assignees</option>
              {employees.map((em) => (
                <option key={em.id} value={em.id}>
                  {em.first_name} {em.last_name}
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button type="button" className="reset-filters-btn" onClick={handleResetFilters}>
              Reset Filters ✕
            </button>
          )}

          <div style={{ marginLeft: "auto", fontSize: "12.5px", color: "var(--text)" }}>
            Showing <strong>{tasks.length}</strong> of <strong>{totalCount}</strong> tasks
          </div>
        </div>
      </section>

      {/* Task Content: Cards or Table */}
      {loading ? (
        <div className="tasks-state-empty">
          <div className="loading-logo" style={{ width: "40px", height: "40px" }}>E</div>
          <p>Loading task workspace...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="tasks-state-empty">
          <span className="tasks-state-icon">📋</span>
          <h3>No tasks found</h3>
          <p>
            {hasActiveFilters
              ? "No tasks matched your current search or filter criteria. Try resetting filters."
              : "No tasks are currently assigned in this workspace."}
          </p>
          {hasActiveFilters ? (
            <button type="button" className="btn-secondary" onClick={handleResetFilters}>
              Reset Filters
            </button>
          ) : canManage ? (
            <button type="button" className="btn-primary" onClick={handleOpenCreateModal}>
              + Assign First Task
            </button>
          ) : null}
        </div>
      ) : viewMode === "cards" ? (
        /* --- Card Grid View --- */
        <div className="tasks-grid">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`task-card ${task.is_overdue ? "is-overdue" : ""}`}
              onClick={() => setSelectedDetailTaskId(task.id)}
            >
              {/* Header: ID, Priority, Overdue */}
              <div className="task-card-header">
                <span className="task-id-badge">{task.task_id}</span>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {task.is_overdue && <span className="overdue-pill">OVERDUE</span>}
                  <span className={`priority-badge ${task.priority.toLowerCase()}`}>
                    {task.priority === "URGENT" && "⚡ "}
                    {task.priority}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h4 className="task-card-title">{task.title}</h4>
                {task.description && (
                  <p className="task-card-desc">{task.description}</p>
                )}
              </div>

              {/* Status pill & Department */}
              <div className="task-card-meta-row">
                <span className={`task-status-badge ${task.status.toLowerCase()}`}>
                  {task.status_display || task.status}
                </span>
                {task.department_name && (
                  <span style={{ fontSize: "11.5px", color: "var(--text)" }}>
                    {task.department_name}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="task-progress-section">
                <div className="task-progress-meta">
                  <span>Progress</span>
                  <span className="task-progress-pct">{task.progress}%</span>
                </div>
                <div className="task-progress-track">
                  <div
                    className={`task-progress-fill ${task.status === "COMPLETED" ? "completed" : task.status === "BLOCKED" ? "blocked" : ""}`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>

              {/* Card Footer: Assignee, Due Date, Hours */}
              <div className="task-card-footer">
                <div className="task-assignee-info">
                  <div className="task-avatar-mini">
                    {task.assignee_name ? task.assignee_name[0].toUpperCase() : "U"}
                  </div>
                  <span className="task-assignee-name" title={task.assignee_name}>
                    {task.assignee_name || "Unassigned"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className={`task-due-info ${task.is_overdue ? "overdue" : ""}`}>
                    {task.is_overdue ? "⏰ " : "📅 "}
                    {formatDate(task.due_date)}
                  </span>
                  {task.comments_count > 0 && (
                    <span style={{ fontSize: "11.5px", color: "var(--text)", display: "flex", alignItems: "center", gap: "3px" }}>
                      💬 {task.comments_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* --- Table View --- */
        <div className="tasks-table-card">
          <table className="tasks-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Task Title</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Progress</th>
                <th>Due Date</th>
                <th>Comments</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className={task.is_overdue ? "is-overdue" : ""}
                  onClick={() => setSelectedDetailTaskId(task.id)}
                >
                  <td>
                    <span className="task-id-badge">{task.task_id}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-h)" }}>{task.title}</div>
                    {task.department_name && (
                      <span style={{ fontSize: "11.5px", color: "var(--text)" }}>{task.department_name}</span>
                    )}
                  </td>
                  <td>
                    <span className={`priority-badge ${task.priority.toLowerCase()}`}>
                      {task.priority === "URGENT" && "⚡ "}
                      {task.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`task-status-badge ${task.status.toLowerCase()}`}>
                      {task.status_display || task.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="task-avatar-mini">
                        {task.assignee_name ? task.assignee_name[0].toUpperCase() : "U"}
                      </div>
                      <span style={{ fontSize: "13px" }}>{task.assignee_name || "Unassigned"}</span>
                    </div>
                  </td>
                  <td style={{ minWidth: "120px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="task-progress-track" style={{ flex: 1 }}>
                        <div
                          className={`task-progress-fill ${task.status === "COMPLETED" ? "completed" : ""}`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span style={{ fontSize: "11.5px", fontWeight: 600 }}>{task.progress}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`task-due-info ${task.is_overdue ? "overdue" : ""}`}>
                      {task.is_overdue && "⏰ "}
                      {formatDate(task.due_date)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: "12px", color: "var(--text)" }}>
                      💬 {task.comments_count}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "12px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDetailTaskId(task.id);
                      }}
                    >
                      View / Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={(newPage) => setCurrentPage(newPage)}
          itemName="tasks"
          isLoading={loading}
        />
      )}

      {/* Operational Disclaimer Note (Rule adherence) */}
      <div style={{ padding: "12px 18px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", fontSize: "12px", color: "var(--text)", lineHeight: 1.5 }}>
        ℹ <strong>Operational Work Tracking:</strong> Task volumes and progress metrics reflect real-time workload distribution and project milestone tracking, and do not represent a complete measure of individual employee productivity.
      </div>

      {/* --- Task Create / Edit Modal --- */}
      <TaskModal
        isOpen={isTaskModalOpen}
        mode={taskModalMode}
        task={selectedTask}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        isLoading={isSavingTask}
      />

      {/* --- Task Detail / Progress / Comments / History Modal --- */}
      <TaskDetailModal
        isOpen={Boolean(selectedDetailTaskId)}
        taskId={selectedDetailTaskId}
        onClose={() => setSelectedDetailTaskId(null)}
        onTaskUpdated={() => fetchTasksData()}
        onEditTask={(task) => handleOpenEditModal(task)}
        onArchiveTask={(task) => handlePromptArchive(task)}
      />

      {/* --- Archive Task Confirmation Modal --- */}
      <ConfirmationModal
        isOpen={isArchiveModalOpen}
        title="Archive Task"
        message={`Are you sure you want to archive task "${taskToArchive?.task_id}: ${taskToArchive?.title}"? The task will be removed from active board listings but preserved for historical audits.`}
        confirmText="Archive Task"
        confirmStyle="danger"
        isLoading={isArchiving}
        onConfirm={handleConfirmArchive}
        onClose={() => {
          setIsArchiveModalOpen(false);
          setTaskToArchive(null);
        }}
      />
    </div>
  );
}
