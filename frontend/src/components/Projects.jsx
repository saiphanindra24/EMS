import { useEffect, useState } from "react";
import "./Projects.css";
import { useAuth } from "../context/AuthContext";
import projectService from "../services/projectService";

export default function Projects() {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN" || user?.role === "MANAGER";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("projects");

  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [dwrReports, setDwrReports] = useState([]);
  const [todayStatus, setTodayStatus] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals
  const [selectedProject, setSelectedProject] = useState(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showDwrModal, setShowDwrModal] = useState(false);

  // DWR Form State
  const [dwrProjectId, setDwrProjectId] = useState("");
  const [dwrHours, setDwrHours] = useState("8.00");
  const [dwrSummary, setDwrSummary] = useState("");
  const [dwrIssues, setDwrIssues] = useState("");
  const [dwrTomorrow, setDwrTomorrow] = useState("");
  const [submittingDwr, setSubmittingDwr] = useState(false);

  // Project Form State
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creatingPrj, setCreatingPrj] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (statusFilter) params.status = statusFilter;

      const [prjData, statsData, dwrData, todayData] = await Promise.all([
        projectService.getProjects(params),
        projectService.getProjectStats(),
        projectService.getDailyWorkReports(),
        projectService.getTodayReportStatus(),
      ]);

      setProjects(prjData?.results || prjData || []);
      setStats(statsData);
      setDwrReports(dwrData?.results || dwrData || []);
      setTodayStatus(todayData);
    } catch (err) {
      console.error("Failed to load project & DWR records:", err);
      setError("Unable to retrieve project tracking records. Please verify connection.");
    } finally {
      setLoading(false);
    }
  }

  const formatINR = (val) => {
    const num = parseFloat(val || 0);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const filteredProjects = projects.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name?.toLowerCase().includes(term) ||
      p.code?.toLowerCase().includes(term) ||
      p.client_name?.toLowerCase().includes(term)
    );
  });

  const handleToggleMilestone = async (milestoneId) => {
    try {
      await projectService.toggleMilestone(milestoneId);
      // Refresh current project detail
      if (selectedProject) {
        const updated = await projectService.getProjectDetail(selectedProject.id);
        setSelectedProject(updated);
      }
      await loadData();
    } catch (err) {
      alert("Failed to toggle milestone: " + err.message);
    }
  };

  const handleSubmitDwr = async (e) => {
    e.preventDefault();
    try {
      setSubmittingDwr(true);
      await projectService.submitDailyWorkReport({
        project: dwrProjectId || undefined,
        hours_worked: dwrHours,
        activities_summary: dwrSummary,
        issues_faced: dwrIssues,
        plan_for_tomorrow: dwrTomorrow,
      });
      setShowDwrModal(false);
      setDwrSummary("");
      setDwrIssues("");
      setDwrTomorrow("");
      await loadData();
    } catch (err) {
      alert("Failed to submit daily report: " + (err.response?.data?.detail || err.message));
    } finally {
      setSubmittingDwr(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      setCreatingPrj(true);
      await projectService.createProject({
        code: newCode,
        name: newName,
        client_name: newClient || "Internal VolkssKatt",
        budget: newBudget || "0.00",
        description: newDesc,
      });
      setShowNewProjectModal(false);
      setNewCode("");
      setNewName("");
      setNewClient("");
      setNewBudget("");
      setNewDesc("");
      await loadData();
    } catch (err) {
      alert("Failed to create project: " + (err.response?.data?.detail || err.message));
    } finally {
      setCreatingPrj(false);
    }
  };

  const handleReviewDwr = async (id, action) => {
    const feedback = action === "REQUEST_REVISION" ? prompt("Please enter revision instructions for the employee:") : "";
    if (action === "REQUEST_REVISION" && feedback === null) return;

    try {
      await projectService.reviewDailyWorkReport(id, {
        action,
        manager_feedback: feedback || "Approved by Project Lead",
      });
      await loadData();
    } catch (err) {
      alert("Failed to review report: " + err.message);
    }
  };

  return (
    <div className="prj-container">
      {/* ─── Top Executive Header ─── */}
      <header className="prj-header">
        <div className="prj-header-titles">
          <h1>
            <span>📂</span> Projects & Daily Work Tracking
          </h1>
          <p>VolkssKatt Enterprise Work Tracking System (WTS) & Daily Accountability Hub</p>
        </div>

        <div className="prj-header-actions">
          <button className="btn-secondary-action" onClick={() => setShowDwrModal(true)}>
            <span>📝</span> Submit Daily Report
          </button>
          {isAdminOrManager && (
            <button className="btn-primary-action" onClick={() => setShowNewProjectModal(true)}>
              <span>+</span> New Project
            </button>
          )}
        </div>
      </header>

      {/* ─── KPI Metrics Grid ─── */}
      <section className="prj-kpi-grid">
        <div className="prj-kpi-card">
          <div className="kpi-icon-box">🚀</div>
          <div className="kpi-label">Active Projects</div>
          <div className="kpi-value">{stats?.active_projects ?? 2} Projects</div>
          <div className="kpi-subtext">Across Engineering & Design</div>
        </div>

        <div className="prj-kpi-card">
          <div className="kpi-icon-box">💼</div>
          <div className="kpi-label">Committed Client Budget</div>
          <div className="kpi-value">{formatINR(stats?.total_budget ?? 7000000)}</div>
          <div className="kpi-subtext">{formatINR(stats?.total_spent ?? 2800000)} Spent to Date</div>
        </div>

        <div className="prj-kpi-card">
          <div className="kpi-icon-box">📋</div>
          <div className="kpi-label">Daily Reports Today</div>
          <div className="kpi-value">{dwrReports.length} Submitted</div>
          <div className="kpi-subtext">
            {todayStatus?.has_submitted ? "✓ Your report is submitted" : "⚠️ Your report is pending"}
          </div>
        </div>

        <div className="prj-kpi-card">
          <div className="kpi-icon-box">🎯</div>
          <div className="kpi-label">Delivery Progress</div>
          <div className="kpi-value">62% Average</div>
          <div className="kpi-subtext">On-track milestones</div>
        </div>
      </section>

      {/* ─── Tabs Bar ─── */}
      <nav className="prj-tabs-bar">
        <button
          className={`prj-tab-btn ${activeTab === "projects" ? "active" : ""}`}
          onClick={() => setActiveTab("projects")}
        >
          📂 Client & Internal Projects ({projects.length})
        </button>
        <button
          className={`prj-tab-btn ${activeTab === "dwr" ? "active" : ""}`}
          onClick={() => setActiveTab("dwr")}
        >
          📝 Daily Work Reports Feed ({dwrReports.length})
        </button>
      </nav>

      {/* ─── TAB 1: PROJECTS GRID ─── */}
      {activeTab === "projects" && (
        <section className="prj-tab-content" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <input
              type="text"
              placeholder="Search by Project Name, Code, or Client…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                minWidth: "280px",
                outline: "none",
              }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PLANNING">Planning</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div className="projects-grid">
            {filteredProjects.map((p) => (
              <div key={p.id} className="project-card">
                <div className="prj-card-top">
                  <div>
                    <span className="prj-code-badge">{p.code}</span>
                    <h3 className="prj-card-title">{p.name}</h3>
                    <p className="prj-client-name">Client: {p.client_name}</p>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      background: p.health === "ON_TRACK" ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                      color: p.health === "ON_TRACK" ? "#059669" : "#d97706",
                      border: p.health === "ON_TRACK" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                      textTransform: "uppercase",
                    }}
                  >
                    ● {p.health_display || p.health}
                  </span>
                </div>

                <p className="prj-desc-snippet">{p.description}</p>

                {/* Progress */}
                <div className="prj-progress-section">
                  <div className="prj-progress-meta">
                    <span>Milestone Progress</span>
                    <span>{p.progress_percentage}%</span>
                  </div>
                  <div className="prj-progress-bar">
                    <div className="prj-progress-fill" style={{ width: `${p.progress_percentage}%` }} />
                  </div>
                </div>

                {/* Meta Grid */}
                <div className="prj-card-meta-grid">
                  <div className="prj-meta-item">
                    <span>Allocated Budget</span>
                    <span>{formatINR(p.budget)}</span>
                  </div>
                  <div className="prj-meta-item">
                    <span>Lead Architect</span>
                    <span>{p.lead_name || "Unassigned"}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="prj-card-footer">
                  <div className="prj-team-stack">
                    {(p.memberships || []).slice(0, 3).map((m, idx) => (
                      <div key={idx} className="prj-team-avatar" title={`${m.employee_name} (${m.role})`}>
                        {m.employee_name?.slice(0, 2).toUpperCase() || "EM"}
                      </div>
                    ))}
                    {(p.memberships || []).length > 3 && (
                      <div className="prj-team-avatar" style={{ background: "#64748b" }}>
                        +{p.memberships.length - 3}
                      </div>
                    )}
                  </div>

                  <button className="btn-inspect-prj" onClick={() => setSelectedProject(p)}>
                    Milestones & Team →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── TAB 2: DAILY WORK REPORTS (DWR) ─── */}
      {activeTab === "dwr" && (
        <section className="prj-tab-content" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Daily Status Banner */}
          <div className="dwr-status-banner">
            <div className="dwr-banner-left">
              <div className="dwr-banner-icon">
                {todayStatus?.has_submitted ? "✅" : "⚠️"}
              </div>
              <div className="dwr-banner-text">
                <h3>
                  {todayStatus?.has_submitted
                    ? "Today's Work Report is Logged"
                    : "Today's Daily Work Report is Pending"}
                </h3>
                <p>
                  {todayStatus?.has_submitted
                    ? `Logged: ${todayStatus.report.hours_worked} hours • Status: ${todayStatus.report.status_display}`
                    : "Please submit your end-of-day work log to keep your project lead and teammates synchronized."}
                </p>
              </div>
            </div>

            {!todayStatus?.has_submitted && (
              <button className="btn-primary-action" onClick={() => setShowDwrModal(true)}>
                <span>📝</span> Submit Today's DWR
              </button>
            )}
          </div>

          {/* DWR Feed */}
          <div className="dwr-feed-list">
            {dwrReports.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b", background: "#fff", borderRadius: "16px" }}>
                No daily work reports submitted yet.
              </div>
            ) : (
              dwrReports.map((report) => (
                <div key={report.id} className="dwr-card">
                  <div className="dwr-card-header">
                    <div className="dwr-emp-info">
                      <div className="dwr-emp-avatar">
                        {report.employee_name?.slice(0, 2).toUpperCase() || "EM"}
                      </div>
                      <div>
                        <div style={{ fontWeight: "700", color: "#0f172a" }}>{report.employee_name}</div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          {report.employee_id_code} • {report.department_name}
                          {report.project_name && ` • Project: ${report.project_name}`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>
                        📅 {report.report_date} • ⏱️ {report.hours_worked} hrs
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background:
                            report.status === "APPROVED"
                              ? "rgba(16, 185, 129, 0.12)"
                              : report.status === "SUBMITTED"
                              ? "rgba(14, 165, 233, 0.12)"
                              : "rgba(239, 68, 68, 0.12)",
                          color:
                            report.status === "APPROVED"
                              ? "#059669"
                              : report.status === "SUBMITTED"
                              ? "#0284c7"
                              : "#dc2626",
                          border: "1px solid rgba(0,0,0,0.05)",
                          textTransform: "uppercase",
                        }}
                      >
                        ● {report.status_display || report.status}
                      </span>
                    </div>
                  </div>

                  <div className="dwr-body-section">
                    <span className="dwr-label">Key Activities & Deliverables Completed:</span>
                    <p className="dwr-text">{report.activities_summary}</p>
                  </div>

                  {report.issues_faced && (
                    <div className="dwr-blockers-box">
                      <strong>⚠️ Roadblocks / Issues Faced:</strong> {report.issues_faced}
                    </div>
                  )}

                  {report.plan_for_tomorrow && (
                    <div className="dwr-tomorrow-box">
                      <strong>🎯 Plan for Tomorrow:</strong> {report.plan_for_tomorrow}
                    </div>
                  )}

                  {/* Manager Review Section */}
                  {isAdminOrManager && report.status === "SUBMITTED" && (
                    <div className="dwr-review-bar">
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        Lead Review Action:
                      </span>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="btn-approve-dwr"
                          onClick={() => handleReviewDwr(report.id, "APPROVE")}
                        >
                          ✓ Approve
                        </button>
                        <button
                          className="btn-reject-dwr"
                          onClick={() => handleReviewDwr(report.id, "REQUEST_REVISION")}
                        >
                          ✏️ Request Revision
                        </button>
                      </div>
                    </div>
                  )}

                  {report.manager_feedback && (
                    <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                      💬 Lead Feedback: "{report.manager_feedback}" (by {report.reviewed_by_name || "Manager"})
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* ─── MODAL 1: PROJECT DETAIL & MILESTONES ─── */}
      {selectedProject && (
        <div className="prj-modal-backdrop" onClick={() => setSelectedProject(null)}>
          <div className="prj-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="prj-modal-header">
              <div>
                <span className="prj-code-badge">{selectedProject.code}</span>
                <h3 style={{ margin: "4px 0 0 0" }}>{selectedProject.name}</h3>
              </div>
              <button
                style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b" }}
                onClick={() => setSelectedProject(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <p style={{ margin: 0, color: "#475569", fontSize: "13px", lineHeight: "1.5" }}>
                {selectedProject.description}
              </p>

              {/* Milestones Checklist */}
              <div>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#0f172a" }}>
                  Milestones Checklist ({selectedProject.milestones?.length || 0})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(selectedProject.milestones || []).map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px" }}>
                        <input
                          type="checkbox"
                          checked={m.is_achieved}
                          onChange={() => handleToggleMilestone(m.id)}
                        />
                        <span style={{ textDecoration: m.is_achieved ? "line-through" : "none", color: m.is_achieved ? "#64748b" : "#0f172a", fontWeight: "600" }}>
                          {m.title}
                        </span>
                      </label>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        Due: {m.due_date}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Members */}
              <div>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#0f172a" }}>
                  Allocated Resource Team ({selectedProject.memberships?.length || 0})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(selectedProject.memberships || []).map((mem, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    >
                      <div>
                        <strong>{mem.employee_name}</strong> ({mem.employee_id_code})
                      </div>
                      <div style={{ color: "#7c3aed", fontWeight: "600" }}>
                        {mem.role} • {mem.allocation_percentage}% Capacity
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: SUBMIT DAILY WORK REPORT ─── */}
      {showDwrModal && (
        <div className="prj-modal-backdrop" onClick={() => setShowDwrModal(false)}>
          <div className="prj-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="prj-modal-header">
              <h3>📝 Submit Daily Work Report (DWR)</h3>
              <button
                style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b" }}
                onClick={() => setShowDwrModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitDwr} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
                  Project (Optional):
                </label>
                <select
                  value={dwrProjectId}
                  onChange={(e) => setDwrProjectId(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }}
                >
                  <option value="">General Workplace Deliverables</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
                  Hours Worked Today:
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={dwrHours}
                  onChange={(e) => setDwrHours(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
                  Key Activities & Completed Deliverables: *
                </label>
                <textarea
                  rows="3"
                  placeholder="Detail the modules, code commits, reviews, or tasks executed today…"
                  value={dwrSummary}
                  onChange={(e) => setDwrSummary(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
                  Roadblocks or Issues Faced (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Waiting on third-party API keys or design assets…"
                  value={dwrIssues}
                  onChange={(e) => setDwrIssues(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
                  Planned Deliverables for Tomorrow (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Implement automated tests and review PR…"
                  value={dwrTomorrow}
                  onChange={(e) => setDwrTomorrow(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  style={{ background: "transparent", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" }}
                  onClick={() => setShowDwrModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action" disabled={submittingDwr}>
                  {submittingDwr ? "Submitting..." : "Submit Daily Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: CREATE NEW PROJECT ─── */}
      {showNewProjectModal && (
        <div className="prj-modal-backdrop" onClick={() => setShowNewProjectModal(false)}>
          <div className="prj-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="prj-modal-header">
              <h3>+ Create New Project</h3>
              <button
                style={{ background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b" }}
                onClick={() => setShowNewProjectModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateProject} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
                    Project Code: *
                  </label>
                  <input
                    type="text"
                    placeholder="PRJ-104"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
                    Project Name: *
                  </label>
                  <input
                    type="text"
                    placeholder="AI Analytics Dashboard"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
                    Client Name:
                  </label>
                  <input
                    type="text"
                    placeholder="VolkssKatt Enterprise"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
                    Budget (INR ₹):
                  </label>
                  <input
                    type="number"
                    placeholder="1500000"
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
                  Description:
                </label>
                <textarea
                  rows="3"
                  placeholder="Goals, deliverables, and architecture stack…"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  style={{ background: "transparent", border: "1px solid #cbd5e1", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" }}
                  onClick={() => setShowNewProjectModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action" disabled={creatingPrj}>
                  {creatingPrj ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
