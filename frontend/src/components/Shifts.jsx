import React, { useState, useEffect, useMemo } from "react";
import shiftService from "../services/shiftService";
import employeeService from "../services/employeeService";
import "./Shifts.css";

const Shifts = ({ user }) => {
  const [activeTab, setActiveTab] = useState("roster"); // 'roster' | 'swaps' | 'overtime' | 'templates'
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [roster, setRoster] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [overtimes, setOvertimes] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Filters & Controls
  const [viewScope, setViewScope] = useState("team"); // 'team' | 'my'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShiftFilter, setSelectedShiftFilter] = useState("ALL");
  const [alert, setAlert] = useState(null);

  // Modals
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [reviewSwapModal, setReviewSwapModal] = useState(null);
  const [reviewOtModal, setReviewOtModal] = useState(null);

  // Form states
  const [bulkForm, setBulkForm] = useState({
    employee_ids: [],
    shift_id: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date(Date.now() + 4 * 86400000).toISOString().split("T")[0],
    notes: "",
  });

  const [swapForm, setSwapForm] = useState({
    requester_assignment_id: "",
    target_employee_id: "",
    target_assignment_id: "",
    reason: "",
    isOpenPool: false,
  });

  const [otForm, setOtForm] = useState({
    date: new Date().toISOString().split("T")[0],
    start_time: "18:00",
    end_time: "20:30",
    hours: "2.5",
    rate_multiplier: "1.50",
    project_code: "",
    reason: "",
  });

  const [templateForm, setTemplateForm] = useState({
    code: "",
    name: "",
    start_time: "09:00",
    end_time: "18:00",
    grace_period_minutes: 15,
    break_duration_minutes: 60,
    is_night_shift: false,
    color_code: "#00ffcc",
    description: "",
  });

  const isManagement = useMemo(() => {
    return (
      ["SUPER_ADMIN", "ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD", "MANAGER"].includes(
        user?.role
      ) || user?.is_staff
    );
  }, [user]);

  const showAlert = (message, type = "success") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, tmplRes, rosterRes, swapRes, otRes] = await Promise.all([
        shiftService.getShiftStats().catch(() => null),
        shiftService.getShiftTemplates().catch(() => []),
        shiftService.getRoster({ view_scope: "team" }).catch(() => []),
        shiftService.getSwapRequests().catch(() => []),
        shiftService.getOvertimeRecords().catch(() => []),
      ]);

      setStats(statsRes);
      setTemplates(Array.isArray(tmplRes) ? tmplRes : []);
      setRoster(Array.isArray(rosterRes) ? rosterRes : []);
      setSwaps(Array.isArray(swapRes) ? swapRes : []);
      setOvertimes(Array.isArray(otRes) ? otRes : []);

      // If management, also fetch employees list for assignment dropdown
      if (isManagement) {
        employeeService
          .getEmployees({ page_size: 100 })
          .then((res) => {
            const list = res?.results || res || [];
            setEmployees(Array.isArray(list) ? list : []);
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("Failed to load shift management data:", err);
      showAlert("Could not retrieve shifts data from server.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, isManagement]);

  // Bulk Assign Submit
  const handleBulkAssignSubmit = async (e) => {
    e.preventDefault();
    if (bulkForm.employee_ids.length === 0 || !bulkForm.shift_id) {
      showAlert("Please choose at least one employee and a shift template.", "error");
      return;
    }

    try {
      await shiftService.bulkAssignShifts(bulkForm);
      showAlert("Shift roster assignments successfully provisioned!");
      setShowBulkAssignModal(false);
      fetchData();
    } catch (err) {
      showAlert(err?.response?.data?.detail || "Failed to bulk assign shifts.", "error");
    }
  };

  // Submit Shift Swap
  const handleSwapSubmit = async (e) => {
    e.preventDefault();
    if (!swapForm.requester_assignment_id || !swapForm.reason) {
      showAlert("Please select a roster assignment and provide justification.", "error");
      return;
    }

    try {
      await shiftService.submitSwapRequest({
        requester_assignment_id: swapForm.requester_assignment_id,
        target_employee_id: swapForm.isOpenPool ? null : swapForm.target_employee_id || null,
        target_assignment_id: swapForm.isOpenPool ? null : swapForm.target_assignment_id || null,
        reason: swapForm.reason,
      });
      showAlert("Shift swap request posted successfully!");
      setShowSwapModal(false);
      fetchData();
    } catch (err) {
      showAlert(err?.response?.data?.detail || "Failed to submit swap request.", "error");
    }
  };

  // Peer respond to swap
  const handlePeerRespond = async (swapId, decision) => {
    try {
      await shiftService.respondPeerSwap(swapId, decision);
      showAlert(`Shift swap trade ${decision.toLowerCase()}!`);
      fetchData();
    } catch (err) {
      showAlert(err?.response?.data?.detail || "Failed to record peer decision.", "error");
    }
  };

  // Manager review swap
  const handleManagerReviewSwap = async (swapId, decision, notes) => {
    try {
      await shiftService.reviewManagerSwap(swapId, decision, notes);
      showAlert(`Shift swap successfully ${decision.toLowerCase()}!`);
      setReviewSwapModal(null);
      fetchData();
    } catch (err) {
      showAlert(err?.response?.data?.detail || "Failed to review shift swap.", "error");
    }
  };

  // Submit Overtime Claim
  const handleOtSubmit = async (e) => {
    e.preventDefault();
    if (!otForm.date || !otForm.hours || !otForm.reason) {
      showAlert("Please fill in date, duration hours, and reason.", "error");
      return;
    }

    try {
      await shiftService.submitOvertime(otForm);
      showAlert("Overtime claim submitted for supervisor approval.");
      setShowOvertimeModal(false);
      fetchData();
    } catch (err) {
      showAlert(err?.response?.data?.detail || "Failed to submit overtime.", "error");
    }
  };

  // Manager review overtime
  const handleReviewOt = async (otId, decision, notes) => {
    try {
      await shiftService.reviewOvertime(otId, decision, notes);
      showAlert(`Overtime claim ${decision.toLowerCase()}!`);
      setReviewOtModal(null);
      fetchData();
    } catch (err) {
      showAlert(err?.response?.data?.detail || "Failed to review overtime.", "error");
    }
  };

  // Create Template
  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!templateForm.code || !templateForm.name) {
      showAlert("Code and Name are required.", "error");
      return;
    }

    try {
      await shiftService.createShiftTemplate(templateForm);
      showAlert("New Shift Template registered!");
      setShowTemplateModal(false);
      fetchData();
    } catch (err) {
      showAlert(err?.response?.data?.detail || "Failed to create template.", "error");
    }
  };

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    return roster.filter((r) => {
      if (viewScope === "my" && r.employee !== user?.id) return false;
      if (selectedShiftFilter !== "ALL" && r.shift_code !== selectedShiftFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.employee_name?.toLowerCase().includes(q);
        const matchShift = r.shift_name?.toLowerCase().includes(q);
        const matchNotes = r.notes?.toLowerCase().includes(q);
        if (!matchName && !matchShift && !matchNotes) return false;
      }
      return true;
    });
  }, [roster, viewScope, selectedShiftFilter, searchQuery, user]);

  return (
    <div className="shifts-container" id="shifts-module-root">
      {/* Module Header */}
      <div className="shifts-header">
        <div>
          <h1 className="shifts-title">
            <span className="electric-badge">WTS CORE</span> Shift Scheduling & Overtime Hub
          </h1>
          <p className="shifts-subtitle">
            Enterprise shift rosters, peer schedule trade negotiation, 24/7 graveyard rotation, and verified overtime tracking.
          </p>
        </div>
        <div className="shifts-header-actions">
          {isManagement && (
            <button
              id="bulk-assign-btn"
              className="action-btn btn-primary-cyan"
              onClick={() => setShowBulkAssignModal(true)}
            >
              📅 + Bulk Assign Shifts
            </button>
          )}
          <button
            id="request-swap-btn"
            className="action-btn btn-amber"
            onClick={() => setShowSwapModal(true)}
          >
            🔄 Trade / Swap Shift
          </button>
          <button
            id="claim-ot-btn"
            className="action-btn btn-purple"
            onClick={() => setShowOvertimeModal(true)}
          >
            ⏱️ + Claim Overtime
          </button>
        </div>
      </div>

      {alert && (
        <div className={`shifts-alert alert-${alert.type}`} role="alert">
          {alert.message}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="shifts-kpi-grid">
        <div className="kpi-card" id="kpi-shifts-today">
          <div className="kpi-icon">⏰</div>
          <div className="kpi-content">
            <span className="kpi-value">{stats?.active_shifts_today ?? 0}</span>
            <span className="kpi-label">Active Shifts Today</span>
          </div>
        </div>
        <div className="kpi-card" id="kpi-week-roster">
          <div className="kpi-icon">📅</div>
          <div className="kpi-content">
            <span className="kpi-value">{stats?.total_rostered_week ?? 0}</span>
            <span className="kpi-label">Rostered This Week</span>
          </div>
        </div>
        <div className="kpi-card" id="kpi-pending-swaps">
          <div className="kpi-icon">🔄</div>
          <div className="kpi-content">
            <span className="kpi-value">{stats?.pending_swaps ?? 0}</span>
            <span className="kpi-label">Pending Swap Trades</span>
          </div>
        </div>
        <div className="kpi-card" id="kpi-approved-ot">
          <div className="kpi-icon">⏱️</div>
          <div className="kpi-content">
            <span className="kpi-value">
              {stats?.approved_ot_hours_month ? `${stats.approved_ot_hours_month}h` : "0h"}
            </span>
            <span className="kpi-label">Approved OT This Month</span>
          </div>
        </div>
        <div className="kpi-card" id="kpi-pending-ot">
          <div className="kpi-icon">📝</div>
          <div className="kpi-content">
            <span className="kpi-value">{stats?.pending_ot_claims ?? 0}</span>
            <span className="kpi-label">Open OT Claims</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="shifts-tabs">
        <button
          className={`tab-btn ${activeTab === "roster" ? "active" : ""}`}
          onClick={() => setActiveTab("roster")}
        >
          📅 Roster & Schedule Grid ({filteredRoster.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "swaps" ? "active" : ""}`}
          onClick={() => setActiveTab("swaps")}
        >
          🔄 Shift Swap Board ({swaps.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "overtime" ? "active" : ""}`}
          onClick={() => setActiveTab("overtime")}
        >
          ⏱️ Overtime Tracker & Logs ({overtimes.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "templates" ? "active" : ""}`}
          onClick={() => setActiveTab("templates")}
        >
          ⚙️ Shift Templates ({templates.length})
        </button>
      </div>

      {/* TAB 1: ROSTER & SCHEDULE GRID */}
      {activeTab === "roster" && (
        <div className="tab-section" id="roster-grid-section">
          {/* Controls Bar */}
          <div className="roster-controls-bar">
            <div className="controls-left">
              <div className="scope-toggle">
                <button
                  className={`toggle-btn ${viewScope === "team" ? "active" : ""}`}
                  onClick={() => setViewScope("team")}
                >
                  👥 Team Roster
                </button>
                <button
                  className={`toggle-btn ${viewScope === "my" ? "active" : ""}`}
                  onClick={() => setViewScope("my")}
                >
                  👤 My Shifts Only
                </button>
              </div>

              <select
                className="filter-select"
                value={selectedShiftFilter}
                onChange={(e) => setSelectedShiftFilter(e.target.value)}
              >
                <option value="ALL">All Shift Types</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="controls-right">
              <input
                type="text"
                className="search-input"
                placeholder="Search employee, shift, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Roster Cards / Table */}
          {loading ? (
            <div className="loading-state">Loading schedule assignments...</div>
          ) : filteredRoster.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📅</span>
              <h3>No shift assignments match your criteria</h3>
              <p>Try clearing filters or provision new assignments with "+ Bulk Assign Shifts".</p>
            </div>
          ) : (
            <div className="roster-grid">
              {filteredRoster.map((item) => (
                <div key={item.id} className="roster-card" id={`roster-item-${item.id}`}>
                  <div className="roster-card-header">
                    <div className="emp-info">
                      <span className="emp-avatar">
                        {item.employee_name ? item.employee_name.charAt(0) : "U"}
                      </span>
                      <div>
                        <h4 className="emp-name">{item.employee_name || "Employee"}</h4>
                        <span className="emp-role">{item.employee_role || "Staff"}</span>
                      </div>
                    </div>
                    <span
                      className="shift-badge"
                      style={{
                        borderColor: item.shift_color || "#00ffcc",
                        color: item.shift_color || "#00ffcc",
                      }}
                    >
                      {item.shift_name}
                    </span>
                  </div>

                  <div className="roster-card-body">
                    <div className="meta-row">
                      <span className="meta-label">Date:</span>
                      <span className="meta-val highlight">{item.date}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Timing:</span>
                      <span className="meta-val">
                        {item.shift_start_time?.slice(0, 5)} - {item.shift_end_time?.slice(0, 5)}
                        {item.shift_is_night && (
                          <span className="night-tag"> 🌙 Graveyard</span>
                        )}
                      </span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Status:</span>
                      <span className={`status-pill status-${item.status?.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </div>
                    {item.notes && <p className="roster-notes">"{item.notes}"</p>}
                  </div>

                  <div className="roster-card-footer">
                    <button
                      className="btn-card-action"
                      onClick={() => {
                        setSwapForm((prev) => ({
                          ...prev,
                          requester_assignment_id: item.id,
                        }));
                        setShowSwapModal(true);
                      }}
                    >
                      🔄 Propose Trade
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SHIFT SWAP BOARD */}
      {activeTab === "swaps" && (
        <div className="tab-section" id="swap-board-section">
          <div className="section-toolbar">
            <p className="toolbar-info">
              Peer-to-peer schedule trade negotiations. Both peer acceptance and manager confirmation are required.
            </p>
            <button
              className="action-btn btn-amber"
              onClick={() => setShowSwapModal(true)}
            >
              + Create New Trade Request
            </button>
          </div>

          {swaps.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🔄</span>
              <h3>No Shift Swap Requests Found</h3>
              <p>Employees can request shift trades with colleagues or post open swap offers.</p>
            </div>
          ) : (
            <div className="swaps-table-wrapper">
              <table className="shifts-table">
                <thead>
                  <tr>
                    <th>Requester</th>
                    <th>Their Shift</th>
                    <th>Target Colleague</th>
                    <th>Target Shift</th>
                    <th>Reason / Notes</th>
                    <th>Peer Status</th>
                    <th>Manager Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {swaps.map((s) => {
                    const isTargetPeer = s.target_employee === user?.id;
                    const canPeerRespond =
                      (isTargetPeer || !s.target_employee) &&
                      s.target_status === "PENDING" &&
                      s.requester !== user?.id;
                    const canManagerReview =
                      isManagement &&
                      s.manager_status === "PENDING" &&
                      (s.target_status === "ACCEPTED" || !s.target_employee);

                    return (
                      <tr key={s.id} id={`swap-row-${s.id}`}>
                        <td>
                          <strong>{s.requester_name}</strong>
                          <span className="sub-text">{s.requester_email}</span>
                        </td>
                        <td>
                          <span className="text-cyan">{s.requester_shift_name}</span>
                          <span className="sub-text">
                            {s.requester_assignment_date} ({s.requester_shift_timing})
                          </span>
                        </td>
                        <td>
                          <strong>{s.target_name}</strong>
                          {s.target_email && <span className="sub-text">{s.target_email}</span>}
                        </td>
                        <td>
                          {s.target_shift_name ? (
                            <>
                              <span className="text-amber">{s.target_shift_name}</span>
                              <span className="sub-text">
                                {s.target_assignment_date} ({s.target_shift_timing})
                              </span>
                            </>
                          ) : (
                            <span className="text-muted">Open Trade</span>
                          )}
                        </td>
                        <td className="reason-cell">
                          <span>{s.reason}</span>
                        </td>
                        <td>
                          <span className={`status-pill status-${s.target_status?.toLowerCase()}`}>
                            {s.target_status}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill status-${s.manager_status?.toLowerCase()}`}>
                            {s.manager_status}
                          </span>
                        </td>
                        <td className="actions-cell">
                          {canPeerRespond && (
                            <div className="quick-action-group">
                              <button
                                className="btn-table-action btn-accept"
                                onClick={() => handlePeerRespond(s.id, "ACCEPTED")}
                              >
                                Accept
                              </button>
                              <button
                                className="btn-table-action btn-decline"
                                onClick={() => handlePeerRespond(s.id, "DECLINED")}
                              >
                                Decline
                              </button>
                            </div>
                          )}

                          {canManagerReview && (
                            <button
                              className="btn-table-action btn-review"
                              onClick={() => setReviewSwapModal(s)}
                            >
                              Manager Review
                            </button>
                          )}

                          {!canPeerRespond && !canManagerReview && (
                            <span className="sub-text">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OVERTIME TRACKER */}
      {activeTab === "overtime" && (
        <div className="tab-section" id="overtime-section">
          <div className="section-toolbar">
            <p className="toolbar-info">
              Overtime hours claimed across operational sprints. Multipliers: 1.5x regular, 2.0x weekend/holiday.
            </p>
            <button
              className="action-btn btn-purple"
              onClick={() => setShowOvertimeModal(true)}
            >
              + Log Overtime Claim
            </button>
          </div>

          {overtimes.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">⏱️</span>
              <h3>No Overtime Records Found</h3>
              <p>Employees can submit extra hours worked with project charge codes.</p>
            </div>
          ) : (
            <div className="ot-table-wrapper">
              <table className="shifts-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date & Timing</th>
                    <th>Hours</th>
                    <th>Rate Factor</th>
                    <th>Project Code</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Supervisor Sign-off</th>
                  </tr>
                </thead>
                <tbody>
                  {overtimes.map((ot) => (
                    <tr key={ot.id} id={`ot-row-${ot.id}`}>
                      <td>
                        <strong>{ot.employee_name}</strong>
                        <span className="sub-text">{ot.employee_email}</span>
                      </td>
                      <td>
                        <strong>{ot.date}</strong>
                        <span className="sub-text">
                          {ot.start_time?.slice(0, 5)} - {ot.end_time?.slice(0, 5)}
                        </span>
                      </td>
                      <td>
                        <span className="text-cyan font-bold">{ot.hours} hrs</span>
                      </td>
                      <td>
                        <span className="multiplier-pill">{ot.rate_multiplier}x</span>
                      </td>
                      <td>
                        <span className="project-tag">{ot.project_code || "GEN-OPS"}</span>
                      </td>
                      <td className="reason-cell">
                        <span>{ot.reason}</span>
                      </td>
                      <td>
                        <span className={`status-pill status-${ot.status?.toLowerCase()}`}>
                          {ot.status}
                        </span>
                      </td>
                      <td className="actions-cell">
                        {isManagement && ot.status === "PENDING" ? (
                          <button
                            className="btn-table-action btn-review"
                            onClick={() => setReviewOtModal(ot)}
                          >
                            Review & Authorize
                          </button>
                        ) : ot.approver_name ? (
                          <span className="sub-text">
                            Signed: <strong>{ot.approver_name}</strong>
                          </span>
                        ) : (
                          <span className="sub-text">Awaiting Review</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SHIFT TEMPLATES */}
      {activeTab === "templates" && (
        <div className="tab-section" id="templates-section">
          <div className="section-toolbar">
            <p className="toolbar-info">
              Standard shift configuration policies including grace arrival windows and night-shift premiums.
            </p>
            {isManagement && (
              <button
                className="action-btn btn-primary-cyan"
                onClick={() => setShowTemplateModal(true)}
              >
                + Create New Shift Template
              </button>
            )}
          </div>

          <div className="templates-grid">
            {templates.map((t) => (
              <div
                key={t.id}
                className="template-card"
                style={{ borderTopColor: t.color_code || "#00ffcc" }}
              >
                <div className="template-card-header">
                  <span className="template-code">{t.code}</span>
                  {t.is_night_shift && <span className="night-tag">🌙 Night Shift</span>}
                </div>
                <h3 className="template-name">{t.name}</h3>
                <div className="timing-strip">
                  <span className="timing-clock">🕒</span>
                  <span className="timing-text">{t.formatted_timing}</span>
                </div>
                <div className="template-params">
                  <div className="param-item">
                    <span className="param-label">Grace Period:</span>
                    <span className="param-val">{t.grace_period_minutes} mins</span>
                  </div>
                  <div className="param-item">
                    <span className="param-label">Break Duration:</span>
                    <span className="param-val">{t.break_duration_minutes} mins</span>
                  </div>
                </div>
                {t.description && <p className="template-desc">{t.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: BULK ASSIGN SHIFTS */}
      {showBulkAssignModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>📅 Bulk Assign Shift Roster</h3>
              <button className="close-btn" onClick={() => setShowBulkAssignModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleBulkAssignSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Select Shift Template *</label>
                  <select
                    className="form-input"
                    value={bulkForm.shift_id}
                    onChange={(e) => setBulkForm({ ...bulkForm, shift_id: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Shift --</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.formatted_timing})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={bulkForm.start_date}
                      onChange={(e) => setBulkForm({ ...bulkForm, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={bulkForm.end_date}
                      onChange={(e) => setBulkForm({ ...bulkForm, end_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Select Team Members * (Hold Ctrl/Cmd for multiple)</label>
                  <select
                    multiple
                    className="form-input multiselect"
                    value={bulkForm.employee_ids.map(String)}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (opt) =>
                        Number(opt.value)
                      );
                      setBulkForm({ ...bulkForm, employee_ids: selected });
                    }}
                    style={{ minHeight: "130px" }}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.user}>
                        {emp.full_name || `${emp.user_email}`} ({emp.designation || "Staff"})
                      </option>
                    ))}
                  </select>
                  <span className="help-text">
                    {bulkForm.employee_ids.length} employee(s) selected
                  </span>
                </div>

                <div className="form-group">
                  <label>Assignment Notes / Project Context</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="e.g. Critical release cycle night deployment roster"
                    value={bulkForm.notes}
                    onChange={(e) => setBulkForm({ ...bulkForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowBulkAssignModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-cyan">
                  Provision Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SHIFT SWAP REQUEST */}
      {showSwapModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>🔄 Request Shift Swap / Trade</h3>
              <button className="close-btn" onClick={() => setShowSwapModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSwapSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Select Your Rostered Shift to Exchange *</label>
                  <select
                    className="form-input"
                    value={swapForm.requester_assignment_id}
                    onChange={(e) =>
                      setSwapForm({ ...swapForm, requester_assignment_id: e.target.value })
                    }
                    required
                  >
                    <option value="">-- Choose Your Shift --</option>
                    {roster
                      .filter((r) => !user || r.employee === user.id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.date} — {r.shift_name} ({r.shift_start_time?.slice(0, 5)} -{" "}
                          {r.shift_end_time?.slice(0, 5)})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={swapForm.isOpenPool}
                      onChange={(e) =>
                        setSwapForm({ ...swapForm, isOpenPool: e.target.checked })
                      }
                    />
                    <span>Post as Open Swap (Any peer in team can claim)</span>
                  </label>
                </div>

                {!swapForm.isOpenPool && (
                  <div className="form-group">
                    <label>Target Colleague's Shift to Swap With (Optional)</label>
                    <select
                      className="form-input"
                      value={swapForm.target_assignment_id}
                      onChange={(e) => {
                        const targetAssign = roster.find(
                          (r) => String(r.id) === e.target.value
                        );
                        setSwapForm({
                          ...swapForm,
                          target_assignment_id: e.target.value,
                          target_employee_id: targetAssign?.employee || "",
                        });
                      }}
                    >
                      <option value="">-- Select Colleague Shift --</option>
                      {roster
                        .filter((r) => r.employee !== user?.id)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.employee_name} ({r.date}: {r.shift_name})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Justification / Reason for Trade *</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Provide operational reason (e.g. Doctor appointment, family emergency, travel)..."
                    value={swapForm.reason}
                    onChange={(e) => setSwapForm({ ...swapForm, reason: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowSwapModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-amber">
                  Submit Swap Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LOG OVERTIME */}
      {showOvertimeModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>⏱️ Log Overtime Claim</h3>
              <button className="close-btn" onClick={() => setShowOvertimeModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleOtSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Overtime *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={otForm.date}
                      onChange={(e) => setOtForm({ ...otForm, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Project Code (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. PRJ-VOLKS-01"
                      value={otForm.project_code}
                      onChange={(e) => setOtForm({ ...otForm, project_code: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input
                      type="time"
                      className="form-input"
                      value={otForm.start_time}
                      onChange={(e) => setOtForm({ ...otForm, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time *</label>
                    <input
                      type="time"
                      className="form-input"
                      value={otForm.end_time}
                      onChange={(e) => setOtForm({ ...otForm, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Total Duration (Hours) *</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.5"
                      max="12"
                      className="form-input"
                      value={otForm.hours}
                      onChange={(e) => setOtForm({ ...otForm, hours: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Rate Multiplier *</label>
                    <select
                      className="form-input"
                      value={otForm.rate_multiplier}
                      onChange={(e) =>
                        setOtForm({ ...otForm, rate_multiplier: e.target.value })
                      }
                    >
                      <option value="1.50">1.5x (Standard Weekday OT)</option>
                      <option value="2.00">2.0x (Weekend / Public Holiday)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Operational Task & Reason *</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Describe tasks performed during overtime window..."
                    value={otForm.reason}
                    onChange={(e) => setOtForm({ ...otForm, reason: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowOvertimeModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-purple">
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE TEMPLATE */}
      {showTemplateModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>⚙️ Register New Shift Template</h3>
              <button className="close-btn" onClick={() => setShowTemplateModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateTemplate}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Shift Code * (Unique)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. SHIFT_ROT_D"
                      value={templateForm.code}
                      onChange={(e) =>
                        setTemplateForm({ ...templateForm, code: e.target.value.toUpperCase() })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Shift Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Rotational Day (D)"
                      value={templateForm.name}
                      onChange={(e) =>
                        setTemplateForm({ ...templateForm, name: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input
                      type="time"
                      className="form-input"
                      value={templateForm.start_time}
                      onChange={(e) =>
                        setTemplateForm({ ...templateForm, start_time: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time *</label>
                    <input
                      type="time"
                      className="form-input"
                      value={templateForm.end_time}
                      onChange={(e) =>
                        setTemplateForm({ ...templateForm, end_time: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Grace Period (Mins)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={templateForm.grace_period_minutes}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          grace_period_minutes: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Break Duration (Mins)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={templateForm.break_duration_minutes}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          break_duration_minutes: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Color Accent Code</label>
                    <input
                      type="color"
                      className="form-input color-picker"
                      value={templateForm.color_code}
                      onChange={(e) =>
                        setTemplateForm({ ...templateForm, color_code: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group checkbox-align">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={templateForm.is_night_shift}
                        onChange={(e) =>
                          setTemplateForm({
                            ...templateForm,
                            is_night_shift: e.target.checked,
                          })
                        }
                      />
                      <span>Overnight / Spans Past Midnight</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description / Guidelines</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="Shift operational directives..."
                    value={templateForm.description}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, description: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-cyan">
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: MANAGER REVIEW SWAP */}
      {reviewSwapModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Manager Review: Shift Swap Trade</h3>
              <button className="close-btn" onClick={() => setReviewSwapModal(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>Requester:</strong> {reviewSwapModal.requester_name} (
                {reviewSwapModal.requester_shift_name} on {reviewSwapModal.requester_assignment_date})
              </p>
              <p>
                <strong>Target Colleague:</strong> {reviewSwapModal.target_name} (
                {reviewSwapModal.target_shift_name || "Open Pool"})
              </p>
              <p>
                <strong>Justification:</strong> "{reviewSwapModal.reason}"
              </p>
              <div className="form-group">
                <label>Manager Operational Notes</label>
                <textarea
                  id="manager-swap-notes"
                  className="form-input"
                  rows="2"
                  placeholder="e.g. Schedule trade confirmed; coverage maintained."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  const notes = document.getElementById("manager-swap-notes")?.value || "";
                  handleManagerReviewSwap(reviewSwapModal.id, "REJECTED", notes);
                }}
              >
                Reject Trade
              </button>
              <button
                className="btn-primary-cyan"
                onClick={() => {
                  const notes = document.getElementById("manager-swap-notes")?.value || "";
                  handleManagerReviewSwap(reviewSwapModal.id, "APPROVED", notes);
                }}
              >
                Approve & Swap Schedules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: MANAGER REVIEW OVERTIME */}
      {reviewOtModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Authorize Overtime Claim</h3>
              <button className="close-btn" onClick={() => setReviewOtModal(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>Employee:</strong> {reviewOtModal.employee_name}
              </p>
              <p>
                <strong>Date & Duration:</strong> {reviewOtModal.date} — {reviewOtModal.hours} hrs @{" "}
                {reviewOtModal.rate_multiplier}x
              </p>
              <p>
                <strong>Reason:</strong> "{reviewOtModal.reason}"
              </p>
              <div className="form-group">
                <label>Supervisor Approval Comments</label>
                <textarea
                  id="manager-ot-notes"
                  className="form-input"
                  rows="2"
                  placeholder="e.g. Verified against production deploy logs."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  const notes = document.getElementById("manager-ot-notes")?.value || "";
                  handleReviewOt(reviewOtModal.id, "REJECTED", notes);
                }}
              >
                Reject
              </button>
              <button
                className="btn-primary-cyan"
                onClick={() => {
                  const notes = document.getElementById("manager-ot-notes")?.value || "";
                  handleReviewOt(reviewOtModal.id, "APPROVED", notes);
                }}
              >
                Approve for Payroll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shifts;
