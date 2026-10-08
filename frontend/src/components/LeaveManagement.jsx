import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { leaveService } from "../services/leaveService";
import LeaveDetailModal from "./LeaveDetailModal";
import LeaveRequestModal from "./LeaveRequestModal";
import LeaveRejectModal from "./LeaveRejectModal";
import "./LeaveManagement.css";

export default function LeaveManagement() {
  const { user, isSuperAdmin, isHRAdmin, isManager } = useAuth();
  const isManagerOrAdmin = Boolean(isSuperAdmin || isHRAdmin || isManager);
  const isHRorSuperAdmin = Boolean(isSuperAdmin || isHRAdmin);

  // Tabs: 'my', 'queue', 'all', 'calendar'
  const [activeTab, setActiveTab] = useState(isManagerOrAdmin ? "queue" : "my");
  const [leaves, setLeaves] = useState([]);
  const [calendarLeaves, setCalendarLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [summary, setSummary] = useState({
    total_pending: 0,
    approved_this_month: 0,
    total_rejected: 0,
    on_leave_today: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Date range filters
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [datePreset, setDatePreset] = useState("all");

  // Calendar month/year navigation
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  // Modals state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [rejectRequestId, setRejectRequestId] = useState(null);

  // Deduplicate leave types and balances to ensure no duplicated items
  const uniqueLeaveTypes = useMemo(() => {
    const map = new Map();
    for (const t of leaveTypes) {
      if (t && t.id && !map.has(t.id)) {
        map.set(t.id, t);
      }
    }
    return Array.from(map.values());
  }, [leaveTypes]);

  const uniqueBalances = useMemo(() => {
    const map = new Map();
    for (const b of balances) {
      const key = b?.leave_type_id || b?.leave_type?.id || b?.leave_type_code || b?.id;
      if (key && !map.has(key)) {
        map.set(key, b);
      }
    }
    return Array.from(map.values());
  }, [balances]);

  // Load static types, balances, and summary
  useEffect(() => {
    leaveService.getLeaveTypes({ active_only: "true" })
      .then(setLeaveTypes)
      .catch((err) => console.error("Error loading leave types:", err));

    leaveService.getLeaveBalances()
      .then(setBalances)
      .catch((err) => console.error("Error loading leave balances:", err));

    leaveService.getLeaveSummary()
      .then(setSummary)
      .catch((err) => console.error("Error loading summary:", err));
  }, []);

  // Fetch leaves based on active tab and filters
  const fetchLeaves = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      if (activeTab === "calendar") {
        const y = calendarDate.getFullYear();
        const m = calendarDate.getMonth();
        const firstDay = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
        const lastDay = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);

        const calData = await leaveService.getLeaveCalendar({
          start_date: firstDay,
          end_date: lastDay,
        });
        setCalendarLeaves(calData);
        setIsLoading(false);
        return;
      }

      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.leave_type = typeFilter;
      if (startDateFilter) params.start_date = startDateFilter;
      if (endDateFilter) params.end_date = endDateFilter;

      if (activeTab === "my") {
        params.scope = "my";
      } else if (activeTab === "queue") {
        params.status = "PENDING";
        if (isManager && !isHRorSuperAdmin) {
          params.scope = "team";
        }
      } else if (activeTab === "all") {
        // all company leaves
      }

      const data = await leaveService.getLeaves(params);
      setLeaves(data);
    } catch (err) {
      setError(err?.message || "Failed to load leave records.");
    } finally {
      setIsLoading(false);
    }
  }, [
    activeTab,
    statusFilter,
    typeFilter,
    startDateFilter,
    endDateFilter,
    calendarDate,
    isManager,
    isHRorSuperAdmin,
  ]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  // Date range presets helper
  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === "all") {
      setStartDateFilter("");
      setEndDateFilter("");
    } else if (preset === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDateFilter(start.toISOString().slice(0, 10));
      setEndDateFilter(end.toISOString().slice(0, 10));
    } else if (preset === "next_month") {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      setStartDateFilter(start.toISOString().slice(0, 10));
      setEndDateFilter(end.toISOString().slice(0, 10));
    } else if (preset === "next_30") {
      const end = new Date();
      end.setDate(now.getDate() + 30);
      setStartDateFilter(now.toISOString().slice(0, 10));
      setEndDateFilter(end.toISOString().slice(0, 10));
    } else if (preset === "past_30") {
      const start = new Date();
      start.setDate(now.getDate() - 30);
      setStartDateFilter(start.toISOString().slice(0, 10));
      setEndDateFilter(now.toISOString().slice(0, 10));
    } else if (preset === "this_year") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      setStartDateFilter(start.toISOString().slice(0, 10));
      setEndDateFilter(end.toISOString().slice(0, 10));
    }
  };

  const handleClearFilters = () => {
    setStatusFilter("");
    setTypeFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setDatePreset("all");
  };

  // Refresh summary and balances when actions occur
  const refreshAll = () => {
    fetchLeaves();
    leaveService.getLeaveSummary().then(setSummary).catch(() => {});
    leaveService.getLeaveBalances().then(setBalances).catch(() => {});
  };

  const handleQuickApprove = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm(`Approve leave request #${id}?`)) return;
    try {
      await leaveService.approveLeave(id);
      refreshAll();
    } catch (err) {
      alert(err?.error || "Failed to approve request.");
    }
  };

  const handleQuickReject = (id, e) => {
    e.stopPropagation();
    setRejectRequestId(id);
  };

  const handleRejectConfirm = async (id, reason) => {
    await leaveService.rejectLeave(id, reason);
    refreshAll();
  };

  return (
    <div className="leave-page">
      {/* ─── Top Metrics Bar ────────────────────────────────────────────── */}
      <section className="leave-metrics-grid">
        <div className="leave-metric-card">
          <div className="metric-top">
            <span className="metric-title">Pending Approvals</span>
            <div className="metric-icon-badge pending">⏳</div>
          </div>
          <span className="metric-value">{summary.total_pending}</span>
          <span className="metric-sub">Requires management review</span>
        </div>

        <div className="leave-metric-card">
          <div className="metric-top">
            <span className="metric-title">On Leave Today</span>
            <div className="metric-icon-badge active">🏖️</div>
          </div>
          <span className="metric-value">{summary.on_leave_today}</span>
          <span className="metric-sub">Active absence records</span>
        </div>

        <div className="leave-metric-card">
          <div className="metric-top">
            <span className="metric-title">Approved (This Month)</span>
            <div className="metric-icon-badge approved">✅</div>
          </div>
          <span className="metric-value">{summary.approved_this_month}</span>
          <span className="metric-sub">Confirmed leave periods</span>
        </div>

        <div className="leave-metric-card">
          <div className="metric-top">
            <span className="metric-title">Total Rejected</span>
            <div className="metric-icon-badge rejected">❌</div>
          </div>
          <span className="metric-value">{summary.total_rejected}</span>
          <span className="metric-sub">Archived with reason</span>
        </div>
      </section>

      {/* ─── Configurable Leave Balances (Personal Allowances) ──────────── */}
      {uniqueBalances && uniqueBalances.length > 0 && (
        <section className="leave-balances-strip">
          <div className="balances-head">
            <h4>My Annual Leave Allowances ({new Date().getFullYear()})</h4>
            <span className="field-hint">Configured policy balances ({uniqueBalances.length} categories)</span>
          </div>
          <div className="balances-grid">
            {uniqueBalances.map((b) => (
              <div key={b.id || b.leave_type_name} className="balance-pill-card">
                <div className="balance-title">
                  <span>{b.leave_type_name}</span>
                  <span className="paid-tag paid">Quota</span>
                </div>
                <div className="balance-numbers">
                  <span className="avail-count">{b.available_days}d</span>
                  <span className="total-quota">/ {b.allocated_days}d Total</span>
                </div>
                <span className="used-sub">
                  Used: {b.used_days}d · Pending: {b.pending_days}d
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Main Panel: Tabs & Data Table ─────────────────────────────── */}
      <section className="leave-main-panel">
        <div className="leave-panel-top">
          <div className="tab-group">
            {isManagerOrAdmin && (
              <button
                className={`tab-btn ${activeTab === "queue" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("queue");
                  setStatusFilter("");
                }}
              >
                Approval Queue
                {summary.total_pending > 0 && (
                  <span className="queue-badge">{summary.total_pending}</span>
                )}
              </button>
            )}

            <button
              className={`tab-btn ${activeTab === "my" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("my");
                setStatusFilter("");
              }}
            >
              My Leaves
            </button>

            {isHRorSuperAdmin && (
              <button
                className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("all");
                  setStatusFilter("");
                }}
              >
                All Company Leaves
              </button>
            )}

            <button
              className={`tab-btn ${activeTab === "calendar" ? "active" : ""}`}
              onClick={() => setActiveTab("calendar")}
            >
              Calendar Schedule
            </button>
          </div>

          <button
            className="btn primary"
            onClick={() => setIsRequestModalOpen(true)}
          >
            + Request Leave
          </button>
        </div>

        {/* ─── Filters Bar (for Table views) ───────────────────────────── */}
        {activeTab !== "calendar" && (
          <div className="leave-filters">
            <div className="filter-controls">
              {activeTab !== "queue" && (
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  title="Filter by status"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              )}

              <select
                className="filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                title="Filter by category"
              >
                <option value="">All Leave Categories</option>
                {uniqueLeaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              {/* Date Range Selection & Presets */}
              <select
                className="filter-select preset-select"
                value={datePreset}
                onChange={(e) => handleDatePreset(e.target.value)}
                title="Date range preset"
              >
                <option value="all">🗓️ All Dates</option>
                <option value="this_month">This Month</option>
                <option value="next_month">Next Month</option>
                <option value="next_30">Next 30 Days</option>
                <option value="past_30">Past 30 Days</option>
                <option value="this_year">This Year ({new Date().getFullYear()})</option>
                <option value="custom">Custom Range</option>
              </select>

              <div className="date-picker-inputs">
                <label className="date-input-label">
                  <span>From:</span>
                  <input
                    type="date"
                    className="filter-date-input"
                    value={startDateFilter}
                    onChange={(e) => {
                      setStartDateFilter(e.target.value);
                      setDatePreset("custom");
                    }}
                  />
                </label>
                <label className="date-input-label">
                  <span>To:</span>
                  <input
                    type="date"
                    className="filter-date-input"
                    value={endDateFilter}
                    onChange={(e) => {
                      setEndDateFilter(e.target.value);
                      setDatePreset("custom");
                    }}
                  />
                </label>
              </div>

              {(statusFilter || typeFilter || startDateFilter || endDateFilter) && (
                <button
                  type="button"
                  className="filter-clear-btn"
                  onClick={handleClearFilters}
                  title="Reset all filters"
                >
                  ✕ Reset
                </button>
              )}
            </div>

            <div className="results-count">
              <span>{leaves.length} record(s) found</span>
            </div>
          </div>
        )}

        {/* ─── View Content ────────────────────────────────────────────── */}
        {error && <div className="form-error-banner m-4">{error}</div>}

        {isLoading ? (
          <div className="modal-loading-state p-8">
            <div className="spinner-sm" />
            <span>Loading leave records...</span>
          </div>
        ) : activeTab === "calendar" ? (
          /* Calendar Schedule View */
          <div className="leave-calendar-card">
            <div className="calendar-header-toolbar">
              <div className="calendar-header-info">
                <h4>Approved Leaves Schedule</h4>
                <span className="field-hint">Confirmed team leaves and absences</span>
              </div>
              <div className="calendar-period-nav">
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={() => {
                    const prev = new Date(calendarDate);
                    prev.setMonth(prev.getMonth() - 1);
                    setCalendarDate(prev);
                  }}
                  title="Previous month"
                >
                  ◀
                </button>
                <span className="calendar-period-label">
                  {calendarDate.toLocaleString("default", { month: "long", year: "numeric" })}
                </span>
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={() => {
                    const next = new Date(calendarDate);
                    next.setMonth(next.getMonth() + 1);
                    setCalendarDate(next);
                  }}
                  title="Next month"
                >
                  ▶
                </button>
                <button
                  type="button"
                  className="calendar-today-btn"
                  onClick={() => setCalendarDate(new Date())}
                >
                  Current Month
                </button>
              </div>
            </div>

            {calendarLeaves.length === 0 ? (
              <div className="empty-state p-8">
                <p>No approved leaves scheduled in {calendarDate.toLocaleString("default", { month: "long", year: "numeric" })}.</p>
              </div>
            ) : (
              <div className="calendar-list">
                {calendarLeaves.map((item) => (
                  <div key={item.id} className="calendar-item">
                    <div className="cal-info">
                      <strong>{item.employee_name} ({item.employee_id})</strong>
                      <div className="cal-dates">
                        🗓️ {item.start_date} → {item.end_date} ({item.duration_days} days) · {item.leave_type}
                      </div>
                    </div>
                    <span className={`paid-tag ${item.is_paid ? "paid" : "unpaid"}`}>
                      {item.is_paid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <div className="table-responsive">
            <table className="leave-table">
              <thead>
                <tr>
                  {activeTab !== "my" && <th>Employee</th>}
                  <th>Category</th>
                  <th>Dates &amp; Duration</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeTab !== "my" ? 6 : 5}
                      className="text-center p-8 text-gray-500"
                    >
                      No leave requests found matching this view and date range.
                    </td>
                  </tr>
                ) : (
                  leaves.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedRequestId(row.id)}
                      style={{ cursor: "pointer" }}
                    >
                      {activeTab !== "my" && (
                        <td>
                          <div className="emp-cell">
                            <strong>{row.employee_name}</strong>
                            <span>{row.employee_code} · {row.department_name || "General"}</span>
                          </div>
                        </td>
                      )}
                      <td>
                        <div className="type-cell">
                          <span>{row.leave_type_name}</span>
                          <span className={`paid-tag ${row.is_paid ? "paid" : "unpaid"}`}>
                            {row.is_paid ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="period-cell">
                          <strong>{row.start_date} → {row.end_date}</strong>
                          <span>{row.duration_days} Day(s)</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${row.status.toLowerCase()}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <span className="text-gray-500 text-xs">
                          {new Date(row.submitted_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons-group">
                          <button
                            type="button"
                            className="action-btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequestId(row.id);
                            }}
                          >
                            Details
                          </button>

                          {/* Quick decision buttons if in queue and status is PENDING */}
                          {row.status === "PENDING" && isManagerOrAdmin && activeTab === "queue" && (
                            <>
                              <button
                                type="button"
                                className="action-btn-sm approve"
                                onClick={(e) => handleQuickApprove(row.id, e)}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="action-btn-sm reject"
                                onClick={(e) => handleQuickReject(row.id, e)}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      <LeaveRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={refreshAll}
        leaveTypes={uniqueLeaveTypes}
      />

      <LeaveDetailModal
        isOpen={Boolean(selectedRequestId)}
        requestId={selectedRequestId}
        onClose={() => setSelectedRequestId(null)}
        canApprove={isManagerOrAdmin}
        isOwnRequest={activeTab === "my"}
        onUpdated={refreshAll}
      />

      <LeaveRejectModal
        isOpen={Boolean(rejectRequestId)}
        requestId={rejectRequestId}
        onClose={() => setRejectRequestId(null)}
        onConfirm={handleRejectConfirm}
      />
    </div>
  );
}
