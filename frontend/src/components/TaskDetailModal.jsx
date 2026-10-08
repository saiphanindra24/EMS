import { useState, useEffect } from "react";
import { taskService } from "../services/taskService";
import { useAuth } from "../context/AuthContext";

export default function TaskDetailModal({
  isOpen,
  taskId,
  onClose,
  onTaskUpdated,
  onEditTask,
  onArchiveTask,
}) {
  const { user, isManager, isHRAdmin, isSuperAdmin } = useAuth();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Progress update form state
  const [status, setStatus] = useState("TO_DO");
  const [progress, setProgress] = useState(0);
  const [actualHours, setActualHours] = useState("");
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

  // Tabs & Comments state
  const [activeTab, setActiveTab] = useState("comments"); // "comments" | "history"
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);

  const canManage = isManager || isHRAdmin || isSuperAdmin;

  // Load detailed task info
  const loadTaskDetail = async (id) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await taskService.getTask(id);
      setTask(data);
      setStatus(data.status);
      setProgress(data.progress);
      setActualHours(data.actual_hours !== null && data.actual_hours !== undefined ? data.actual_hours : "");
      setComments(data.comments || []);
      setHistory(data.history || []);
    } catch (err) {
      setErrorMsg(err.message || "Failed to load task details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      loadTaskDetail(taskId);
    } else {
      setTask(null);
      setSuccessMsg("");
      setErrorMsg("");
      setNewComment("");
    }
  }, [isOpen, taskId]);

  if (!isOpen) return null;

  // Check if current user is assignee or manager
  const isAssignee = user && task && (user.id === task.assignee || user.email === task.assignee_email);
  const canUpdateProgress = canManage || isAssignee;

  // Progress & Status save handler
  const handleSaveProgress = async (e) => {
    e.preventDefault();
    if (!task) return;
    setIsUpdatingProgress(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload = {
        status,
        progress: parseInt(progress, 10),
      };
      if (actualHours !== "") {
        payload.actual_hours = parseFloat(actualHours);
      }

      const updated = await taskService.updateTask(task.id, payload);
      setTask(updated);
      setComments(updated.comments || []);
      setHistory(updated.history || []);
      setSuccessMsg("Task progress and status updated successfully.");
      if (onTaskUpdated) onTaskUpdated(updated);
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      const msg = err.error || err.detail || (typeof err === "object" ? JSON.stringify(err) : "Failed to update progress.");
      setErrorMsg(msg);
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  // Add Comment handler
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !task) return;

    setIsPostingComment(true);
    setErrorMsg("");
    try {
      const added = await taskService.addComment(task.id, newComment.trim());
      setComments((prev) => [added, ...prev]);
      setNewComment("");
      // Refresh task to get latest comments_count and history
      const fresh = await taskService.getTask(task.id);
      setTask(fresh);
      setHistory(fresh.history || []);
      if (onTaskUpdated) onTaskUpdated(fresh);
    } catch (err) {
      const msg = err.error || err.detail || "Failed to post comment.";
      setErrorMsg(msg);
    } finally {
      setIsPostingComment(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Not set";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dtStr) => {
    if (!dtStr) return "";
    try {
      const d = new Date(dtStr);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dtStr;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content task-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="task-id-badge">{task?.task_id || "TASK"}</span>
            <h2>Task Details</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Modal Body */}
        <div className="task-detail-body">
          {loading ? (
            <div className="tasks-state-empty">
              <div className="loading-logo" style={{ width: "36px", height: "36px", fontSize: "16px" }}>E</div>
              <p>Loading task workspace...</p>
            </div>
          ) : errorMsg && !task ? (
            <div className="alert-banner error">
              <span>⚠</span>
              <span>{errorMsg}</span>
            </div>
          ) : task ? (
            <>
              {/* Alert notifications */}
              {errorMsg && (
                <div className="alert-banner error">
                  <span>⚠</span>
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="alert-banner success" style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#34d399", padding: "10px 14px", borderRadius: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <span>✓</span>
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Overdue alert banner */}
              {task.is_overdue && (
                <div className="overdue-banner">
                  <span style={{ fontSize: "18px" }}>⏰</span>
                  <div>
                    <strong>Overdue Notice:</strong> This task was due on {formatDate(task.due_date)} and is not yet completed. Priority attention requested.
                  </div>
                </div>
              )}

              {/* Top Overview */}
              <div className="task-detail-top">
                <div className="task-badges-row">
                  <span className={`priority-badge ${task.priority.toLowerCase()}`}>
                    {task.priority === "URGENT" && "⚡ "}
                    {task.priority} Priority
                  </span>
                  <span className={`task-status-badge ${task.status.toLowerCase()}`}>
                    {task.status_display || task.status}
                  </span>
                  {task.is_overdue && <span className="overdue-pill">OVERDUE</span>}
                  {task.department_name && (
                    <span style={{ fontSize: "12px", color: "var(--text)", background: "rgba(255,255,255,0.05)", padding: "3px 8px", borderRadius: "6px" }}>
                      Dept: {task.department_name}
                    </span>
                  )}
                </div>

                <h3 className="task-detail-title">{task.title}</h3>
                {task.description ? (
                  <div className="task-detail-desc">{task.description}</div>
                ) : (
                  <div style={{ color: "var(--text)", fontSize: "13px", fontStyle: "italic" }}>
                    No description provided.
                  </div>
                )}
              </div>

              {/* Interactive Progress & Status Box */}
              <div className="task-update-box">
                <div className="task-update-header">
                  <h4>Work Progress &amp; Status</h4>
                  {!canUpdateProgress && (
                    <span style={{ fontSize: "12px", color: "var(--text)" }}>View-only mode</span>
                  )}
                </div>

                <form onSubmit={handleSaveProgress} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Range Slider for Progress */}
                  <div className="task-slider-wrap">
                    <div className="task-slider-label">
                      <span>Completion Percentage</span>
                      <strong style={{ color: "var(--text-h)", fontSize: "15px" }}>{progress}%</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      className="task-range-input"
                      value={progress}
                      disabled={!canUpdateProgress || isUpdatingProgress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                    />
                    <div className="preset-pct-group">
                      {[0, 25, 50, 75, 100].map((val) => (
                        <button
                          key={val}
                          type="button"
                          className={`preset-pct-btn ${Number(progress) === val ? "active" : ""}`}
                          disabled={!canUpdateProgress || isUpdatingProgress}
                          onClick={() => setProgress(val)}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="task-update-controls">
                    <div className="form-group">
                      <label className="form-label" htmlFor="update-status">Task Status</label>
                      <select
                        id="update-status"
                        className="emp-select"
                        value={status}
                        disabled={!canUpdateProgress || isUpdatingProgress}
                        onChange={(e) => setStatus(e.target.value)}
                        style={{ width: "100%" }}
                      >
                        <option value="TO_DO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="IN_REVIEW">In Review</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="BLOCKED">Blocked</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="update-actual-hours">Actual Hours Logged</label>
                      <input
                        id="update-actual-hours"
                        type="number"
                        step="0.5"
                        min="0"
                        className="emp-input"
                        placeholder="e.g. 12.5"
                        value={actualHours}
                        disabled={!canUpdateProgress || isUpdatingProgress}
                        onChange={(e) => setActualHours(e.target.value)}
                      />
                    </div>
                  </div>

                  {canUpdateProgress && (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={isUpdatingProgress}
                        style={{ padding: "8px 18px", fontSize: "13px" }}
                      >
                        {isUpdatingProgress ? "Saving..." : "Save Progress & Status"}
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {/* Metadata Grid */}
              <div className="task-info-grid">
                <div className="task-info-item">
                  <span className="task-info-label">Assignee</span>
                  <span className="task-info-val">{task.assignee_name || "Unassigned"}</span>
                  <span style={{ fontSize: "11.5px", color: "var(--text)" }}>{task.assignee_email}</span>
                </div>

                <div className="task-info-item">
                  <span className="task-info-label">Assigned By</span>
                  <span className="task-info-val">{task.assigning_manager_name || "System"}</span>
                </div>

                <div className="task-info-item">
                  <span className="task-info-label">Timeline</span>
                  <span className="task-info-val">
                    {formatDate(task.start_date)} → {formatDate(task.due_date)}
                  </span>
                </div>

                <div className="task-info-item">
                  <span className="task-info-label">Hours Tracking</span>
                  <span className="task-info-val">
                    {task.actual_hours || 0}h logged / {task.estimated_hours || 0}h est.
                  </span>
                </div>
              </div>

              {/* Tabs for Comments and History */}
              <div>
                <div className="task-tabs">
                  <button
                    type="button"
                    className={`task-tab-btn ${activeTab === "comments" ? "active" : ""}`}
                    onClick={() => setActiveTab("comments")}
                  >
                    💬 Comments
                    <span className="task-tab-count">{comments.length}</span>
                  </button>
                  <button
                    type="button"
                    className={`task-tab-btn ${activeTab === "history" ? "active" : ""}`}
                    onClick={() => setActiveTab("history")}
                  >
                    📜 Change History
                    <span className="task-tab-count">{history.length}</span>
                  </button>
                </div>

                {activeTab === "comments" ? (
                  <div className="task-comments-feed" style={{ marginTop: "16px" }}>
                    {/* Add comment box */}
                    <form onSubmit={handleAddComment} className="task-new-comment-box">
                      <textarea
                        rows={2}
                        placeholder="Write a comment or update about this task..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        disabled={isPostingComment}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={!newComment.trim() || isPostingComment}
                          style={{ padding: "6px 14px", fontSize: "12.5px" }}
                        >
                          {isPostingComment ? "Posting..." : "Post Comment"}
                        </button>
                      </div>
                    </form>

                    {/* Existing comments list */}
                    {comments.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px", color: "var(--text)", fontSize: "13px" }}>
                        No comments yet. Be the first to share an update!
                      </div>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="task-comment-card">
                          <div className="task-comment-avatar">
                            {c.author_name ? c.author_name[0].toUpperCase() : "U"}
                          </div>
                          <div className="task-comment-content">
                            <div className="task-comment-meta">
                              <span className="task-comment-author">{c.author_name}</span>
                              <span className="task-comment-time">{formatDateTime(c.created_at)}</span>
                            </div>
                            <p className="task-comment-text">{c.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: "16px" }}>
                    {history.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px", color: "var(--text)", fontSize: "13px" }}>
                        No recorded changes yet.
                      </div>
                    ) : (
                      <div className="task-history-timeline">
                        {history.map((h) => (
                          <div key={h.id} className="history-item">
                            <div className="history-header">
                              <span className="history-author">{h.changed_by_name || "System"}</span>
                              <span>•</span>
                              <span>{formatDateTime(h.created_at)}</span>
                            </div>
                            <div className="history-change">
                              Changed <strong>{h.field_changed}</strong> from{" "}
                              <code>{h.old_value || "none"}</code> to{" "}
                              <code>{h.new_value || "none"}</code>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "16px 24px", display: "flex", justifyContent: "space-between" }}>
          <div>
            {canManage && task && (
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onClose();
                    onEditTask(task);
                  }}
                  style={{ fontSize: "13px" }}
                >
                  ✎ Edit Task
                </button>
                <button
                  type="button"
                  className="logout-btn"
                  onClick={() => {
                    onClose();
                    onArchiveTask(task);
                  }}
                  style={{ fontSize: "13px", padding: "6px 14px", margin: 0 }}
                >
                  🗑 Archive Task
                </button>
              </div>
            )}
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
