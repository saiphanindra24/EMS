import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import expenseService from "../services/expenseService";
import "./Expenses.css";

const CATEGORY_MAP = {
  TRAVEL: { label: "Travel & Accommodation", icon: "✈️", badgeClass: "cat-travel" },
  MEALS: { label: "Food & Meals", icon: "🍽️", badgeClass: "cat-meals" },
  SUPPLIES: { label: "Office Supplies", icon: "📦", badgeClass: "cat-supplies" },
  SOFTWARE: { label: "Software & Cloud", icon: "💻", badgeClass: "cat-software" },
  TRAINING: { label: "Training & Certifications", icon: "🎓", badgeClass: "cat-training" },
  CLIENT_ENTERTAINMENT: { label: "Client Entertainment", icon: "🥂", badgeClass: "cat-client" },
  COMMUTE: { label: "Local Commute & Fuel", icon: "🚕", badgeClass: "cat-commute" },
  OTHER: { label: "General Expense", icon: "📑", badgeClass: "cat-other" },
};

const STATUS_MAP = {
  DRAFT: { label: "Draft", badgeClass: "st-draft", icon: "📝" },
  SUBMITTED: { label: "Submitted (Pending Mgr)", badgeClass: "st-submitted", icon: "⏳" },
  MANAGER_APPROVED: { label: "Manager Approved", badgeClass: "st-mgr-app", icon: "✓" },
  FINANCE_APPROVED: { label: "Finance Approved", badgeClass: "st-fin-app", icon: "🏦" },
  REIMBURSED: { label: "Reimbursed & Settled", badgeClass: "st-reimbursed", icon: "💳" },
  REJECTED: { label: "Revision / Rejected", badgeClass: "st-rejected", icon: "✕" },
};

export default function Expenses() {
  const { user } = useAuth();
  const userRole = user?.role || "EMPLOYEE";
  const isManagerOrAdmin = ["SUPER_ADMIN", "HR_ADMIN", "MANAGER"].includes(userRole);
  const isFinanceOrAdmin = ["SUPER_ADMIN", "HR_ADMIN"].includes(userRole);

  // Active view tab: "all" or "my"
  const [activeTab, setActiveTab] = useState(isManagerOrAdmin ? "all" : "my");

  // Data states
  const [claims, setClaims] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [stats, setStats] = useState(null);
  const [projectsList, setProjectsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailModalClaim, setDetailModalClaim] = useState(null);
  const [reviewModalClaim, setReviewModalClaim] = useState(null);
  const [settleModalClaim, setSettleModalClaim] = useState(null);

  // Form states for New Claim
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("TRAVEL");
  const [newAmount, setNewAmount] = useState("");
  const [newTaxAmount, setNewTaxAmount] = useState("0");
  const [newExpenseDate, setNewExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [newIsBillable, setNewIsBillable] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newReceiptUrl, setNewReceiptUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Review states
  const [reviewAction, setReviewAction] = useState("APPROVE");
  const [reviewNotes, setReviewNotes] = useState("");

  // Settlement states
  const [settleAction, setSettleAction] = useState("REIMBURSE");
  const [settlePaymentMethod, setSettlePaymentMethod] = useState("DIRECT_DEPOSIT");
  const [settleTxRef, setSettleTxRef] = useState("");
  const [settleNotes, setSettleNotes] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [claimsData, statsData, prjData] = await Promise.all([
        expenseService.getExpenseClaims(),
        expenseService.getExpenseStats(),
        expenseService.getProjects().catch(() => ({ results: [] })),
      ]);

      setClaims(claimsData?.results || claimsData || []);
      setStats(statsData);
      setProjectsList(prjData?.results || prjData || []);

      if (isManagerOrAdmin) {
        const myRes = await expenseService.getMyClaims().catch(() => []);
        setMyClaims(myRes?.results || myRes || []);
      } else {
        setMyClaims(claimsData?.results || claimsData || []);
      }
    } catch (err) {
      console.error("Failed to load expense data:", err);
      setError("Unable to load expense claims. Please verify backend connectivity.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleShowToast = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Submitting a new Claim
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAmount || parseFloat(newAmount) <= 0) {
      alert("Please provide a valid claim title and an amount greater than zero.");
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        title: newTitle.trim(),
        category: newCategory,
        expense_date: newExpenseDate,
        currency: "INR",
        amount: parseFloat(newAmount).toFixed(2),
        tax_amount: parseFloat(newTaxAmount || 0).toFixed(2),
        is_billable: newIsBillable,
        project: newProjectId ? parseInt(newProjectId, 10) : null,
        receipt_url: newReceiptUrl.trim(),
        description: newDescription.trim(),
      };

      await expenseService.createClaim(payload);
      setShowCreateModal(false);
      // Reset form
      setNewTitle("");
      setNewAmount("");
      setNewTaxAmount("0");
      setNewProjectId("");
      setNewReceiptUrl("");
      setNewDescription("");
      handleShowToast("✓ Expense claim submitted successfully for manager approval!");
      fetchData();
    } catch (err) {
      console.error("Failed to submit claim:", err);
      alert(err.response?.data?.error || "Error submitting expense claim.");
    } finally {
      setActionLoading(false);
    }
  };

  // Manager Review
  const handleManagerReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewModalClaim) return;
    try {
      setActionLoading(true);
      await expenseService.managerReview(reviewModalClaim.id, {
        action: reviewAction,
        notes: reviewNotes.trim(),
      });
      setReviewModalClaim(null);
      setReviewNotes("");
      handleShowToast(
        reviewAction === "APPROVE"
          ? "✓ Claim approved and routed to Finance settlement queue!"
          : "✕ Claim flagged with revision/rejection notes."
      );
      fetchData();
    } catch (err) {
      console.error("Manager review error:", err);
      alert(err.response?.data?.error || "Failed to submit manager review.");
    } finally {
      setActionLoading(false);
    }
  };

  // Finance Settlement
  const handleFinanceSettlementSubmit = async (e) => {
    e.preventDefault();
    if (!settleModalClaim) return;
    try {
      setActionLoading(true);
      await expenseService.financeSettlement(settleModalClaim.id, {
        action: settleAction,
        payment_method: settlePaymentMethod,
        transaction_reference: settleTxRef.trim(),
        notes: settleNotes.trim(),
      });
      setSettleModalClaim(null);
      setSettleTxRef("");
      setSettleNotes("");
      handleShowToast(
        settleAction === "REIMBURSE"
          ? "✓ Expense disbursed & marked as fully Reimbursed!"
          : "✓ Settlement action applied successfully."
      );
      fetchData();
    } catch (err) {
      console.error("Finance settlement error:", err);
      alert(err.response?.data?.error || "Failed to process finance settlement.");
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered claims based on tab and filters
  const currentList = activeTab === "all" ? claims : myClaims;

  const filteredClaims = useMemo(() => {
    return currentList.filter((c) => {
      // Search
      const matchesSearch =
        !searchQuery.trim() ||
        c.claim_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.project_name?.toLowerCase().includes(searchQuery.toLowerCase());

      // Category
      const matchesCategory =
        filterCategory === "ALL" || c.category === filterCategory;

      // Status
      const matchesStatus =
        filterStatus === "ALL" || c.status === filterStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [currentList, searchQuery, filterCategory, filterStatus]);

  const formatINR = (val) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="exp-container" data-testid="expenses-dashboard">
      {/* ─── Header ─── */}
      <div className="exp-header">
        <div className="exp-header-titles">
          <h1>
            <span>🧾</span> Expense & Reimbursement Center
          </h1>
          <p>
            Track corporate claims, project-billable expenses, receipt audit trails, and multi-tier settlements.
          </p>
        </div>
        <div className="exp-header-actions">
          <button
            className="btn-primary-action"
            onClick={() => setShowCreateModal(true)}
            data-testid="btn-new-claim"
          >
            <span>+</span> Submit Expense Claim
          </button>
        </div>
      </div>

      {/* ─── Feedback Toast ─── */}
      {successMsg && <div className="exp-toast-banner">{successMsg}</div>}
      {error && <div className="exp-error-banner">{error}</div>}

      {/* ─── Executive KPI Cards ─── */}
      <div className="exp-kpi-grid">
        <div className="exp-kpi-card" data-testid="kpi-total-claims">
          <div className="exp-kpi-icon blue">📋</div>
          <div className="exp-kpi-content">
            <span className="exp-kpi-label">Total Claims</span>
            <div className="exp-kpi-val">{stats?.total_claims || claims.length || 0}</div>
            <span className="exp-kpi-sub">
              Total Value: {formatINR(stats?.total_amount)}
            </span>
          </div>
        </div>

        <div className="exp-kpi-card" data-testid="kpi-pending-mgr">
          <div className="exp-kpi-icon amber">⏳</div>
          <div className="exp-kpi-content">
            <span className="exp-kpi-label">Pending Manager Review</span>
            <div className="exp-kpi-val">{stats?.pending_manager_approval || 0}</div>
            <span className="exp-kpi-sub">Awaiting endorsement</span>
          </div>
        </div>

        <div className="exp-kpi-card" data-testid="kpi-pending-fin">
          <div className="exp-kpi-icon purple">🏦</div>
          <div className="exp-kpi-content">
            <span className="exp-kpi-label">Ready for Settlement</span>
            <div className="exp-kpi-val">{stats?.pending_finance_approval || 0}</div>
            <span className="exp-kpi-sub">Manager endorsed</span>
          </div>
        </div>

        <div className="exp-kpi-card" data-testid="kpi-reimbursed">
          <div className="exp-kpi-icon green">💳</div>
          <div className="exp-kpi-content">
            <span className="exp-kpi-label">Total Reimbursed</span>
            <div className="exp-kpi-val">
              {formatINR(stats?.total_reimbursed_amount)}
            </div>
            <span className="exp-kpi-sub highlight-green">
              Billable to Clients: {formatINR(stats?.billable_client_amount)}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Category Breakdown Bar ─── */}
      {stats?.category_breakdown && stats.category_breakdown.length > 0 && (
        <div className="exp-category-breakdown-card">
          <div className="exp-breakdown-title">
            <span>📊</span> Expense Spend Distribution by Category
          </div>
          <div className="exp-breakdown-tags">
            {stats.category_breakdown.map((item) => (
              <div key={item.category} className="exp-breakdown-pill">
                <span className="exp-pill-icon">
                  {CATEGORY_MAP[item.category]?.icon || "📑"}
                </span>
                <span className="exp-pill-label">
                  {CATEGORY_MAP[item.category]?.label || item.category}
                </span>
                <span className="exp-pill-count">({item.count})</span>
                <span className="exp-pill-amount">{formatINR(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Controls & Tabs ─── */}
      <div className="exp-controls-panel">
        <div className="exp-tabs">
          {isManagerOrAdmin && (
            <button
              className={`exp-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
              data-testid="tab-all-claims"
            >
              💼 Corporate Claims Feed ({claims.length})
            </button>
          )}
          <button
            className={`exp-tab-btn ${activeTab === "my" ? "active" : ""}`}
            onClick={() => setActiveTab("my")}
            data-testid="tab-my-claims"
          >
            👤 My Expense Claims ({myClaims.length})
          </button>
        </div>

        <div className="exp-filters-bar">
          <div className="exp-search-box">
            <span className="exp-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by claim #, title, employee, or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="search-claims"
            />
          </div>

          <select
            className="exp-select-filter"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            data-testid="filter-category"
          >
            <option value="ALL">All Categories</option>
            {Object.entries(CATEGORY_MAP).map(([key, info]) => (
              <option key={key} value={key}>
                {info.icon} {info.label}
              </option>
            ))}
          </select>

          <select
            className="exp-select-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            data-testid="filter-status"
          >
            <option value="ALL">All Statuses</option>
            {Object.entries(STATUS_MAP).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── Claims List / Table ─── */}
      {loading ? (
        <div className="exp-loading-box">
          <div className="exp-spinner"></div>
          <p>Loading corporate expense records…</p>
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="exp-empty-card">
          <div className="exp-empty-icon">🧾</div>
          <h3>No expense claims found</h3>
          <p>No claims match your selected search or filter criteria.</p>
          <button
            className="btn-outline-action"
            onClick={() => setShowCreateModal(true)}
          >
            Submit First Claim
          </button>
        </div>
      ) : (
        <div className="exp-table-wrapper">
          <table className="exp-table">
            <thead>
              <tr>
                <th>Claim ID & Title</th>
                <th>Employee</th>
                <th>Category</th>
                <th>Project / Billable</th>
                <th>Date</th>
                <th>Amount (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map((claim) => {
                const catInfo = CATEGORY_MAP[claim.category] || CATEGORY_MAP.OTHER;
                const stInfo = STATUS_MAP[claim.status] || STATUS_MAP.SUBMITTED;

                return (
                  <tr key={claim.id} className="exp-row" data-testid={`claim-row-${claim.id}`}>
                    <td className="exp-td-title">
                      <div className="exp-claim-number">{claim.claim_number}</div>
                      <div className="exp-claim-title-text" title={claim.title}>
                        {claim.title}
                      </div>
                    </td>
                    <td className="exp-td-emp">
                      <div className="exp-emp-name">{claim.employee_name}</div>
                      <div className="exp-emp-id">
                        {claim.employee_id} {claim.department_name ? `• ${claim.department_name}` : ""}
                      </div>
                    </td>
                    <td>
                      <span className={`exp-cat-badge ${catInfo.badgeClass}`}>
                        <span className="exp-badge-icon">{catInfo.icon}</span>
                        {catInfo.label}
                      </span>
                    </td>
                    <td>
                      {claim.project_code ? (
                        <div className="exp-project-link">
                          <span className="exp-prj-code">[{claim.project_code}]</span>
                          {claim.is_billable && (
                            <span className="exp-billable-pill" title="Invoiced to client">
                              Billable
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="exp-text-muted">Internal</span>
                      )}
                    </td>
                    <td className="exp-td-date">{claim.expense_date}</td>
                    <td className="exp-td-amount">
                      <div className="exp-amount-total">
                        {formatINR(claim.total_amount)}
                      </div>
                      {Number(claim.tax_amount) > 0 && (
                        <div className="exp-amount-tax">
                          + {formatINR(claim.tax_amount)} GST
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`exp-status-pill ${stInfo.badgeClass}`}>
                        <span className="exp-status-dot"></span>
                        {stInfo.label}
                      </span>
                    </td>
                    <td className="exp-td-actions">
                      <button
                        className="btn-exp-action view"
                        title="View Details & Receipt"
                        onClick={() => setDetailModalClaim(claim)}
                        data-testid={`btn-view-${claim.id}`}
                      >
                        👁️
                      </button>

                      {/* Manager Review Action */}
                      {isManagerOrAdmin && claim.status === "SUBMITTED" && (
                        <button
                          className="btn-exp-action review"
                          title="Manager Review"
                          onClick={() => {
                            setReviewModalClaim(claim);
                            setReviewAction("APPROVE");
                          }}
                          data-testid={`btn-mgr-review-${claim.id}`}
                        >
                          ✓ Review
                        </button>
                      )}

                      {/* Finance Settlement Action */}
                      {isFinanceOrAdmin &&
                        ["MANAGER_APPROVED", "FINANCE_APPROVED"].includes(claim.status) && (
                          <button
                            className="btn-exp-action settle"
                            title="Finance Settlement"
                            onClick={() => {
                              setSettleModalClaim(claim);
                              setSettleAction("REIMBURSE");
                            }}
                            data-testid={`btn-fin-settle-${claim.id}`}
                          >
                            💳 Settle
                          </button>
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── MODAL 1: Create Expense Claim ─── */}
      {showCreateModal && (
        <div className="exp-modal-backdrop">
          <div className="exp-modal-card" data-testid="modal-create-claim">
            <div className="exp-modal-header">
              <h2><span>🧾</span> Submit Expense Claim</h2>
              <button
                className="exp-modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="exp-form">
              <div className="exp-form-group">
                <label>Claim Title / Business Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Client Visit to Mumbai - Flight & Hotel"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  data-testid="input-claim-title"
                />
              </div>

              <div className="exp-form-row">
                <div className="exp-form-group">
                  <label>Category *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    data-testid="input-claim-category"
                  >
                    {Object.entries(CATEGORY_MAP).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.icon} {info.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="exp-form-group">
                  <label>Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={newExpenseDate}
                    onChange={(e) => setNewExpenseDate(e.target.value)}
                    data-testid="input-claim-date"
                  />
                </div>
              </div>

              <div className="exp-form-row">
                <div className="exp-form-group">
                  <label>Base Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    data-testid="input-claim-amount"
                  />
                </div>

                <div className="exp-form-group">
                  <label>GST / Tax Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newTaxAmount}
                    onChange={(e) => setNewTaxAmount(e.target.value)}
                    data-testid="input-claim-tax"
                  />
                </div>
              </div>

              {/* Total calculation preview */}
              <div className="exp-calc-preview">
                <span>Calculated Total Claim:</span>
                <strong>
                  {formatINR(
                    (parseFloat(newAmount || 0) + parseFloat(newTaxAmount || 0)).toFixed(2)
                  )}
                </strong>
              </div>

              <div className="exp-form-row">
                <div className="exp-form-group">
                  <label>Associated Project (Optional)</label>
                  <select
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    data-testid="input-claim-project"
                  >
                    <option value="">None (Internal Company Overhead)</option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name} ({p.client_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="exp-form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newIsBillable}
                      onChange={(e) => setNewIsBillable(e.target.checked)}
                      data-testid="input-claim-billable"
                    />
                    <span>Billable to Client Project</span>
                  </label>
                </div>
              </div>

              <div className="exp-form-group">
                <label>Receipt Document / Invoice URL</label>
                <input
                  type="url"
                  placeholder="https://... or link to invoice drive document"
                  value={newReceiptUrl}
                  onChange={(e) => setNewReceiptUrl(e.target.value)}
                  data-testid="input-claim-receipt-url"
                />
                <span className="exp-help-text">
                  Tip: Attach a verified cloud link or sample image URL for instant verification.
                </span>
              </div>

              <div className="exp-form-group">
                <label>Business Justification & Notes</label>
                <textarea
                  rows="3"
                  placeholder="Describe the business need, attendee names, or travel itinerary..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  data-testid="input-claim-description"
                ></textarea>
              </div>

              <div className="exp-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit"
                  data-testid="btn-submit-claim-form"
                >
                  {actionLoading ? "Submitting…" : "Submit for Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Details & Receipt Inspection ─── */}
      {detailModalClaim && (
        <div className="exp-modal-backdrop">
          <div className="exp-modal-card wide" data-testid="modal-detail-claim">
            <div className="exp-modal-header">
              <h2>
                <span>📑</span> Claim {detailModalClaim.claim_number}
              </h2>
              <button
                className="exp-modal-close"
                onClick={() => setDetailModalClaim(null)}
              >
                ✕
              </button>
            </div>

            <div className="exp-detail-body">
              <div className="exp-detail-header-info">
                <h3>{detailModalClaim.title}</h3>
                <div className="exp-detail-meta-row">
                  <span><strong>Employee:</strong> {detailModalClaim.employee_name} ({detailModalClaim.employee_id})</span>
                  <span><strong>Date:</strong> {detailModalClaim.expense_date}</span>
                  <span><strong>Category:</strong> {detailModalClaim.category_display}</span>
                  {detailModalClaim.project_code && (
                    <span><strong>Project:</strong> [{detailModalClaim.project_code}] {detailModalClaim.project_name}</span>
                  )}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="exp-financial-box">
                <div className="exp-fin-item">
                  <span className="exp-fin-label">Base Subtotal:</span>
                  <span className="exp-fin-val">{formatINR(detailModalClaim.amount)}</span>
                </div>
                <div className="exp-fin-item">
                  <span className="exp-fin-label">GST / Tax:</span>
                  <span className="exp-fin-val">{formatINR(detailModalClaim.tax_amount)}</span>
                </div>
                <div className="exp-fin-item highlight">
                  <span className="exp-fin-label">Total Claim:</span>
                  <span className="exp-fin-val">{formatINR(detailModalClaim.total_amount)}</span>
                </div>
              </div>

              {/* Justification description */}
              {detailModalClaim.description && (
                <div className="exp-detail-section">
                  <h4>Business Justification:</h4>
                  <p>{detailModalClaim.description}</p>
                </div>
              )}

              {/* Receipt Preview */}
              <div className="exp-detail-section">
                <h4>Receipt / Tax Invoice:</h4>
                {detailModalClaim.receipt_url ? (
                  <div className="exp-receipt-viewer">
                    <img
                      src={detailModalClaim.receipt_url}
                      alt="Receipt Document"
                      className="exp-receipt-preview-img"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                    <a
                      href={detailModalClaim.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-receipt-link"
                    >
                      🔗 Open Full Resolution Document
                    </a>
                  </div>
                ) : (
                  <p className="exp-text-muted">No external receipt image attached.</p>
                )}
              </div>

              {/* Audit trail */}
              <div className="exp-detail-section audit-section">
                <h4>Approval & Disbursement Audit Trail:</h4>
                <div className="exp-audit-timeline">
                  <div className="exp-audit-step done">
                    <div className="exp-step-dot"></div>
                    <div className="exp-step-info">
                      <strong>1. Claim Submitted</strong>
                      <span>By {detailModalClaim.employee_name} on {detailModalClaim.created_at?.split("T")[0]}</span>
                    </div>
                  </div>

                  <div className={`exp-audit-step ${detailModalClaim.manager_reviewed_at ? "done" : ""}`}>
                    <div className="exp-step-dot"></div>
                    <div className="exp-step-info">
                      <strong>2. Manager Endorsement</strong>
                      {detailModalClaim.manager_reviewed_at ? (
                        <>
                          <span>Reviewed by {detailModalClaim.manager_reviewer_name} on {detailModalClaim.manager_reviewed_at?.split("T")[0]}</span>
                          {detailModalClaim.manager_notes && (
                            <div className="exp-audit-note">"{detailModalClaim.manager_notes}"</div>
                          )}
                        </>
                      ) : (
                        <span>Pending Manager Review</span>
                      )}
                    </div>
                  </div>

                  <div className={`exp-audit-step ${detailModalClaim.reimbursed_at ? "done" : ""}`}>
                    <div className="exp-step-dot"></div>
                    <div className="exp-step-info">
                      <strong>3. Finance Settlement & Disbursement</strong>
                      {detailModalClaim.reimbursed_at ? (
                        <>
                          <span>Disbursed by {detailModalClaim.finance_reviewer_name} on {detailModalClaim.reimbursed_at?.split("T")[0]}</span>
                          <span>Method: {detailModalClaim.payment_method_display || "Direct Bank Deposit"}</span>
                          {detailModalClaim.transaction_reference && (
                            <span>Tx Ref: <code>{detailModalClaim.transaction_reference}</code></span>
                          )}
                          {detailModalClaim.finance_notes && (
                            <div className="exp-audit-note">"{detailModalClaim.finance_notes}"</div>
                          )}
                        </>
                      ) : (
                        <span>Awaiting Finance Payout</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="exp-modal-actions">
              <button
                className="btn-modal-cancel"
                onClick={() => setDetailModalClaim(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: Manager Review ─── */}
      {reviewModalClaim && (
        <div className="exp-modal-backdrop">
          <div className="exp-modal-card" data-testid="modal-review-claim">
            <div className="exp-modal-header">
              <h2><span>✓</span> Manager Review: {reviewModalClaim.claim_number}</h2>
              <button
                className="exp-modal-close"
                onClick={() => setReviewModalClaim(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManagerReviewSubmit} className="exp-form">
              <div className="exp-review-summary-card">
                <div><strong>Claimant:</strong> {reviewModalClaim.employee_name}</div>
                <div><strong>Amount:</strong> {formatINR(reviewModalClaim.total_amount)}</div>
                <div><strong>Title:</strong> {reviewModalClaim.title}</div>
              </div>

              <div className="exp-form-group">
                <label>Review Decision *</label>
                <div className="exp-action-radio-group">
                  <label className={`exp-radio-label ${reviewAction === "APPROVE" ? "active green" : ""}`}>
                    <input
                      type="radio"
                      name="mgrAction"
                      value="APPROVE"
                      checked={reviewAction === "APPROVE"}
                      onChange={() => setReviewAction("APPROVE")}
                    />
                    <span>✓ Approve & Send to Finance</span>
                  </label>
                  <label className={`exp-radio-label ${reviewAction === "REJECT" ? "active red" : ""}`}>
                    <input
                      type="radio"
                      name="mgrAction"
                      value="REJECT"
                      checked={reviewAction === "REJECT"}
                      onChange={() => setReviewAction("REJECT")}
                    />
                    <span>✕ Request Revision / Reject</span>
                  </label>
                </div>
              </div>

              <div className="exp-form-group">
                <label>Manager Comments & Feedback</label>
                <textarea
                  rows="3"
                  placeholder="Add notes for the employee or finance department..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  data-testid="input-mgr-notes"
                ></textarea>
              </div>

              <div className="exp-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setReviewModalClaim(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit"
                  data-testid="btn-submit-mgr-review"
                >
                  {actionLoading ? "Processing…" : "Submit Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: Finance Settlement ─── */}
      {settleModalClaim && (
        <div className="exp-modal-backdrop">
          <div className="exp-modal-card" data-testid="modal-settle-claim">
            <div className="exp-modal-header">
              <h2><span>💳</span> Finance Settlement: {settleModalClaim.claim_number}</h2>
              <button
                className="exp-modal-close"
                onClick={() => setSettleModalClaim(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFinanceSettlementSubmit} className="exp-form">
              <div className="exp-review-summary-card">
                <div><strong>Claimant:</strong> {settleModalClaim.employee_name}</div>
                <div><strong>Payable Amount:</strong> {formatINR(settleModalClaim.total_amount)}</div>
                <div><strong>Manager Endorsement:</strong> {settleModalClaim.manager_notes || "Endorsed"}</div>
              </div>

              <div className="exp-form-group">
                <label>Finance Action *</label>
                <select
                  value={settleAction}
                  onChange={(e) => setSettleAction(e.target.value)}
                  data-testid="select-settle-action"
                >
                  <option value="REIMBURSE">Disburse & Mark as Reimbursed</option>
                  <option value="APPROVE">Finance Authorize (Schedule for batch run)</option>
                  <option value="REJECT">Reject / Request Clarification</option>
                </select>
              </div>

              {settleAction === "REIMBURSE" && (
                <>
                  <div className="exp-form-group">
                    <label>Payment Method *</label>
                    <select
                      value={settlePaymentMethod}
                      onChange={(e) => setSettlePaymentMethod(e.target.value)}
                      data-testid="select-settle-payment-method"
                    >
                      <option value="DIRECT_DEPOSIT">Direct Bank Deposit</option>
                      <option value="NEFT_UPI">Corporate NEFT / UPI</option>
                      <option value="PAYROLL_ADDON">Payroll Cycle Add-on</option>
                      <option value="COMPANY_CARD">Corporate Credit Card Settlement</option>
                      <option value="CASH">Petty Cash</option>
                    </select>
                  </div>

                  <div className="exp-form-group">
                    <label>Transaction / UTR Reference ID</label>
                    <input
                      type="text"
                      placeholder="e.g., NEFT/HDFC/20261014/998231"
                      value={settleTxRef}
                      onChange={(e) => setSettleTxRef(e.target.value)}
                      data-testid="input-settle-tx-ref"
                    />
                  </div>
                </>
              )}

              <div className="exp-form-group">
                <label>Finance Remarks & Settlement Notes</label>
                <textarea
                  rows="3"
                  placeholder="Notes for accounting and employee ledger..."
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  data-testid="input-settle-notes"
                ></textarea>
              </div>

              <div className="exp-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setSettleModalClaim(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-modal-submit"
                  data-testid="btn-submit-settlement"
                >
                  {actionLoading ? "Processing…" : "Execute Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
