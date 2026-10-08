import { useState, useEffect } from "react";
import { employeeService } from "../services/employeeService";

export default function TaskModal({
  isOpen,
  mode = "create", // "create" | "edit"
  task = null,
  onClose,
  onSave,
  isLoading = false,
}) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignee: "",
    department: "",
    priority: "MEDIUM",
    status: "TO_DO",
    start_date: "",
    due_date: "",
    estimated_hours: "",
  });

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load employee & department options when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingOptions(true);
    setErrorMsg("");

    Promise.all([
      employeeService.getEmployees({ page_size: 100, status: "ACTIVE" }).catch(() => ({ results: [] })),
      employeeService.getDepartments({ page_size: 100, is_active: true }).catch(() => ({ results: [] })),
    ]).then(([empRes, deptRes]) => {
      if (!isMounted) return;
      const empList = empRes.results || empRes || [];
      const deptList = deptRes.results || deptRes || [];
      setEmployees(empList);
      setDepartments(deptList);
      setLoadingOptions(false);
    });

    if (mode === "edit" && task) {
      setFormData({
        title: task.title || "",
        description: task.description || "",
        assignee: task.assignee || "",
        department: task.department || "",
        priority: task.priority || "MEDIUM",
        status: task.status || "TO_DO",
        start_date: task.start_date || "",
        due_date: task.due_date || "",
        estimated_hours: task.estimated_hours !== null && task.estimated_hours !== undefined ? task.estimated_hours : "",
      });
    } else {
      // Default dates: today & +7 days
      const today = new Date().toISOString().split("T")[0];
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      setFormData({
        title: "",
        description: "",
        assignee: "",
        department: "",
        priority: "MEDIUM",
        status: "TO_DO",
        start_date: today,
        due_date: nextWeek,
        estimated_hours: "8.0",
      });
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, mode, task]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Auto-assign department if assignee is chosen and department is not set
      if (name === "assignee" && value) {
        const emp = employees.find((em) => String(em.id) === String(value));
        if (emp && emp.department && !prev.department) {
          next.department = emp.department;
        }
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.title.trim()) {
      setErrorMsg("Task title is required.");
      return;
    }
    if (!formData.assignee) {
      setErrorMsg("Please select an assignee for this task.");
      return;
    }
    if (!formData.due_date) {
      setErrorMsg("Due date is required.");
      return;
    }
    if (formData.start_date && formData.due_date && formData.due_date < formData.start_date) {
      setErrorMsg("Due date cannot be before the start date.");
      return;
    }
    if (formData.estimated_hours && Number(formData.estimated_hours) < 0) {
      setErrorMsg("Estimated hours cannot be negative.");
      return;
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      assignee: parseInt(formData.assignee, 10),
      priority: formData.priority,
      status: formData.status,
      due_date: formData.due_date,
    };

    if (formData.department) {
      payload.department = parseInt(formData.department, 10);
    }
    if (formData.start_date) {
      payload.start_date = formData.start_date;
    }
    if (formData.estimated_hours !== "") {
      payload.estimated_hours = parseFloat(formData.estimated_hours);
    }

    onSave(payload);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "640px" }}>
        <div className="modal-header">
          <h2>{mode === "edit" ? `Edit Task (${task?.task_id || "Task"})` : "Assign New Task"}</h2>
          <button className="modal-close-btn" onClick={onClose} disabled={isLoading}>
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="alert-banner error" style={{ margin: "16px 24px 0" }}>
            <span>⚠</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group">
            <label className="form-label" htmlFor="task-title">
              Task Title <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              id="task-title"
              name="title"
              type="text"
              className="emp-input"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Implement OAuth2 client login flow"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-desc">
              Description &amp; Requirements
            </label>
            <textarea
              id="task-desc"
              name="description"
              className="emp-input"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              placeholder="Outline deliverables, acceptance criteria, links, or context..."
              disabled={isLoading}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="task-assignee">
                Assignee <span style={{ color: "#f87171" }}>*</span>
              </label>
              <select
                id="task-assignee"
                name="assignee"
                className="emp-select"
                value={formData.assignee}
                onChange={handleChange}
                required
                disabled={isLoading || loadingOptions}
                style={{ width: "100%" }}
              >
                <option value="">-- Select Employee --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_id || emp.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="task-dept">
                Department
              </label>
              <select
                id="task-dept"
                name="department"
                className="emp-select"
                value={formData.department}
                onChange={handleChange}
                disabled={isLoading || loadingOptions}
                style={{ width: "100%" }}
              >
                <option value="">-- Select Department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="task-priority">
                Priority
              </label>
              <select
                id="task-priority"
                name="priority"
                className="emp-select"
                value={formData.priority}
                onChange={handleChange}
                disabled={isLoading}
                style={{ width: "100%" }}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent ⚡</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="task-status">
                Status
              </label>
              <select
                id="task-status"
                name="status"
                className="emp-select"
                value={formData.status}
                onChange={handleChange}
                disabled={isLoading}
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
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="task-start-date">
                Start Date
              </label>
              <input
                id="task-start-date"
                name="start_date"
                type="date"
                className="emp-input"
                value={formData.start_date}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="task-due-date">
                Due Date <span style={{ color: "#f87171" }}>*</span>
              </label>
              <input
                id="task-due-date"
                name="due_date"
                type="date"
                className="emp-input"
                value={formData.due_date}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="task-est-hours">
                Est. Hours
              </label>
              <input
                id="task-est-hours"
                name="estimated_hours"
                type="number"
                step="0.5"
                min="0"
                className="emp-input"
                value={formData.estimated_hours}
                onChange={handleChange}
                placeholder="e.g. 8"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: "12px" }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? "Saving..." : mode === "edit" ? "Save Changes" : "Assign Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
