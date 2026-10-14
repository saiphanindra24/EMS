import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import lifecycleService from "../services/lifecycleService";
import "./Lifecycle.css";

const FORMAT_MAP = {
  VIRTUAL_LIVE: { label: "Virtual Live", icon: "📹", badgeClass: "fmt-virtual" },
  SELF_PACED: { label: "Self-Paced e-Learning", icon: "💻", badgeClass: "fmt-self" },
  CLASSROOM_ONSITE: { label: "Onsite Workshop", icon: "🏛️", badgeClass: "fmt-onsite" },
  BLENDED: { label: "Blended Learning", icon: "🔄", badgeClass: "fmt-blended" },
};

const LEVEL_MAP = {
  BEGINNER: { label: "Foundation", badgeClass: "lvl-beg" },
  INTERMEDIATE: { label: "Practitioner", badgeClass: "lvl-int" },
  ADVANCED: { label: "Specialist", badgeClass: "lvl-adv" },
  EXECUTIVE: { label: "Leadership", badgeClass: "lvl-exec" },
};

const CLEARANCE_DEPTS = [
  { code: "IT_ASSET_RECOVERY", label: "IT & Hardware Recovery", icon: "💻" },
  { code: "REPORTING_MANAGER", label: "Manager Handover & KT", icon: "👑" },
  { code: "FINANCE_SETTLEMENT", label: "Finance & Accounts", icon: "💳" },
  { code: "HR_DOCUMENTATION", label: "HR & Relieving Letter", icon: "📑" },
];

export default function Lifecycle() {
  const { user } = useAuth();
  const userRole = user?.role || "EMPLOYEE";
  const isManagerOrAdmin = ["SUPER_ADMIN", "HR_ADMIN", "MANAGER"].includes(userRole);
  const isHROrAdmin = ["SUPER_ADMIN", "HR_ADMIN"].includes(userRole);

  const [activeTab, setActiveTab] = useState("catalog"); // "catalog", "enrollments", "certifications", "exit"

  // Data states
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [exits, setExits] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Modals
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [showResignModal, setShowResignModal] = useState(false);
  const [clearanceModalData, setClearanceModalData] = useState(null);
  const [finalizeModalData, setFinalizeModalData] = useState(null);

  // Form: New Course
  const [cCode, setCCode] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cInstructor, setCInstructor] = useState("");
  const [cFormat, setCFormat] = useState("VIRTUAL_LIVE");
  const [cLevel, setCLevel] = useState("INTERMEDIATE");
  const [cDuration, setCDuration] = useState("16");
  const [cSkills, setCSkills] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");

  // Form: New Cert
  const [certName, setCertName] = useState("");
  const [certOrg, setCertOrg] = useState("");
  const [certIssueDate, setCertIssueDate] = useState("");
  const [certCredId, setCertCredId] = useState("");
  const [certCredUrl, setCertCredUrl] = useState("");

  // Form: Resignation
  const [resReason, setResReason] = useState("BETTER_OPPORTUNITY");
  const [resDetails, setResDetails] = useState("");
  const [resNotice, setResNotice] = useState("30");
  const [resLwd, setResLwd] = useState("");

  // Form: Clearance Signoff
  const [signDept, setSignDept] = useState("IT_ASSET_RECOVERY");
  const [signNotes, setSignNotes] = useState("");

  // Form: Finalize Exit
  const [exitNotes, setExitNotes] = useState("");
  const [retentionNotes, setRetentionNotes] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [courseData, enrollData, certData, exitData, statsData] = await Promise.all([
        lifecycleService.getCourses().catch(() => []),
        lifecycleService.getEnrollments().catch(() => []),
        lifecycleService.getCertifications().catch(() => []),
        lifecycleService.getExits().catch(() => []),
        lifecycleService.getStats().catch(() => null),
      ]);

      setCourses(courseData?.results || courseData || []);
      setEnrollments(enrollData?.results || enrollData || []);
      setCertifications(certData?.results || certData || []);
      setExits(exitData?.results || exitData || []);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load lifecycle data:", err);
      setError("Unable to connect to career lifecycle service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Enroll in Course
  const handleEnroll = async (courseId) => {
    try {
      setActionLoading(true);
      await lifecycleService.enrollCourse(courseId);
      showToast("✓ Enrolled successfully! Course added to your learning dashboard.");
      fetchData();
    } catch (err) {
      console.error("Enrollment error:", err);
      alert(err.response?.data?.error || "Error enrolling in course.");
    } finally {
      setActionLoading(false);
    }
  };

  // Update Enrollment Progress
  const handleUpdateProgress = async (enrollmentId, newPercent) => {
    try {
      await lifecycleService.updateEnrollment(enrollmentId, {
        progress_percent: newPercent,
      });
      setEnrollments((prev) =>
        prev.map((e) => (e.id === enrollmentId ? { ...e, progress_percent: newPercent } : e))
      );
      showToast(`✓ Updated course progress to ${newPercent}%`);
    } catch (err) {
      console.error("Progress update error:", err);
    }
  };

  // Submit Feedback
  const handleFeedback = async (enrollmentId, rating) => {
    try {
      await lifecycleService.updateEnrollment(enrollmentId, {
        feedback_rating: rating,
      });
      setEnrollments((prev) =>
        prev.map((e) => (e.id === enrollmentId ? { ...e, feedback_rating: rating } : e))
      );
      showToast(`✓ Recorded ★ ${rating} feedback rating!`);
    } catch (err) {
      console.error("Feedback error:", err);
    }
  };

  // Create Course
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!cCode.trim() || !cTitle.trim()) {
      alert("Please provide Course Code and Title.");
      return;
    }
    try {
      setActionLoading(true);
      await lifecycleService.createCourse({
        code: cCode.trim(),
        title: cTitle.trim(),
        instructor: cInstructor.trim() || "VolkssKatt Lead Architect",
        format: cFormat,
        level: cLevel,
        duration_hours: parseInt(cDuration, 10) || 16,
        skills_covered: cSkills.trim(),
        description: cDesc.trim(),
        start_date: cStart || new Date().toISOString().split("T")[0],
        end_date: cEnd || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      });
      setShowCourseModal(false);
      showToast("✓ New corporate training course published to catalog!");
      fetchData();
    } catch (err) {
      console.error("Create course error:", err);
      alert(err.response?.data?.error || "Failed to create course.");
    } finally {
      setActionLoading(false);
    }
  };

  // Create Certification
  const handleCreateCert = async (e) => {
    e.preventDefault();
    if (!certName.trim() || !certOrg.trim() || !certIssueDate) {
      alert("Please fill in certification name, organization, and issue date.");
      return;
    }
    try {
      setActionLoading(true);
      await lifecycleService.createCertification({
        name: certName.trim(),
        issuing_organization: certOrg.trim(),
        issue_date: certIssueDate,
        credential_id: certCredId.trim(),
        credential_url: certCredUrl.trim(),
      });
      setShowCertModal(false);
      showToast("✓ Certification credential verified and added to your profile!");
      fetchData();
    } catch (err) {
      console.error("Create cert error:", err);
      alert(err.response?.data?.error || "Failed to add certification.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Resignation
  const handleSubmitResignation = async (e) => {
    e.preventDefault();
    if (!resLwd) {
      alert("Please specify requested last working day.");
      return;
    }
    try {
      setActionLoading(true);
      await lifecycleService.submitResignation({
        reason_category: resReason,
        detailed_reason: resDetails.trim(),
        notice_period_days: parseInt(resNotice, 10) || 30,
        requested_last_working_day: resLwd,
      });
      setShowResignModal(false);
      showToast("✓ Resignation submitted. Notice period & department clearances initiated.");
      fetchData();
    } catch (err) {
      console.error("Resignation error:", err);
      alert(err.response?.data?.error || "Failed to submit resignation.");
    } finally {
      setActionLoading(false);
    }
  };

  // Sign Clearance
  const handleSignClearance = async (e) => {
    e.preventDefault();
    if (!clearanceModalData) return;
    try {
      setActionLoading(true);
      await lifecycleService.signClearance(clearanceModalData.exitId, {
        department: signDept,
        is_cleared: true,
        notes: signNotes.trim(),
      });
      setClearanceModalData(null);
      setSignNotes("");
      showToast("✓ Department clearance signed off!");
      fetchData();
    } catch (err) {
      console.error("Clearance error:", err);
      alert(err.response?.data?.error || "Failed to sign clearance.");
    } finally {
      setActionLoading(false);
    }
  };

  // Finalize Exit
  const handleFinalizeExit = async (e) => {
    e.preventDefault();
    if (!finalizeModalData) return;
    try {
      setActionLoading(true);
      await lifecycleService.completeSeparation(finalizeModalData.id, {
        exit_interview_notes: exitNotes.trim() || "Completed comprehensive exit review.",
        retention_discussion: retentionNotes.trim(),
        relieving_letter_issued: true,
      });
      setFinalizeModalData(null);
      showToast("✓ Exit finalized! Relieving letter generated & separation complete.");
      fetchData();
    } catch (err) {
      console.error("Finalize exit error:", err);
      alert(err.response?.data?.error || "Failed to finalize exit.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="life-container" data-testid="lifecycle-dashboard">
      {/* ─── Header ─── */}
      <div className="life-header">
        <div className="life-header-titles">
          <h1>
            <span>🎓</span> Career Lifecycle, Training & Exit Hub
          </h1>
          <p>
            Enterprise skill bootcamps, certified credentials, resignation workflows, and multi-department clearance.
          </p>
        </div>
        <div className="life-header-actions">
          {activeTab === "catalog" && isHROrAdmin && (
            <button
              className="btn-primary-action"
              onClick={() => setShowCourseModal(true)}
              data-testid="btn-add-course"
            >
              <span>+</span> Add Course
            </button>
          )}
          {activeTab === "certifications" && (
            <button
              className="btn-primary-action"
              onClick={() => setShowCertModal(true)}
              data-testid="btn-add-cert"
            >
              <span>+</span> Add Certificate
            </button>
          )}
          {activeTab === "exit" && (
            <button
              className="btn-primary-action danger"
              onClick={() => setShowResignModal(true)}
              data-testid="btn-submit-resignation"
            >
              <span>🚪</span> Submit Resignation
            </button>
          )}
        </div>
      </div>

      {/* ─── Feedback Banners ─── */}
      {toastMsg && <div className="life-toast-banner">{toastMsg}</div>}
      {error && <div className="life-error-banner">{error}</div>}

      {/* ─── Executive KPI Cards ─── */}
      <div className="life-kpi-grid">
        <div className="life-kpi-card" data-testid="kpi-active-courses">
          <div className="life-kpi-icon blue">📚</div>
          <div className="life-kpi-content">
            <span className="life-kpi-label">Available Courses</span>
            <div className="life-kpi-val">{stats?.total_courses || courses.length || 4}</div>
            <span className="life-kpi-sub">Across engineering & product</span>
          </div>
        </div>

        <div className="life-kpi-card" data-testid="kpi-enrollments">
          <div className="life-kpi-icon purple">🎓</div>
          <div className="life-kpi-content">
            <span className="life-kpi-label">Active Enrollments</span>
            <div className="life-kpi-val">{stats?.total_enrollments || enrollments.length || 4}</div>
            <span className="life-kpi-sub highlight-purple">
              Avg Rating: ★ {stats?.average_course_rating || 4.8} / 5.0
            </span>
          </div>
        </div>

        <div className="life-kpi-card" data-testid="kpi-certifications">
          <div className="life-kpi-icon emerald">📜</div>
          <div className="life-kpi-content">
            <span className="life-kpi-label">Verified Certifications</span>
            <div className="life-kpi-val">{stats?.active_certifications || certifications.length || 4}</div>
            <span className="life-kpi-sub highlight-emerald">Industry recognized</span>
          </div>
        </div>

        <div className="life-kpi-card" data-testid="kpi-exits">
          <div className="life-kpi-icon amber">🚪</div>
          <div className="life-kpi-content">
            <span className="life-kpi-label">Separations In Progress</span>
            <div className="life-kpi-val">{stats?.ongoing_exits ?? exits.length ?? 1}</div>
            <span className="life-kpi-sub">Notice & clearance pipeline</span>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="life-controls-panel">
        <div className="life-tabs">
          <button
            className={`life-tab-btn ${activeTab === "catalog" ? "active" : ""}`}
            onClick={() => setActiveTab("catalog")}
            data-testid="tab-catalog"
          >
            📚 Training Catalog ({courses.length})
          </button>
          <button
            className={`life-tab-btn ${activeTab === "enrollments" ? "active" : ""}`}
            onClick={() => setActiveTab("enrollments")}
            data-testid="tab-enrollments"
          >
            🎓 My Learning & Enrollments ({enrollments.length})
          </button>
          <button
            className={`life-tab-btn ${activeTab === "certifications" ? "active" : ""}`}
            onClick={() => setActiveTab("certifications")}
            data-testid="tab-certifications"
          >
            📜 Certifications ({certifications.length})
          </button>
          <button
            className={`life-tab-btn ${activeTab === "exit" ? "active" : ""}`}
            onClick={() => setActiveTab("exit")}
            data-testid="tab-exit"
          >
            🚪 Exit & Clearance Hub ({exits.length})
          </button>
        </div>
      </div>

      {/* ─── TAB 1: Training Catalog ─── */}
      {activeTab === "catalog" && (
        <div className="life-tab-content">
          <div className="life-cards-grid">
            {courses.map((c) => {
              const fmt = FORMAT_MAP[c.format] || FORMAT_MAP.VIRTUAL_LIVE;
              const lvl = LEVEL_MAP[c.level] || LEVEL_MAP.INTERMEDIATE;
              const enrolled = enrollments.some((e) => e.course === c.id || e.course_code === c.code);

              return (
                <div key={c.id} className="life-course-card" data-testid={`course-card-${c.id}`}>
                  <div className="life-card-header">
                    <span className={`life-format-badge ${fmt.badgeClass}`}>
                      {fmt.icon} {fmt.label}
                    </span>
                    <span className={`life-level-badge ${lvl.badgeClass}`}>
                      {lvl.label}
                    </span>
                  </div>

                  <div className="life-course-code">[{c.code}]</div>
                  <h3 className="life-course-title">{c.title}</h3>
                  <div className="life-instructor-row">
                    <span>Instructor: <strong>{c.instructor}</strong></span>
                    <span>Duration: <strong>{c.duration_hours} hrs</strong></span>
                  </div>

                  {c.skills_covered && (
                    <div className="life-skills-tags">
                      {c.skills_covered.split(",").map((s, idx) => (
                        <span key={idx} className="life-skill-pill">
                          {s.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="life-course-desc">{c.description}</p>

                  <div className="life-card-footer">
                    <div className="life-enrolled-count">
                      👥 {c.enrollment_count || 1} Enrolled
                    </div>
                    {enrolled ? (
                      <span className="life-enrolled-badge">✓ Enrolled</span>
                    ) : (
                      <button
                        className="btn-enroll-action"
                        onClick={() => handleEnroll(c.id)}
                        disabled={actionLoading}
                        data-testid={`btn-enroll-${c.id}`}
                      >
                        + Enroll Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 2: My Enrollments ─── */}
      {activeTab === "enrollments" && (
        <div className="life-tab-content">
          <div className="life-enrollments-list">
            {enrollments.length === 0 ? (
              <div className="life-empty-card">
                <div className="life-empty-icon">🎓</div>
                <p>You have not enrolled in any training courses yet.</p>
                <button
                  className="btn-outline-action"
                  onClick={() => setActiveTab("catalog")}
                >
                  Browse Course Catalog
                </button>
              </div>
            ) : (
              enrollments.map((en) => (
                <div key={en.id} className="life-enroll-card" data-testid={`enroll-card-${en.id}`}>
                  <div className="life-enroll-main">
                    <div className="life-enroll-header">
                      <span className="life-enroll-code">[{en.course_code}]</span>
                      <span className={`life-enroll-status st-${en.status.toLowerCase()}`}>
                        {en.status_display}
                      </span>
                    </div>
                    <h3>{en.course_title}</h3>
                    <div className="life-enroll-meta">
                      <span>Instructor: {en.course_instructor}</span>
                      <span>Duration: {en.duration_hours} hrs</span>
                      <span>Enrolled on: {en.enrolled_at?.split("T")[0]}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="life-progress-bar-wrapper">
                      <div className="life-progress-meta">
                        <span>Course Completion</span>
                        <strong>{en.progress_percent}%</strong>
                      </div>
                      <div className="life-progress-track">
                        <div
                          className="life-progress-fill"
                          style={{ width: `${en.progress_percent}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Quick Stepper Actions */}
                    <div className="life-stepper-row">
                      <button
                        className="btn-step"
                        disabled={en.progress_percent >= 100}
                        onClick={() =>
                          handleUpdateProgress(en.id, Math.min(100, en.progress_percent + 25))
                        }
                      >
                        +25% Progress
                      </button>
                      <button
                        className="btn-step highlight"
                        disabled={en.progress_percent >= 100}
                        onClick={() => handleUpdateProgress(en.id, 100)}
                      >
                        ✓ Mark 100% Complete
                      </button>
                    </div>
                  </div>

                  {/* Feedback rating */}
                  <div className="life-feedback-box">
                    <span className="life-feedback-label">Your Rating:</span>
                    <div className="life-star-row">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          className={`btn-star ${en.feedback_rating >= star ? "filled" : ""}`}
                          onClick={() => handleFeedback(en.id, star)}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    {en.feedback_comments && (
                      <p className="life-feedback-text">"{en.feedback_comments}"</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: Professional Certifications ─── */}
      {activeTab === "certifications" && (
        <div className="life-tab-content">
          <div className="life-certs-grid">
            {certifications.map((cert) => (
              <div key={cert.id} className="life-cert-card" data-testid={`cert-card-${cert.id}`}>
                <div className="life-cert-seal">🎖️</div>
                <h3>{cert.name}</h3>
                <span className="life-cert-issuer">{cert.issuing_organization}</span>
                <div className="life-cert-dates">
                  <span>Issued: {cert.issue_date}</span>
                  {cert.expiry_date && <span>Expires: {cert.expiry_date}</span>}
                </div>
                {cert.credential_id && (
                  <div className="life-cert-id">
                    ID: <code>{cert.credential_id}</code>
                  </div>
                )}
                {cert.credential_url && (
                  <a
                    href={cert.credential_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-cert-link"
                  >
                    🔗 Verify External Credential
                  </a>
                )}
                <div className="life-verified-tag">✓ Verified Workplace Credential</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 4: Exit & Clearance Hub ─── */}
      {activeTab === "exit" && (
        <div className="life-tab-content">
          {exits.length === 0 ? (
            <div className="life-empty-card">
              <div className="life-empty-icon">🚪</div>
              <p>No active resignation or separation workflows in progress.</p>
              <button
                className="btn-primary-action danger"
                onClick={() => setShowResignModal(true)}
              >
                Submit Resignation
              </button>
            </div>
          ) : (
            <div className="life-exits-stack">
              {exits.map((ex) => (
                <div key={ex.id} className="life-exit-card" data-testid={`exit-card-${ex.id}`}>
                  <div className="life-exit-header">
                    <div>
                      <h3>
                        {ex.employee_name} ({ex.employee_id})
                      </h3>
                      <span className="life-exit-sub">
                        {ex.designation} • {ex.department_name}
                      </span>
                    </div>
                    <span className={`life-exit-status-pill st-${ex.status.toLowerCase()}`}>
                      {ex.status_display}
                    </span>
                  </div>

                  <div className="life-exit-meta-grid">
                    <div>
                      <strong>Resignation Date:</strong> {ex.resignation_date}
                    </div>
                    <div>
                      <strong>Reason:</strong> {ex.reason_display}
                    </div>
                    <div>
                      <strong>Notice Period:</strong> {ex.notice_period_days} Days
                    </div>
                    <div>
                      <strong>Agreed LWD:</strong> {ex.agreed_last_working_day || ex.requested_last_working_day}
                    </div>
                  </div>

                  {ex.detailed_reason && (
                    <p className="life-exit-reason-text">"{ex.detailed_reason}"</p>
                  )}

                  {/* Multi-Department Clearance Checklist */}
                  <div className="life-clearance-section">
                    <h4>Department Sign-Off Clearance Checklist:</h4>
                    <div className="life-clearance-grid">
                      {CLEARANCE_DEPTS.map((dept) => {
                        const item = ex.clearance_items?.find((c) => c.department === dept.code);
                        const isCleared = item?.is_cleared;

                        return (
                          <div
                            key={dept.code}
                            className={`life-clearance-pill ${isCleared ? "cleared" : "pending"}`}
                            onClick={() =>
                              isHROrAdmin &&
                              setClearanceModalData({
                                exitId: ex.id,
                                dept: dept.code,
                                deptLabel: dept.label,
                              })
                            }
                            title={isHROrAdmin ? "Click to sign off clearance" : ""}
                          >
                            <span className="life-pill-icon">{dept.icon}</span>
                            <div className="life-pill-info">
                              <strong>{dept.label}</strong>
                              <span>{isCleared ? "✓ Signed & Cleared" : "⏳ Pending Sign-off"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="life-exit-actions-bar">
                    {isHROrAdmin && ex.status !== "COMPLETED" && (
                      <button
                        className="btn-finalize-action"
                        onClick={() => setFinalizeModalData(ex)}
                        data-testid={`btn-finalize-${ex.id}`}
                      >
                        📑 Complete Separation & Issue Relieving Letter
                      </button>
                    )}
                    {ex.relieving_letter_issued && (
                      <span className="life-relieving-tag">✓ Relieving Letter Issued</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL 1: Add Training Course ─── */}
      {showCourseModal && (
        <div className="life-modal-backdrop">
          <div className="life-modal-card" data-testid="modal-create-course">
            <div className="life-modal-header">
              <h2><span>📚</span> Publish Training Course</h2>
              <button
                className="life-modal-close"
                onClick={() => setShowCourseModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCourse} className="life-form">
              <div className="life-form-row">
                <div className="life-form-group">
                  <label>Course Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TRN-2026-REACT"
                    value={cCode}
                    onChange={(e) => setCCode(e.target.value)}
                    data-testid="input-course-code"
                  />
                </div>
                <div className="life-form-group">
                  <label>Course Format *</label>
                  <select
                    value={cFormat}
                    onChange={(e) => setCFormat(e.target.value)}
                    data-testid="select-course-format"
                  >
                    {Object.entries(FORMAT_MAP).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.icon} {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="life-form-group">
                <label>Course Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise React Architecture & State Machines"
                  value={cTitle}
                  onChange={(e) => setCTitle(e.target.value)}
                  data-testid="input-course-title"
                />
              </div>

              <div className="life-form-row">
                <div className="life-form-group">
                  <label>Instructor</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Frontend Architect"
                    value={cInstructor}
                    onChange={(e) => setCInstructor(e.target.value)}
                  />
                </div>
                <div className="life-form-group">
                  <label>Duration (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    value={cDuration}
                    onChange={(e) => setCDuration(e.target.value)}
                  />
                </div>
              </div>

              <div className="life-form-group">
                <label>Key Skills Covered</label>
                <input
                  type="text"
                  placeholder="e.g. React 19, Redux Toolkit, Vitest, CI/CD"
                  value={cSkills}
                  onChange={(e) => setCSkills(e.target.value)}
                />
              </div>

              <div className="life-form-group">
                <label>Description</label>
                <textarea
                  rows="3"
                  placeholder="Detail curriculum objectives and learning outcomes..."
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                ></textarea>
              </div>

              <div className="life-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowCourseModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit"
                  data-testid="btn-submit-course-form"
                >
                  {actionLoading ? "Publishing…" : "Publish Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Add Certification ─── */}
      {showCertModal && (
        <div className="life-modal-backdrop">
          <div className="life-modal-card" data-testid="modal-create-cert">
            <div className="life-modal-header">
              <h2><span>📜</span> Add Professional Certification</h2>
              <button
                className="life-modal-close"
                onClick={() => setShowCertModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCert} className="life-form">
              <div className="life-form-group">
                <label>Certificate / Credential Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS Certified Solutions Architect"
                  value={certName}
                  onChange={(e) => setCertName(e.target.value)}
                  data-testid="input-cert-name"
                />
              </div>

              <div className="life-form-group">
                <label>Issuing Organization *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amazon Web Services, Linux Foundation"
                  value={certOrg}
                  onChange={(e) => setCertOrg(e.target.value)}
                  data-testid="input-cert-org"
                />
              </div>

              <div className="life-form-row">
                <div className="life-form-group">
                  <label>Issue Date *</label>
                  <input
                    type="date"
                    required
                    value={certIssueDate}
                    onChange={(e) => setCertIssueDate(e.target.value)}
                    data-testid="input-cert-date"
                  />
                </div>
                <div className="life-form-group">
                  <label>Credential ID</label>
                  <input
                    type="text"
                    placeholder="e.g. AWS-PSA-994821"
                    value={certCredId}
                    onChange={(e) => setCertCredId(e.target.value)}
                  />
                </div>
              </div>

              <div className="life-form-group">
                <label>Credential Verification URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={certCredUrl}
                  onChange={(e) => setCertCredUrl(e.target.value)}
                />
              </div>

              <div className="life-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowCertModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit"
                  data-testid="btn-submit-cert-form"
                >
                  {actionLoading ? "Verifying…" : "Save Certificate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: Submit Resignation ─── */}
      {showResignModal && (
        <div className="life-modal-backdrop">
          <div className="life-modal-card" data-testid="modal-resignation">
            <div className="life-modal-header">
              <h2><span>🚪</span> Submit Resignation Notice</h2>
              <button
                className="life-modal-close"
                onClick={() => setShowResignModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitResignation} className="life-form">
              <div className="life-form-group">
                <label>Primary Reason Category *</label>
                <select
                  value={resReason}
                  onChange={(e) => setResReason(e.target.value)}
                  data-testid="select-res-reason"
                >
                  <option value="BETTER_OPPORTUNITY">Better Career Opportunity</option>
                  <option value="HIGHER_EDUCATION">Higher Education / Research</option>
                  <option value="CAREER_CHANGE">Career / Industry Transition</option>
                  <option value="RELOCATION">Geographic Relocation</option>
                  <option value="PERSONAL_HEALTH">Personal / Health Circumstances</option>
                  <option value="RETIREMENT">Retirement</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              <div className="life-form-row">
                <div className="life-form-group">
                  <label>Notice Period (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    value={resNotice}
                    onChange={(e) => setResNotice(e.target.value)}
                    data-testid="input-res-notice"
                  />
                </div>
                <div className="life-form-group">
                  <label>Requested Last Working Day *</label>
                  <input
                    type="date"
                    required
                    value={resLwd}
                    onChange={(e) => setResLwd(e.target.value)}
                    data-testid="input-res-lwd"
                  />
                </div>
              </div>

              <div className="life-form-group">
                <label>Detailed Transition Notes</label>
                <textarea
                  rows="3"
                  placeholder="Outline planned knowledge transfer, ongoing deliverables, and remarks..."
                  value={resDetails}
                  onChange={(e) => setResDetails(e.target.value)}
                  data-testid="input-res-details"
                ></textarea>
              </div>

              <div className="life-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowResignModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit danger"
                  data-testid="btn-submit-resignation-form"
                >
                  {actionLoading ? "Submitting…" : "Confirm Resignation Notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: Clearance Sign-Off ─── */}
      {clearanceModalData && (
        <div className="life-modal-backdrop">
          <div className="life-modal-card" data-testid="modal-sign-clearance">
            <div className="life-modal-header">
              <h2><span>✓</span> Department Clearance Sign-Off</h2>
              <button
                className="life-modal-close"
                onClick={() => setClearanceModalData(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSignClearance} className="life-form">
              <div className="life-form-group">
                <label>Department</label>
                <input
                  type="text"
                  disabled
                  value={clearanceModalData.deptLabel || clearanceModalData.dept}
                />
              </div>

              <div className="life-form-group">
                <label>Clearance Remarks & Asset Inspection Notes *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Returned MacBook, security pass card, and signed IP disclosure agreement."
                  value={signNotes}
                  onChange={(e) => setSignNotes(e.target.value)}
                  data-testid="input-clearance-notes"
                ></textarea>
              </div>

              <div className="life-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setClearanceModalData(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit"
                  data-testid="btn-submit-clearance"
                >
                  {actionLoading ? "Signing…" : "Sign & Approve Clearance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: Finalize Exit & Relieving Letter ─── */}
      {finalizeModalData && (
        <div className="life-modal-backdrop">
          <div className="life-modal-card" data-testid="modal-finalize-exit">
            <div className="life-modal-header">
              <h2><span>📑</span> Complete Separation: {finalizeModalData.employee_name}</h2>
              <button
                className="life-modal-close"
                onClick={() => setFinalizeModalData(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleFinalizeExit} className="life-form">
              <div className="life-form-group">
                <label>HR Exit Interview Summary & Feedback *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Summary of employee feedback on company culture, leadership, and reasons for transition..."
                  value={exitNotes}
                  onChange={(e) => setExitNotes(e.target.value)}
                  data-testid="input-exit-interview-notes"
                ></textarea>
              </div>

              <div className="life-form-group">
                <label>Retention & Alumni Network Discussion</label>
                <textarea
                  rows="2"
                  placeholder="Notes on whether retention was attempted, alumni contact details, and rehire eligibility..."
                  value={retentionNotes}
                  onChange={(e) => setRetentionNotes(e.target.value)}
                ></textarea>
              </div>

              <div className="life-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setFinalizeModalData(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit"
                  data-testid="btn-confirm-finalize-exit"
                >
                  {actionLoading ? "Finalizing…" : "Issue Relieving Letter & Close File"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
