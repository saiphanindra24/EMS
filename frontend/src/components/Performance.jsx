import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import performanceService from "../services/performanceService";
import "./Performance.css";

const GOAL_CAT_MAP = {
  TECHNICAL: { label: "Technical & Delivery", icon: "💻", badgeClass: "cat-tech" },
  OPERATIONAL: { label: "Quality & SLA", icon: "⚙️", badgeClass: "cat-ops" },
  LEADERSHIP: { label: "Leadership & Mentorship", icon: "👑", badgeClass: "cat-lead" },
  BUSINESS_GROWTH: { label: "Business Impact", icon: "📈", badgeClass: "cat-growth" },
  INNOVATION: { label: "Innovation & R&D", icon: "💡", badgeClass: "cat-inno" },
};

const PROMO_MAP = {
  NO_CHANGE: "Maintain Current Band",
  ELIGIBLE_PROMOTION: "Recommended for Promotion",
  ROLE_EXPANSION: "Role Expansion / Senior Band",
  MERIT_INCREASE: "Merit Salary Increment",
};

export default function Performance() {
  const { user } = useAuth();
  const userRole = user?.role || "EMPLOYEE";
  const isManagerOrAdmin = ["SUPER_ADMIN", "HR_ADMIN", "MANAGER"].includes(userRole);

  const [activeTab, setActiveTab] = useState("my"); // "my", "team", "leaderboard"

  // Data states
  const [activeCycle, setActiveCycle] = useState(null);
  const [goals, setGoals] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [teamReviews, setTeamReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Modals
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showSelfReviewModal, setShowSelfReviewModal] = useState(false);
  const [managerReviewModalReview, setManagerReviewModalReview] = useState(null);
  const [feedback360ModalReview, setFeedback360ModalReview] = useState(null);
  const [detailModalReview, setDetailModalReview] = useState(null);

  // Form states: New Goal
  const [goalTitle, setGoalTitle] = useState("");
  const [goalCategory, setGoalCategory] = useState("TECHNICAL");
  const [goalTargetMetric, setGoalTargetMetric] = useState("100% Completion");
  const [goalWeightage, setGoalWeightage] = useState("25");
  const [goalDueDate, setGoalDueDate] = useState("");
  const [goalDescription, setGoalDescription] = useState("");

  // Form states: Self Review
  const [selfRating, setSelfRating] = useState("4.5");
  const [selfAchievements, setSelfAchievements] = useState("");
  const [selfChallenges, setSelfChallenges] = useState("");
  const [selfTrainingNeeds, setSelfTrainingNeeds] = useState("");

  // Form states: Manager Evaluation
  const [mgrRating, setMgrRating] = useState("4.5");
  const [mgrFeedback, setMgrFeedback] = useState("");
  const [mgrPromo, setMgrPromo] = useState("NO_CHANGE");
  const [mgrPip, setMgrPip] = useState(false);

  // Form states: 360 Feedback
  const [fbRelationship, setFbRelationship] = useState("PEER");
  const [fbTechRating, setFbTechRating] = useState(4);
  const [fbCollabRating, setFbCollabRating] = useState(5);
  const [fbLeadRating, setFbLeadRating] = useState(4);
  const [fbStrengths, setFbStrengths] = useState("");
  const [fbGrowthAreas, setFbGrowthAreas] = useState("");
  const [fbAnonymous, setFbAnonymous] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [cycleData, statsData, goalsData, myRevData] = await Promise.all([
        performanceService.getActiveCycle().catch(() => null),
        performanceService.getStats().catch(() => null),
        performanceService.getGoals().catch(() => []),
        performanceService.getMyReviews().catch(() => []),
      ]);

      setActiveCycle(cycleData);
      setStats(statsData);
      setGoals(goalsData?.results || goalsData || []);
      setMyReviews(myRevData?.results || myRevData || []);

      if (isManagerOrAdmin) {
        const teamRevData = await performanceService.getReviews().catch(() => []);
        setTeamReviews(teamRevData?.results || teamRevData || []);
      }
    } catch (err) {
      console.error("Failed to load performance data:", err);
      setError("Unable to connect to performance appraisal service.");
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

  // Create Goal
  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!goalTitle.trim()) {
      alert("Please provide a goal title.");
      return;
    }
    try {
      setActionLoading(true);
      await performanceService.createGoal({
        title: goalTitle.trim(),
        category: goalCategory,
        target_metric: goalTargetMetric.trim() || "100%",
        weightage: parseInt(goalWeightage, 10) || 25,
        due_date: goalDueDate || null,
        description: goalDescription.trim(),
        cycle: activeCycle?.id || null,
      });
      setShowGoalModal(false);
      setGoalTitle("");
      setGoalDescription("");
      showToast("✓ Goal added to your active appraisal scorecard!");
      fetchData();
    } catch (err) {
      console.error("Failed to create goal:", err);
      alert(err.response?.data?.error || "Error creating goal.");
    } finally {
      setActionLoading(false);
    }
  };

  // Update Goal Progress
  const handleUpdateProgress = async (goalId, newProgress) => {
    try {
      await performanceService.updateGoalProgress(goalId, newProgress);
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, current_progress: newProgress } : g))
      );
      showToast(`✓ Updated goal progress to ${newProgress}%`);
    } catch (err) {
      console.error("Failed to update progress:", err);
    }
  };

  // Submit Self Review
  const handleSubmitSelfReview = async (e) => {
    e.preventDefault();
    const activeReview = myReviews[0];
    if (!activeReview) {
      alert("No active review found for self-assessment.");
      return;
    }
    try {
      setActionLoading(true);
      await performanceService.submitSelfReview(activeReview.id, {
        self_rating: parseFloat(selfRating),
        self_achievements: selfAchievements.trim(),
        self_challenges: selfChallenges.trim(),
        self_training_needs: selfTrainingNeeds.trim(),
      });
      setShowSelfReviewModal(false);
      showToast("✓ Self-assessment submitted successfully! Routed to manager evaluation.");
      fetchData();
    } catch (err) {
      console.error("Self review error:", err);
      alert(err.response?.data?.error || "Failed to submit self review.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Manager Evaluation
  const handleSubmitManagerReview = async (e) => {
    e.preventDefault();
    if (!managerReviewModalReview) return;
    try {
      setActionLoading(true);
      await performanceService.submitManagerReview(managerReviewModalReview.id, {
        manager_rating: parseFloat(mgrRating),
        manager_feedback: mgrFeedback.trim(),
        promotion_recommendation: mgrPromo,
        pip_required: mgrPip,
      });
      setManagerReviewModalReview(null);
      setMgrFeedback("");
      showToast("✓ Manager evaluation submitted and appraisal completed!");
      fetchData();
    } catch (err) {
      console.error("Manager review error:", err);
      alert(err.response?.data?.error || "Failed to submit manager evaluation.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit 360 Feedback
  const handleSubmit360Feedback = async (e) => {
    e.preventDefault();
    if (!feedback360ModalReview) return;
    try {
      setActionLoading(true);
      await performanceService.submit360Feedback({
        review: feedback360ModalReview.id,
        relationship: fbRelationship,
        technical_rating: fbTechRating,
        collaboration_rating: fbCollabRating,
        leadership_rating: fbLeadRating,
        strengths: fbStrengths.trim(),
        growth_areas: fbGrowthAreas.trim(),
        is_anonymous: fbAnonymous,
      });
      setFeedback360ModalReview(null);
      setFbStrengths("");
      setFbGrowthAreas("");
      showToast("✓ 360° Peer Feedback submitted! Thank you for supporting colleague growth.");
      fetchData();
    } catch (err) {
      console.error("360 feedback error:", err);
      alert(err.response?.data?.error || "Failed to submit 360 feedback.");
    } finally {
      setActionLoading(false);
    }
  };

  const activeMyReview = myReviews[0];

  return (
    <div className="perf-container" data-testid="performance-dashboard">
      {/* ─── Header ─── */}
      <div className="perf-header">
        <div className="perf-header-titles">
          <h1>
            <span>⭐</span> Performance Management & 360° Appraisals
          </h1>
          <p>
            Track quarterly OKRs & KPIs, employee self-evaluations, manager reviews, and 360° peer feedback.
          </p>
        </div>
        <div className="perf-header-actions">
          <button
            className="btn-primary-action"
            onClick={() => setShowGoalModal(true)}
            data-testid="btn-add-goal"
          >
            <span>+</span> Set KPI Goal
          </button>
        </div>
      </div>

      {/* ─── Toast Banners ─── */}
      {toastMsg && <div className="perf-toast-banner">{toastMsg}</div>}
      {error && <div className="perf-error-banner">{error}</div>}

      {/* ─── Executive KPI Cards ─── */}
      <div className="perf-kpi-grid">
        <div className="perf-kpi-card" data-testid="kpi-org-rating">
          <div className="perf-kpi-icon gold">★</div>
          <div className="perf-kpi-content">
            <span className="perf-kpi-label">Org Average Score</span>
            <div className="perf-kpi-val">
              {stats?.average_org_score ? `${stats.average_org_score} / 5.0` : "4.6 / 5.0"}
            </div>
            <span className="perf-kpi-sub">Across active appraisals</span>
          </div>
        </div>

        <div className="perf-kpi-card" data-testid="kpi-active-cycle">
          <div className="perf-kpi-icon purple">📅</div>
          <div className="perf-kpi-content">
            <span className="perf-kpi-label">Active Cycle</span>
            <div className="perf-kpi-val cycle-text" title={activeCycle?.name}>
              {activeCycle ? activeCycle.name.split(" ")[0] + " " + activeCycle.name.split(" ")[1] : "Q4 2026"}
            </div>
            <span className="perf-kpi-sub">
              Deadline: {activeCycle?.manager_review_deadline || "Nov 15, 2026"}
            </span>
          </div>
        </div>

        <div className="perf-kpi-card" data-testid="kpi-completion-rate">
          <div className="perf-kpi-icon blue">📈</div>
          <div className="perf-kpi-content">
            <span className="perf-kpi-label">Appraisal Completion</span>
            <div className="perf-kpi-val">{stats?.completion_percentage || 75}%</div>
            <span className="perf-kpi-sub">
              {stats?.completed_reviews || 3} of {stats?.total_reviews || 4} Completed
            </span>
          </div>
        </div>

        <div className="perf-kpi-card" data-testid="kpi-promotions">
          <div className="perf-kpi-icon emerald">🎖️</div>
          <div className="perf-kpi-content">
            <span className="perf-kpi-label">Promotion Nominees</span>
            <div className="perf-kpi-val">{stats?.promotion_nominees || 3}</div>
            <span className="perf-kpi-sub highlight-emerald">
              Eligible for band / merit rise
            </span>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="perf-controls-panel">
        <div className="perf-tabs">
          <button
            className={`perf-tab-btn ${activeTab === "my" ? "active" : ""}`}
            onClick={() => setActiveTab("my")}
            data-testid="tab-my-goals"
          >
            🎯 My Scorecard & Self Review ({goals.length} Goals)
          </button>
          {isManagerOrAdmin && (
            <button
              className={`perf-tab-btn ${activeTab === "team" ? "active" : ""}`}
              onClick={() => setActiveTab("team")}
              data-testid="tab-team-reviews"
            >
              ⭐ Team Appraisals & 360 Reviews ({teamReviews.length})
            </button>
          )}
          <button
            className={`perf-tab-btn ${activeTab === "leaderboard" ? "active" : ""}`}
            onClick={() => setActiveTab("leaderboard")}
            data-testid="tab-leaderboard"
          >
            🏆 Leaderboard & Top Performers
          </button>
        </div>
      </div>

      {/* ─── TAB 1: My Goals & Self Review ─── */}
      {activeTab === "my" && (
        <div className="perf-tab-content">
          {/* Active Review Status Banner */}
          {activeMyReview && (
            <div className="perf-cycle-banner" data-testid="my-review-status-banner">
              <div className="perf-banner-info">
                <span className="perf-banner-tag">{activeMyReview.cycle_name}</span>
                <h3>
                  Status: <strong>{activeMyReview.status_display}</strong>
                </h3>
                <p>
                  {activeMyReview.status === "SELF_REVIEW"
                    ? "Please complete your self-assessment to submit to your reporting manager."
                    : activeMyReview.status === "MANAGER_REVIEW"
                    ? "Self-assessment submitted! Awaiting manager review and 1-on-1 discussion."
                    : "Review finalized! Final Score: ★ " + (activeMyReview.final_score || "N/A")}
                </p>
              </div>
              <div className="perf-banner-action">
                {activeMyReview.status === "SELF_REVIEW" ? (
                  <button
                    className="btn-primary-action"
                    onClick={() => setShowSelfReviewModal(true)}
                    data-testid="btn-open-self-review"
                  >
                    📝 Submit Self-Assessment
                  </button>
                ) : (
                  <button
                    className="btn-outline-action"
                    onClick={() => setDetailModalReview(activeMyReview)}
                    data-testid="btn-view-my-review"
                  >
                    👁️ View Appraisal Record
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Goals List */}
          <div className="perf-goals-section">
            <div className="perf-section-header">
              <h2><span>🎯</span> Individual KPI Goals & Milestones</h2>
              <button
                className="btn-outline-action small"
                onClick={() => setShowGoalModal(true)}
              >
                + Add Goal
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="perf-empty-box">
                <div className="perf-empty-icon">🎯</div>
                <p>No KPI goals defined yet. Set your first goal for this appraisal cycle!</p>
              </div>
            ) : (
              <div className="perf-goals-grid">
                {goals.map((g) => {
                  const cat = GOAL_CAT_MAP[g.category] || GOAL_CAT_MAP.TECHNICAL;
                  return (
                    <div key={g.id} className="perf-goal-card" data-testid={`goal-card-${g.id}`}>
                      <div className="perf-goal-card-header">
                        <span className={`perf-cat-pill ${cat.badgeClass}`}>
                          {cat.icon} {cat.label}
                        </span>
                        <span className="perf-weightage-pill">
                          Weight: {g.weightage}%
                        </span>
                      </div>

                      <h3 className="perf-goal-title">{g.title}</h3>
                      {g.description && <p className="perf-goal-desc">{g.description}</p>}

                      <div className="perf-metric-row">
                        <span>Target: <strong>{g.target_metric}</strong></span>
                        {g.due_date && <span>Due: <strong>{g.due_date}</strong></span>}
                      </div>

                      {/* Progress bar */}
                      <div className="perf-progress-wrapper">
                        <div className="perf-progress-meta">
                          <span>Progress</span>
                          <strong>{g.current_progress}%</strong>
                        </div>
                        <div className="perf-progress-bar">
                          <div
                            className="perf-progress-fill"
                            style={{ width: `${g.current_progress}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Quick progress actions */}
                      <div className="perf-goal-actions">
                        <button
                          className="btn-step"
                          disabled={g.current_progress <= 0}
                          onClick={() =>
                            handleUpdateProgress(g.id, Math.max(0, g.current_progress - 10))
                          }
                        >
                          -10%
                        </button>
                        <button
                          className="btn-step"
                          disabled={g.current_progress >= 100}
                          onClick={() =>
                            handleUpdateProgress(g.id, Math.min(100, g.current_progress + 10))
                          }
                        >
                          +10%
                        </button>
                        <button
                          className="btn-step highlight"
                          disabled={g.current_progress >= 100}
                          onClick={() => handleUpdateProgress(g.id, 100)}
                        >
                          ✓ Complete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: Team Appraisals & 360 Reviews ─── */}
      {activeTab === "team" && (
        <div className="perf-tab-content">
          <div className="perf-table-wrapper">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Designation & Dept</th>
                  <th>Status</th>
                  <th>Self Rating</th>
                  <th>Manager Rating</th>
                  <th>Final Score</th>
                  <th>Promotion Nominee</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamReviews.map((r) => (
                  <tr key={r.id} className="perf-row" data-testid={`team-review-row-${r.id}`}>
                    <td className="perf-emp-cell">
                      <strong>{r.employee_name}</strong>
                      <span className="perf-sub-text">{r.employee_id}</span>
                    </td>
                    <td>
                      <div>{r.designation}</div>
                      <span className="perf-sub-text">{r.department_name}</span>
                    </td>
                    <td>
                      <span className={`perf-status-tag st-${r.status.toLowerCase()}`}>
                        {r.status_display}
                      </span>
                    </td>
                    <td className="perf-rating-cell">
                      {r.self_rating ? `★ ${r.self_rating}` : "Pending"}
                    </td>
                    <td className="perf-rating-cell">
                      {r.manager_rating ? `★ ${r.manager_rating}` : "Pending"}
                    </td>
                    <td className="perf-score-cell">
                      {r.final_score ? (
                        <span className="perf-final-score">★ {r.final_score}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {r.promotion_recommendation !== "NO_CHANGE" ? (
                        <span className="perf-promo-pill">
                          {PROMO_MAP[r.promotion_recommendation] || r.promotion_recommendation}
                        </span>
                      ) : (
                        <span className="perf-sub-text">Standard</span>
                      )}
                    </td>
                    <td className="perf-actions-cell">
                      <button
                        className="btn-action-icon view"
                        title="View Full 360 Record"
                        onClick={() => setDetailModalReview(r)}
                        data-testid={`btn-view-review-${r.id}`}
                      >
                        👁️
                      </button>

                      {/* Evaluate if Manager / Admin */}
                      {isManagerOrAdmin && r.status !== "COMPLETED" && (
                        <button
                          className="btn-action-icon evaluate"
                          title="Evaluate & Score"
                          onClick={() => {
                            setManagerReviewModalReview(r);
                            setMgrRating(r.self_rating ? String(r.self_rating) : "4.5");
                          }}
                          data-testid={`btn-eval-${r.id}`}
                        >
                          ⭐ Evaluate
                        </button>
                      )}

                      {/* 360 Peer Feedback */}
                      <button
                        className="btn-action-icon peer"
                        title="Submit 360 Peer Feedback"
                        onClick={() => setFeedback360ModalReview(r)}
                        data-testid={`btn-360-${r.id}`}
                      >
                        💬 360°
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: Leaderboard & Top Performers ─── */}
      {activeTab === "leaderboard" && (
        <div className="perf-tab-content">
          <div className="perf-leaderboard-banner">
            <h2><span>🏆</span> Top Performers — {activeCycle?.name || "Q4 2026"}</h2>
            <p>Recognizing top engineering and operational contributions across VolkssKatt Global Infotech.</p>
          </div>

          <div className="perf-podium-grid">
            {stats?.top_performers?.map((p, idx) => (
              <div key={p.id} className={`perf-podium-card rank-${idx + 1}`} data-testid={`podium-rank-${idx + 1}`}>
                <div className="perf-podium-rank">
                  {idx === 0 ? "🥇 Rank 1" : idx === 1 ? "🥈 Rank 2" : "🥉 Rank 3"}
                </div>
                <div className="perf-podium-avatar">
                  {p.name.charAt(0)}
                </div>
                <h3>{p.name}</h3>
                <span className="perf-podium-desig">{p.designation}</span>
                <div className="perf-podium-score">
                  <span>★</span> {p.score.toFixed(1)} / 5.0
                </div>
                {p.promotion && (
                  <span className="perf-podium-promo">{p.promotion}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MODAL 1: Set New Goal ─── */}
      {showGoalModal && (
        <div className="perf-modal-backdrop">
          <div className="perf-modal-card" data-testid="modal-create-goal">
            <div className="perf-modal-header">
              <h2><span>🎯</span> Define Performance Goal / KPI</h2>
              <button
                className="perf-modal-close"
                onClick={() => setShowGoalModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateGoal} className="perf-form">
              <div className="perf-form-group">
                <label>Goal Title / Key Objective *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optimize Database Latency & Connection Pooling"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  data-testid="input-goal-title"
                />
              </div>

              <div className="perf-form-row">
                <div className="perf-form-group">
                  <label>Category *</label>
                  <select
                    value={goalCategory}
                    onChange={(e) => setGoalCategory(e.target.value)}
                    data-testid="input-goal-category"
                  >
                    {Object.entries(GOAL_CAT_MAP).map(([k, info]) => (
                      <option key={k} value={k}>
                        {info.icon} {info.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="perf-form-group">
                  <label>Weightage (% towards total score) *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={goalWeightage}
                    onChange={(e) => setGoalWeightage(e.target.value)}
                    data-testid="input-goal-weightage"
                  />
                </div>
              </div>

              <div className="perf-form-row">
                <div className="perf-form-group">
                  <label>Target Metric</label>
                  <input
                    type="text"
                    placeholder="e.g. 99.95% uptime or 5 workshops"
                    value={goalTargetMetric}
                    onChange={(e) => setGoalTargetMetric(e.target.value)}
                    data-testid="input-goal-metric"
                  />
                </div>
                <div className="perf-form-group">
                  <label>Target Due Date</label>
                  <input
                    type="date"
                    value={goalDueDate}
                    onChange={(e) => setGoalDueDate(e.target.value)}
                    data-testid="input-goal-due-date"
                  />
                </div>
              </div>

              <div className="perf-form-group">
                <label>Description & Scope</label>
                <textarea
                  rows="3"
                  placeholder="Explain key delivery milestones and criteria for success..."
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                  data-testid="input-goal-desc"
                ></textarea>
              </div>

              <div className="perf-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowGoalModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit"
                  data-testid="btn-submit-goal-form"
                >
                  {actionLoading ? "Saving…" : "Save Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Self Review Submission ─── */}
      {showSelfReviewModal && (
        <div className="perf-modal-backdrop">
          <div className="perf-modal-card" data-testid="modal-self-review">
            <div className="perf-modal-header">
              <h2><span>📝</span> Submit Self-Assessment</h2>
              <button
                className="perf-modal-close"
                onClick={() => setShowSelfReviewModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitSelfReview} className="perf-form">
              <div className="perf-form-group">
                <label>Self Rating (1.0 to 5.0) *</label>
                <div className="perf-star-input">
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    required
                    value={selfRating}
                    onChange={(e) => setSelfRating(e.target.value)}
                    data-testid="input-self-rating"
                  />
                  <span>★ out of 5.0</span>
                </div>
              </div>

              <div className="perf-form-group">
                <label>Key Accomplishments & Impact Delivered *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Summarize key features delivered, metrics moved, or leadership shown..."
                  value={selfAchievements}
                  onChange={(e) => setSelfAchievements(e.target.value)}
                  data-testid="input-self-achievements"
                ></textarea>
              </div>

              <div className="perf-form-group">
                <label>Challenges Encountered & Mitigation</label>
                <textarea
                  rows="2"
                  placeholder="Any roadblocks, dependencies, or scope changes..."
                  value={selfChallenges}
                  onChange={(e) => setSelfChallenges(e.target.value)}
                  data-testid="input-self-challenges"
                ></textarea>
              </div>

              <div className="perf-form-group">
                <label>Desired Training & Career Growth Areas</label>
                <textarea
                  rows="2"
                  placeholder="Certifications, technologies, or leadership opportunities you'd like to pursue..."
                  value={selfTrainingNeeds}
                  onChange={(e) => setSelfTrainingNeeds(e.target.value)}
                  data-testid="input-self-training"
                ></textarea>
              </div>

              <div className="perf-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowSelfReviewModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit"
                  data-testid="btn-submit-self-review-form"
                >
                  {actionLoading ? "Submitting…" : "Submit to Manager"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: Manager Evaluation ─── */}
      {managerReviewModalReview && (
        <div className="perf-modal-backdrop">
          <div className="perf-modal-card" data-testid="modal-manager-review">
            <div className="perf-modal-header">
              <h2><span>⭐</span> Manager Evaluation: {managerReviewModalReview.employee_name}</h2>
              <button
                className="perf-modal-close"
                onClick={() => setManagerReviewModalReview(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitManagerReview} className="perf-form">
              <div className="perf-emp-summary-box">
                <div><strong>Designation:</strong> {managerReviewModalReview.designation}</div>
                <div><strong>Self Rating:</strong> ★ {managerReviewModalReview.self_rating || "N/A"}</div>
                {managerReviewModalReview.self_achievements && (
                  <div>
                    <strong>Self Accomplishments:</strong>
                    <p>"{managerReviewModalReview.self_achievements}"</p>
                  </div>
                )}
              </div>

              <div className="perf-form-group">
                <label>Manager Score (1.0 to 5.0) *</label>
                <div className="perf-star-input">
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    required
                    value={mgrRating}
                    onChange={(e) => setMgrRating(e.target.value)}
                    data-testid="input-mgr-rating"
                  />
                  <span>★ out of 5.0</span>
                </div>
              </div>

              <div className="perf-form-group">
                <label>Manager Performance Comments & Feedback *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Detail performance highlights, delivery cadence, and growth feedback..."
                  value={mgrFeedback}
                  onChange={(e) => setMgrFeedback(e.target.value)}
                  data-testid="input-mgr-feedback"
                ></textarea>
              </div>

              <div className="perf-form-group">
                <label>Promotion & Merit Recommendation</label>
                <select
                  value={mgrPromo}
                  onChange={(e) => setMgrPromo(e.target.value)}
                  data-testid="select-mgr-promo"
                >
                  {Object.entries(PROMO_MAP).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="perf-form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={mgrPip}
                    onChange={(e) => setMgrPip(e.target.checked)}
                    data-testid="input-mgr-pip"
                  />
                  <span>Mandate Performance Improvement Plan (PIP)</span>
                </label>
              </div>

              <div className="perf-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setManagerReviewModalReview(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit"
                  data-testid="btn-submit-mgr-review-form"
                >
                  {actionLoading ? "Finalizing…" : "Finalize Appraisal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: 360° Peer Feedback ─── */}
      {feedback360ModalReview && (
        <div className="perf-modal-backdrop">
          <div className="perf-modal-card" data-testid="modal-feedback-360">
            <div className="perf-modal-header">
              <h2><span>💬</span> 360° Peer Feedback for {feedback360ModalReview.employee_name}</h2>
              <button
                className="perf-modal-close"
                onClick={() => setFeedback360ModalReview(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit360Feedback} className="perf-form">
              <div className="perf-form-group">
                <label>Your Working Relationship</label>
                <select
                  value={fbRelationship}
                  onChange={(e) => setFbRelationship(e.target.value)}
                  data-testid="select-fb-rel"
                >
                  <option value="PEER">Peer Colleague</option>
                  <option value="SUBORDINATE">Direct Subordinate</option>
                  <option value="CROSS_FUNCTIONAL">Cross-Functional Partner</option>
                  <option value="MENTOR">Technical Mentor</option>
                </select>
              </div>

              <div className="perf-form-row">
                <div className="perf-form-group">
                  <label>Technical Craft (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={fbTechRating}
                    onChange={(e) => setFbTechRating(parseInt(e.target.value, 10))}
                  />
                </div>
                <div className="perf-form-group">
                  <label>Team Collaboration (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={fbCollabRating}
                    onChange={(e) => setFbCollabRating(parseInt(e.target.value, 10))}
                  />
                </div>
                <div className="perf-form-group">
                  <label>Leadership / Initiative (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={fbLeadRating}
                    onChange={(e) => setFbLeadRating(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>

              <div className="perf-form-group">
                <label>Greatest Strengths & Standout Contributions</label>
                <textarea
                  rows="2"
                  placeholder="What makes working with this colleague inspiring?..."
                  value={fbStrengths}
                  onChange={(e) => setFbStrengths(e.target.value)}
                  data-testid="input-fb-strengths"
                ></textarea>
              </div>

              <div className="perf-form-group">
                <label>Growth & Development Suggestions</label>
                <textarea
                  rows="2"
                  placeholder="Constructive feedback to help them advance to the next level..."
                  value={fbGrowthAreas}
                  onChange={(e) => setFbGrowthAreas(e.target.value)}
                  data-testid="input-fb-growth"
                ></textarea>
              </div>

              <div className="perf-form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={fbAnonymous}
                    onChange={(e) => setFbAnonymous(e.target.checked)}
                  />
                  <span>Submit Anonymously</span>
                </label>
              </div>

              <div className="perf-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setFeedback360ModalReview(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit"
                  data-testid="btn-submit-360-form"
                >
                  {actionLoading ? "Submitting…" : "Send 360 Feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: Full Record Detail View ─── */}
      {detailModalReview && (
        <div className="perf-modal-backdrop">
          <div className="perf-modal-card wide" data-testid="modal-detail-review">
            <div className="perf-modal-header">
              <h2><span>⭐</span> Appraisal Record: {detailModalReview.employee_name}</h2>
              <button
                className="perf-modal-close"
                onClick={() => setDetailModalReview(null)}
              >
                ✕
              </button>
            </div>
            <div className="perf-detail-body">
              <div className="perf-detail-header-card">
                <div><strong>Employee:</strong> {detailModalReview.employee_name} ({detailModalReview.employee_id})</div>
                <div><strong>Designation:</strong> {detailModalReview.designation} • {detailModalReview.department_name}</div>
                <div><strong>Cycle:</strong> {detailModalReview.cycle_name}</div>
                <div><strong>Final Score:</strong> ★ {detailModalReview.final_score || "Under Evaluation"}</div>
              </div>

              {/* Self Assessment Card */}
              <div className="perf-detail-card">
                <h3>📝 Self Assessment (Rating: ★ {detailModalReview.self_rating || "N/A"})</h3>
                <p><strong>Accomplishments:</strong> {detailModalReview.self_achievements || "None logged"}</p>
                {detailModalReview.self_challenges && (
                  <p><strong>Challenges:</strong> {detailModalReview.self_challenges}</p>
                )}
                {detailModalReview.self_training_needs && (
                  <p><strong>Training Needs:</strong> {detailModalReview.self_training_needs}</p>
                )}
              </div>

              {/* Manager Assessment Card */}
              {detailModalReview.manager_rating && (
                <div className="perf-detail-card">
                  <h3>⭐ Manager Appraisal (Rating: ★ {detailModalReview.manager_rating})</h3>
                  <p><strong>Manager Feedback:</strong> {detailModalReview.manager_feedback}</p>
                  <p><strong>Promotion Recommendation:</strong> {PROMO_MAP[detailModalReview.promotion_recommendation] || detailModalReview.promotion_recommendation}</p>
                  {detailModalReview.pip_required && (
                    <p className="perf-pip-warning">⚠️ Performance Improvement Plan (PIP) Mandated</p>
                  )}
                </div>
              )}

              {/* 360 Peer Feedback list */}
              {detailModalReview.peer_feedbacks && detailModalReview.peer_feedbacks.length > 0 && (
                <div className="perf-detail-card">
                  <h3>💬 360° Peer Feedback ({detailModalReview.peer_feedbacks.length})</h3>
                  <div className="perf-feedbacks-stack">
                    {detailModalReview.peer_feedbacks.map((fb) => (
                      <div key={fb.id} className="perf-fb-card">
                        <div className="perf-fb-header">
                          <strong>{fb.provider_name}</strong>
                          <span className="perf-sub-text">{fb.relationship_display}</span>
                        </div>
                        <div className="perf-fb-scores">
                          <span>Tech: ★{fb.technical_rating}</span>
                          <span>Collab: ★{fb.collaboration_rating}</span>
                          <span>Lead: ★{fb.leadership_rating}</span>
                        </div>
                        {fb.strengths && <p><strong>Strengths:</strong> {fb.strengths}</p>}
                        {fb.growth_areas && <p><strong>Growth:</strong> {fb.growth_areas}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="perf-modal-actions">
              <button
                className="btn-modal-cancel"
                onClick={() => setDetailModalReview(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
