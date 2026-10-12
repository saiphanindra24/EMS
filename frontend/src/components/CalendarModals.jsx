import { useState, useEffect } from "react";

// ─── Add / Edit Event Modal ──────────────────────────────────────────────────
export function EventModal({
  isOpen,
  mode = "create",
  initialData = null,
  calendars = [],
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState({
    title: "",
    calendarId: calendars[0]?.id || "my-tasks",
    type: "task", // "task" | "meeting" | "milestone" | "assignment" | "quiz"
    date: "",
    startTime: "09:30",
    endTime: "10:00",
    isAllDay: false,
    description: "",
    targetPage: "Tasks",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        calendarId: initialData.calendarId || calendars[0]?.id || "my-tasks",
        type: initialData.type || "task",
        date: initialData.date || "",
        startTime: initialData.startTime || "09:30",
        endTime: initialData.endTime || "10:00",
        isAllDay: initialData.isAllDay || false,
        description: initialData.description || "",
        targetPage: initialData.targetPage || "Tasks",
      });
    } else {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      setFormData({
        title: "",
        calendarId: calendars[0]?.id || "my-tasks",
        type: "task",
        date: `${yyyy}-${mm}-${dd}`,
        startTime: "09:30",
        endTime: "10:00",
        isAllDay: false,
        description: "",
        targetPage: "Tasks",
      });
    }
  }, [initialData, isOpen, calendars]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    // Automatically associate appropriate page if not explicitly set
    let page = formData.targetPage;
    if (!page) {
      if (formData.calendarId === "morning-scrum" || formData.calendarId === "my-tasks" || formData.calendarId === "sprints") {
        page = "Tasks";
      } else if (formData.calendarId === "evening-update") {
        page = "Attendance";
      } else if (formData.calendarId === "leaves") {
        page = "Leave";
      } else if (formData.calendarId === "one-on-one") {
        page = "Employees";
      }
    }

    onSave({
      ...formData,
      targetPage: page,
      id: initialData?.id || `evt-${Date.now()}`,
    });
    onClose();
  };

  return (
    <div className="cal-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cal-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-header">
          <h3>{mode === "create" ? "Add Workplace Event / Task" : "Edit Event"}</h3>
          <button className="cal-modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cal-modal-body">
            <div className="cal-form-group">
              <label htmlFor="evt-title">Title / Agenda *</label>
              <input
                id="evt-title"
                className="cal-form-input"
                type="text"
                required
                placeholder="e.g. Morning Scrum, PR Review, Client Demo..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="cal-form-row">
              <div className="cal-form-group">
                <label htmlFor="evt-cal">Calendar Category *</label>
                <select
                  id="evt-cal"
                  className="cal-form-select"
                  value={formData.calendarId}
                  onChange={(e) => {
                    const nextCal = e.target.value;
                    let target = "Tasks";
                    if (nextCal === "evening-update") target = "Attendance";
                    else if (nextCal === "leaves") target = "Leave";
                    else if (nextCal === "one-on-one") target = "Employees";
                    setFormData({ ...formData, calendarId: nextCal, targetPage: target });
                  }}
                >
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cal-form-group">
                <label htmlFor="evt-type">Event Type</label>
                <select
                  id="evt-type"
                  className="cal-form-select"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="meeting">👥 Meeting / Scrum Call</option>
                  <option value="task">📋 Employee Task</option>
                  <option value="milestone">🚩 Milestone / Sprint</option>
                  <option value="assignment">📝 Work Deliverable</option>
                  <option value="quiz">🚀 Review / Check-in</option>
                </select>
              </div>
            </div>

            <div className="cal-form-row">
              <div className="cal-form-group">
                <label htmlFor="evt-target-page">Related Module (Opens on click)</label>
                <select
                  id="evt-target-page"
                  className="cal-form-select"
                  value={formData.targetPage}
                  onChange={(e) => setFormData({ ...formData, targetPage: e.target.value })}
                >
                  <option value="Tasks">Tasks Module</option>
                  <option value="Attendance">Attendance Module</option>
                  <option value="Leave">Leave Management Module</option>
                  <option value="Employees">Employee Directory Module</option>
                  <option value="Reports">Reports Module</option>
                </select>
              </div>

              <div className="cal-form-group">
                <label htmlFor="evt-date">Date *</label>
                <input
                  id="evt-date"
                  type="date"
                  className="cal-form-input"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>

            <div className="cal-form-row">
              <div className="cal-form-group">
                <label htmlFor="evt-start">Time / Start Time</label>
                <input
                  id="evt-start"
                  type="time"
                  className="cal-form-input"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>

              <div className="cal-form-group">
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 24, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formData.isAllDay}
                    onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
                  />
                  <span>All Day Event</span>
                </label>
              </div>
            </div>

            <div className="cal-form-group">
              <label htmlFor="evt-desc">Description / Agenda Notes</label>
              <textarea
                id="evt-desc"
                className="cal-form-textarea"
                rows="3"
                placeholder="Optional meeting link, deliverables, or checklist..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <div className="cal-modal-footer">
            <button type="button" className="cal-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="cal-btn"
              style={{ background: "#7c3aed", color: "#fff", borderColor: "#7c3aed" }}
            >
              {mode === "create" ? "Create Event" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Event Detail View Modal ─────────────────────────────────────────────────
export function EventDetailModal({
  event,
  calendar,
  onClose,
  onEdit,
  onDelete,
  onNavigate,
}) {
  if (!event) return null;

  const typeIcons = {
    meeting: "👥",
    task: "📋",
    milestone: "🚩",
    assignment: "📝",
    quiz: "🚀",
  };

  const typeLabels = {
    meeting: "Meeting / Scrum",
    task: "Workplace Task",
    milestone: "Sprint / Milestone",
    assignment: "Work Deliverable",
    quiz: "Work Review",
  };

  const handleNavigateToPage = () => {
    if (event.targetPage && onNavigate) {
      onNavigate(event.targetPage);
      onClose();
    }
  };

  return (
    <div className="cal-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cal-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{typeIcons[event.type] || "📅"}</span>
            <h3 style={{ margin: 0 }}>{event.title}</h3>
          </div>
          <button className="cal-modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="cal-modal-body">
          <div
            className="cal-detail-badge"
            style={{
              backgroundColor: `${calendar?.color || "#6b7280"}18`,
              color: calendar?.color || "#374151",
              border: `1px solid ${calendar?.color || "#6b7280"}50`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: calendar?.color || "#6b7280",
                display: "inline-block",
              }}
            />
            {calendar?.name || "Workplace Schedule"}
          </div>

          <div className="cal-detail-meta">
            <div className="cal-detail-meta-row">
              <span className="cal-detail-meta-label">Type:</span>
              <span>{typeLabels[event.type] || "Event"}</span>
            </div>
            <div className="cal-detail-meta-row">
              <span className="cal-detail-meta-label">Date:</span>
              <span>{event.date}</span>
            </div>
            {event.startTime && (
              <div className="cal-detail-meta-row">
                <span className="cal-detail-meta-label">Time:</span>
                <span>{event.isAllDay ? "All Day" : `${event.startTime} - ${event.endTime || "End"}`}</span>
              </div>
            )}
            {event.targetPage && (
              <div className="cal-detail-meta-row">
                <span className="cal-detail-meta-label">Module:</span>
                <span style={{ color: "#7c3aed", fontWeight: 600 }}>
                  Linked to {event.targetPage} Page
                </span>
              </div>
            )}
          </div>

          {event.description && (
            <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.5 }}>
              <strong>Description &amp; Agenda:</strong>
              <p style={{ margin: "4px 0 0", color: "#4b5563" }}>{event.description}</p>
            </div>
          )}
        </div>

        <div className="cal-modal-footer">
          {event.type === "meeting" && onNavigate && (
            <button
              type="button"
              className="cal-btn"
              style={{
                background: "#059669",
                color: "#fff",
                borderColor: "#059669",
                fontWeight: 600,
                marginRight: 6,
              }}
              onClick={() => {
                onNavigate("Meet & Chat");
                onClose();
              }}
            >
              📹 Join Call in Meet &amp; Chat
            </button>
          )}

          {event.targetPage && onNavigate && (
            <button
              type="button"
              className="cal-btn"
              style={{
                background: "#7c3aed",
                color: "#fff",
                borderColor: "#7c3aed",
                fontWeight: 600,
                marginRight: "auto",
              }}
              onClick={handleNavigateToPage}
            >
              👉 Open {event.targetPage} Page
            </button>
          )}

          <button
            type="button"
            className="cal-btn"
            style={{ color: "#dc2626", borderColor: "#fca5a5" }}
            onClick={() => {
              if (window.confirm("Are you sure you want to remove this event?")) {
                onDelete(event.id);
                onClose();
              }
            }}
          >
            Delete
          </button>
          <button
            type="button"
            className="cal-btn"
            onClick={() => {
              onEdit(event);
              onClose();
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="cal-btn"
            style={{ background: "#465561", color: "#fff", borderColor: "#465561" }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Feed Modal ─────────────────────────────────────────────────────
export function CalendarFeedModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const feedUrl = `${window.location.origin}/api/v1/calendar/feed.ics?token=emwts_feed_key_2026`;

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="cal-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cal-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>📅</span>
            <h3 style={{ margin: 0 }}>Workplace Calendar Subscription</h3>
          </div>
          <button className="cal-modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="cal-modal-body">
          <p style={{ margin: 0, fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
            Subscribe to this work calendar feed in your external calendar application (Google Calendar, Outlook, Apple Calendar).
            Tasks, daily scrum calls, and company milestones will automatically sync.
          </p>

          <div className="cal-form-group">
            <label>Workplace Calendar Feed URL</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="cal-form-input"
                type="text"
                readOnly
                value={feedUrl}
                style={{ background: "#f9fafb", fontSize: 12.5 }}
              />
              <button
                type="button"
                className="cal-btn"
                style={{
                  background: copied ? "#059669" : "#7c3aed",
                  color: "#fff",
                  borderColor: copied ? "#059669" : "#7c3aed",
                  whiteSpace: "nowrap",
                }}
                onClick={handleCopy}
              >
                {copied ? "✓ Copied!" : "Copy URL"}
              </button>
            </div>
          </div>

          <div style={{ background: "#f3f4f6", padding: 12, borderRadius: 6, fontSize: 12, color: "#4b5563" }}>
            <strong>How to subscribe:</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.5 }}>
              <li><strong>Google Calendar:</strong> Other Calendars (+) &gt; From URL &gt; Paste link</li>
              <li><strong>Apple Calendar:</strong> File &gt; New Calendar Subscription &gt; Paste link</li>
              <li><strong>Microsoft Outlook:</strong> Add Calendar &gt; Subscribe from web &gt; Paste link</li>
            </ul>
          </div>
        </div>

        <div className="cal-modal-footer">
          <button type="button" className="cal-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
