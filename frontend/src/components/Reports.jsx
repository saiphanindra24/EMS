import { useEffect, useState } from "react";
import "./Reports.css";
import { reportService } from "../services/reportService";
import { employeeService } from "../services/employeeService";
import { useAuth } from "../context/AuthContext";

const REPORT_TABS = [
  { id: "productivity", name: "Productivity Index", icon: "⚡" },
  { id: "employees",    name: "Employee Roster",   icon: "👥" },
  { id: "attendance",   name: "Attendance & Hours",icon: "🕒" },
  { id: "tasks",        name: "Task Delivery",     icon: "📋" },
  { id: "leaves",       name: "Leave Records",     icon: "🏖️" },
  { id: "departments",  name: "Department Stats",  icon: "🏢" },
];

const PERIOD_PRESETS = [
  { id: "this_month",   label: "This Month" },
  { id: "today",        label: "Today" },
  { id: "this_week",    label: "This Week" },
  { id: "last_month",   label: "Last Month" },
  { id: "this_quarter", label: "This Quarter" },
  { id: "this_year",    label: "This Year" },
  { id: "custom",       label: "Custom Range" },
];

export default function Reports() {
  const { user } = useAuth();
  const isSuperOrHr = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  // Tab & Filter State
  const [activeTab, setActiveTab] = useState("productivity");
  const [period, setPeriod] = useState("this_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [department, setDepartment] = useState("");
  const [employee, setEmployee] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Options Data
  const [departmentsList, setDepartmentsList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);

  // Report Data & UI State
  const [overviewStats, setOverviewStats] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load Department & Employee filter dropdown options
  useEffect(() => {
    employeeService.getDepartments()
      .then((data) => setDepartmentsList(data.results || data || []))
      .catch(() => {});

    employeeService.getEmployees({ page_size: 100 })
      .then((data) => setEmployeesList(data.results || []))
      .catch(() => {});

    reportService.getOverview()
      .then((data) => setOverviewStats(data.high_level_stats || null))
      .catch(() => {});
  }, []);

  // Fetch Report Data
  const fetchReport = async (newPage = page) => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const params = {
        period,
        page: newPage,
        page_size: pageSize,
      };

      if (period === "custom") {
        if (!startDate || !endDate) {
          setErrorMessage("Please select both start and end dates for custom period.");
          setIsLoading(false);
          return;
        }
        params.start_date = startDate;
        params.end_date = endDate;
      }

      if (department) params.department = department;
      if (employee) params.employee = employee;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter && activeTab === "tasks") params.priority = priorityFilter;

      const data = await reportService.getReport(activeTab, params);
      setReportData(data);
      setPage(newPage);
    } catch (err) {
      setErrorMessage(err.message || "Failed to fetch report.");
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger load when tab changes or page size changes
  useEffect(() => {
    setPage(1);
    fetchReport(1);
  }, [activeTab, pageSize]);

  // Handle Export
  const handleExport = async (format) => {
    if (format === "csv") setIsExportingCsv(true);
    if (format === "xlsx") setIsExportingXlsx(true);
    setErrorMessage("");

    try {
      const params = {
        period,
      };
      if (period === "custom") {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      if (department) params.department = department;
      if (employee) params.employee = employee;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter && activeTab === "tasks") params.priority = priorityFilter;

      await reportService.exportReport(activeTab, format, params);
    } catch (err) {
      setErrorMessage(err.message || `Failed to export ${format.toUpperCase()}.`);
    } finally {
      if (format === "csv") setIsExportingCsv(false);
      if (format === "xlsx") setIsExportingXlsx(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setPeriod("this_month");
    setStartDate("");
    setEndDate("");
    setDepartment("");
    setEmployee("");
    setStatusFilter("");
    setPriorityFilter("");
    setPage(1);
  };

  const currentSummary = reportData?.summary || {};
  const reportingPeriod = reportData?.reporting_period;

  return (
    <div className="reports-container">
      {/* ── Printable Formal Header (visible only on print) ── */}
      <div className="print-only-header">
        <h1>EMWTS Workplace Management — Official Report</h1>
        <p>
          <strong>Report:</strong> {REPORT_TABS.find((t) => t.id === activeTab)?.name} |{" "}
          <strong>Period:</strong> {reportingPeriod?.label || period} |{" "}
          <strong>Generated By:</strong> {user?.email} |{" "}
          <strong>Printed:</strong> {new Date().toLocaleString()}
        </p>
      </div>

      {/* ── Top KPI Bar ── */}
      {overviewStats && (
        <section className="reports-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-header">
              <span>Total Workforce</span>
              <span className="kpi-icon blue">👥</span>
            </div>
            <div className="kpi-value">{overviewStats.total_employees}</div>
            <div className="kpi-subtext">Active employees in system</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-header">
              <span>Attendance (Month)</span>
              <span className="kpi-icon green">🕒</span>
            </div>
            <div className="kpi-value">{overviewStats.attendance_records_this_month}</div>
            <div className="kpi-subtext">Verified punch logs</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-header">
              <span>Active Tasks</span>
              <span className="kpi-icon purple">📋</span>
            </div>
            <div className="kpi-value">{overviewStats.active_tasks}</div>
            <div className="kpi-subtext">In-flight deliveries</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-header">
              <span>Pending Leaves</span>
              <span className="kpi-icon amber">⏳</span>
            </div>
            <div className="kpi-value">{overviewStats.pending_leave_requests}</div>
            <div className="kpi-subtext">Awaiting manager review</div>
          </div>
        </section>
      )}

      {/* ── Report Type Selector Tabs ── */}
      <nav className="report-tabs">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`report-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            id={`report-tab-${tab.id}`}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </nav>

      {/* ── Productivity Methodology Banner (When Productivity is active) ── */}
      {activeTab === "productivity" && (
        <section className="methodology-banner">
          <div className="methodology-header">
            <span>⚡ Multi-Factor Productivity Index</span>
          </div>
          <p className="methodology-text">
            To prevent biased evaluations, this system rejects simplistic task counting. Employee performance is synthesized through a balanced multi-dimensional model:
          </p>
          <div className="formula-pills">
            <span className="formula-pill">Task Delivery (40%)</span>
            <span className="formula-pill">On-Time Punctuality (25%)</span>
            <span className="formula-pill">Attendance Reliability (25%)</span>
            <span className="formula-pill">Estimation Accuracy (10%)</span>
          </div>
        </section>
      )}

      {/* ── Filter Controls Card ── */}
      <section className="filter-card">
        <div className="filter-row">
          {/* Period selector */}
          <div className="filter-group">
            <label htmlFor="filter-period">Reporting Period</label>
            <select
              id="filter-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {PERIOD_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Inputs if custom period */}
          {period === "custom" && (
            <>
              <div className="filter-group">
                <label htmlFor="filter-start-date">Start Date</label>
                <input
                  id="filter-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label htmlFor="filter-end-date">End Date</label>
                <input
                  id="filter-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Department Filter */}
          <div className="filter-group">
            <label htmlFor="filter-dept">Department</label>
            <select
              id="filter-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All Departments</option>
              {departmentsList.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          {/* Employee Filter */}
          {activeTab !== "departments" && (
            <div className="filter-group">
              <label htmlFor="filter-employee">Employee</label>
              <select
                id="filter-employee"
                value={employee}
                onChange={(e) => setEmployee(e.target.value)}
              >
                <option value="">All Employees</option>
                {employeesList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          {activeTab === "attendance" && (
            <div className="filter-group">
              <label htmlFor="filter-att-status">Attendance Status</label>
              <select
                id="filter-att-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ABSENT">Absent</option>
                <option value="ON_LEAVE">On Leave</option>
              </select>
            </div>
          )}

          {activeTab === "tasks" && (
            <>
              <div className="filter-group">
                <label htmlFor="filter-task-status">Task Status</label>
                <select
                  id="filter-task-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="filter-task-priority">Priority</label>
                <select
                  id="filter-task-priority"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="">All Priorities</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </>
          )}

          {activeTab === "leaves" && (
            <div className="filter-group">
              <label htmlFor="filter-leave-status">Leave Status</label>
              <select
                id="filter-leave-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          )}

          {activeTab === "employees" && (
            <div className="filter-group">
              <label htmlFor="filter-emp-status">Employment Status</label>
              <select
                id="filter-emp-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>
          )}

          {/* Filter actions */}
          <div className="filter-actions">
            <button
              className="btn-primary"
              onClick={() => { setPage(1); fetchReport(1); }}
              id="apply-filters-btn"
            >
              ⌕ Filter
            </button>
            <button
              className="btn-secondary"
              onClick={handleResetFilters}
              id="reset-filters-btn"
            >
              Reset
            </button>
          </div>
        </div>

        {/* ── Active Filters Chips ── */}
        <div className="active-filters-bar">
          <span className="filter-chip-label">Active Scope:</span>
          <span className="filter-chip">
            📅 {reportingPeriod?.label || PERIOD_PRESETS.find((p) => p.id === period)?.label}
          </span>
          {department && (
            <span className="filter-chip">
              🏢 Dept: {departmentsList.find((d) => String(d.id) === String(department))?.name || department}
            </span>
          )}
          {employee && (
            <span className="filter-chip">
              👤 Emp: {employeesList.find((e) => String(e.id) === String(employee))?.full_name || employee}
            </span>
          )}
          {statusFilter && (
            <span className="filter-chip">🏷️ Status: {statusFilter}</span>
          )}
          {priorityFilter && (
            <span className="filter-chip">🚩 Priority: {priorityFilter}</span>
          )}
        </div>
      </section>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div className="error-banner">
          <span>⚠️ {errorMessage}</span>
          <button className="btn-secondary" onClick={() => fetchReport(page)}>Retry</button>
        </div>
      )}

      {/* ── Report Header & Export Actions Bar ── */}
      <section className="report-action-bar">
        <div className="report-title-block">
          <h3>
            {REPORT_TABS.find((t) => t.id === activeTab)?.name} Preview
            {isSuperOrHr && activeTab === "employees" && (
              <span className="badge-confidential">HR Authorized (Sensitive Data Unlocked)</span>
            )}
          </h3>
          <p>
            Showing {reportData?.count ?? 0} total records
            {reportingPeriod ? ` for ${reportingPeriod.label}` : ""}
          </p>
        </div>

        <div className="export-btn-group">
          <button
            className="btn-export csv"
            onClick={() => handleExport("csv")}
            disabled={isExportingCsv || isLoading}
            id="export-csv-btn"
          >
            {isExportingCsv ? "Exporting…" : "📥 Export CSV"}
          </button>
          <button
            className="btn-export excel"
            onClick={() => handleExport("xlsx")}
            disabled={isExportingXlsx || isLoading}
            id="export-excel-btn"
          >
            {isExportingXlsx ? "Exporting…" : "📊 Export Excel (.xlsx)"}
          </button>
          <button
            className="btn-export print"
            onClick={() => window.print()}
            id="print-report-btn"
          >
            🖨️ Print Report
          </button>
        </div>
      </section>

      {/* ── Summary Metrics Row ── */}
      {reportData?.summary && (
        <section className="reports-kpi-grid">
          {activeTab === "productivity" && (
            <>
              <div className="kpi-card">
                <div className="kpi-header"><span>Avg Composite Score</span><span className="kpi-icon blue">⚡</span></div>
                <div className="kpi-value">{currentSummary.average_composite_score ?? 0} <span style={{ fontSize: "14px", color: "#64748b" }}>/ 100</span></div>
                <div className="kpi-subtext">Overall team benchmark</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Avg Completion Rate</span><span className="kpi-icon green">✓</span></div>
                <div className="kpi-value">{currentSummary.average_task_completion_rate ?? 0}%</div>
                <div className="kpi-subtext">Delivered on assignments</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Avg On-Time Rate</span><span className="kpi-icon purple">⏰</span></div>
                <div className="kpi-value">{currentSummary.average_on_time_delivery_rate ?? 0}%</div>
                <div className="kpi-subtext">Met deadline targets</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Attendance Reliability</span><span className="kpi-icon amber">🕒</span></div>
                <div className="kpi-value">{currentSummary.average_attendance_reliability ?? 0}%</div>
                <div className="kpi-subtext">Schedule adherence</div>
              </div>
            </>
          )}

          {activeTab === "employees" && (
            <>
              <div className="kpi-card">
                <div className="kpi-header"><span>Total Headcount</span><span className="kpi-icon blue">👥</span></div>
                <div className="kpi-value">{currentSummary.total_records ?? 0}</div>
                <div className="kpi-subtext">In current filtered roster</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Active Status</span><span className="kpi-icon green">✓</span></div>
                <div className="kpi-value">{currentSummary.active_employees ?? 0}</div>
                <div className="kpi-subtext">Currently working</div>
              </div>
            </>
          )}

          {activeTab === "attendance" && (
            <>
              <div className="kpi-card">
                <div className="kpi-header"><span>Total Logs</span><span className="kpi-icon blue">🕒</span></div>
                <div className="kpi-value">{currentSummary.total_records ?? 0}</div>
                <div className="kpi-subtext">Recorded punches</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Present Days</span><span className="kpi-icon green">✓</span></div>
                <div className="kpi-value">{currentSummary.present_count ?? 0}</div>
                <div className="kpi-subtext">Full sessions</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Late Arrivals</span><span className="kpi-icon amber">⏳</span></div>
                <div className="kpi-value">{currentSummary.late_count ?? 0}</div>
                <div className="kpi-subtext">Outside grace window</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Total Work Hours</span><span className="kpi-icon purple">⏱️</span></div>
                <div className="kpi-value">{currentSummary.total_hours_worked ?? 0} hrs</div>
                <div className="kpi-subtext">{currentSummary.average_hours_per_day ?? 0} hrs/day avg</div>
              </div>
            </>
          )}

          {activeTab === "tasks" && (
            <>
              <div className="kpi-card">
                <div className="kpi-header"><span>Total Assigned</span><span className="kpi-icon blue">📋</span></div>
                <div className="kpi-value">{currentSummary.total_tasks ?? 0}</div>
                <div className="kpi-subtext">Work items</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Completed</span><span className="kpi-icon green">✓</span></div>
                <div className="kpi-value">{currentSummary.completed_tasks ?? 0}</div>
                <div className="kpi-subtext">{currentSummary.completion_rate ?? 0}% completed</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>In Progress</span><span className="kpi-icon purple">⚙️</span></div>
                <div className="kpi-value">{currentSummary.in_progress_tasks ?? 0}</div>
                <div className="kpi-subtext">Active workflow</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Overdue</span><span className="kpi-icon amber">⚠️</span></div>
                <div className="kpi-value">{currentSummary.overdue_tasks ?? 0}</div>
                <div className="kpi-subtext">Need intervention</div>
              </div>
            </>
          )}

          {activeTab === "leaves" && (
            <>
              <div className="kpi-card">
                <div className="kpi-header"><span>Total Requests</span><span className="kpi-icon blue">🏖️</span></div>
                <div className="kpi-value">{currentSummary.total_requests ?? 0}</div>
                <div className="kpi-subtext">Submitted filings</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Approved</span><span className="kpi-icon green">✓</span></div>
                <div className="kpi-value">{currentSummary.approved_requests ?? 0}</div>
                <div className="kpi-subtext">{currentSummary.total_approved_days ?? 0} days granted</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Pending</span><span className="kpi-icon amber">⏳</span></div>
                <div className="kpi-value">{currentSummary.pending_requests ?? 0}</div>
                <div className="kpi-subtext">In queue</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Rejected</span><span className="kpi-icon purple">✕</span></div>
                <div className="kpi-value">{currentSummary.rejected_requests ?? 0}</div>
                <div className="kpi-subtext">Declined</div>
              </div>
            </>
          )}

          {activeTab === "departments" && (
            <>
              <div className="kpi-card">
                <div className="kpi-header"><span>Total Depts</span><span className="kpi-icon blue">🏢</span></div>
                <div className="kpi-value">{currentSummary.total_departments ?? 0}</div>
                <div className="kpi-subtext">Operating divisions</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Active Staff</span><span className="kpi-icon green">👥</span></div>
                <div className="kpi-value">{currentSummary.total_headcount ?? 0}</div>
                <div className="kpi-subtext">Across all depts</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-header"><span>Avg Delivery Rate</span><span className="kpi-icon purple">✓</span></div>
                <div className="kpi-value">{currentSummary.average_task_completion_rate ?? 0}%</div>
                <div className="kpi-subtext">Task completion</div>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Preview Table & States ── */}
      <div className="table-panel">
        {isLoading ? (
          <div className="state-container">
            <div className="spinner" />
            <div className="state-title">Generating Report Preview…</div>
            <div className="state-subtext">Aggregating records and compiling authorized metrics.</div>
          </div>
        ) : !reportData || !reportData.results || reportData.results.length === 0 ? (
          <div className="state-container">
            <div className="state-icon">📄</div>
            <div className="state-title">No Records Found</div>
            <div className="state-subtext">No records match the selected reporting period and filter scope. Try broadening your criteria.</div>
            <button className="btn-secondary" onClick={handleResetFilters}>Reset All Filters</button>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              {/* 1. PRODUCTIVITY TABLE */}
              {activeTab === "productivity" && (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Composite Score</th>
                      <th>Performance Tier</th>
                      <th>Task Completion</th>
                      <th>On-Time Rate</th>
                      <th>Attendance Reliability</th>
                      <th>Logged Hours</th>
                      <th>Est / Act Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.results.map((r) => {
                      const tierClass = r.performance_tier?.toLowerCase().replace(/[^a-z]/g, "-") || "satisfactory";
                      return (
                        <tr key={r.employee_id}>
                          <td>
                            <strong>{r.full_name}</strong>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>{r.employee_id} · {r.designation}</div>
                          </td>
                          <td>{r.department}</td>
                          <td>
                            <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                              {r.composite_productivity_score}
                            </strong>
                            <span style={{ fontSize: "11px", color: "#64748b" }}> / 100</span>
                          </td>
                          <td>
                            <span className={`tier-tag ${tierClass}`}>
                              {r.performance_tier}
                            </span>
                          </td>
                          <td>
                            <div className="mini-progress">
                              <div className="mini-track">
                                <div className="mini-fill" style={{ width: `${r.task_completion_rate}%` }} />
                              </div>
                              <span>{r.task_completion_rate}% ({r.completed_tasks}/{r.total_tasks})</span>
                            </div>
                          </td>
                          <td>{r.on_time_delivery_rate}%</td>
                          <td>{r.attendance_reliability}%</td>
                          <td>{r.total_logged_hours} hrs ({r.avg_daily_hours}h/d)</td>
                          <td>
                            {r.estimated_hours}h / {r.actual_hours}h
                            <div style={{ fontSize: "11px", color: r.hours_variance > 0 ? "#dc2626" : "#16a34a" }}>
                              {r.hours_variance > 0 ? `+${r.hours_variance}h over` : `${Math.abs(r.hours_variance)}h under`}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* 2. EMPLOYEE ROSTER TABLE */}
              {activeTab === "employees" && (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Full Name</th>
                      <th>Email &amp; Phone</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Date Joined</th>
                      {isSuperOrHr && <th>Base Salary</th>}
                      {isSuperOrHr && <th>National ID</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.results.map((emp) => (
                      <tr key={emp.employee_id}>
                        <td><code>{emp.employee_id}</code></td>
                        <td><strong>{emp.full_name}</strong></td>
                        <td>
                          <div>{emp.email}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{emp.phone || "-"}</div>
                        </td>
                        <td>{emp.department?.name || "-"}</td>
                        <td>{emp.designation || "-"}</td>
                        <td>{emp.employment_type}</td>
                        <td>
                          <span className={`status-tag ${emp.status.toLowerCase()}`}>
                            {emp.status}
                          </span>
                        </td>
                        <td>{emp.date_joined || "-"}</td>
                        {isSuperOrHr && (
                          <td>
                            {emp.sensitive_data?.base_salary
                              ? `$${Number(emp.sensitive_data.base_salary).toLocaleString()}`
                              : "-"}
                          </td>
                        )}
                        {isSuperOrHr && (
                          <td><code>{emp.sensitive_data?.national_id || "-"}</code></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* 3. ATTENDANCE TABLE */}
              {activeTab === "attendance" && (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Logged Duration</th>
                      <th>Notes / IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.results.map((att) => (
                      <tr key={att.id}>
                        <td><strong>{att.date}</strong></td>
                        <td>
                          <div>{att.employee.full_name}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{att.employee.employee_id}</div>
                        </td>
                        <td>{att.employee.department || "-"}</td>
                        <td>
                          <span className={`status-tag ${att.status.toLowerCase()}`}>
                            {att.status}
                          </span>
                        </td>
                        <td>{att.check_in ? new Date(att.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}</td>
                        <td>{att.check_out ? new Date(att.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}</td>
                        <td><strong>{att.work_duration_hours} hrs</strong></td>
                        <td>
                          <div>{att.notes || "-"}</div>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>{att.ip_address || ""}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* 4. TASK DELIVERY TABLE */}
              {activeTab === "tasks" && (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Task ID</th>
                      <th>Title</th>
                      <th>Assignee</th>
                      <th>Department</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Est / Act Hours</th>
                      <th>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.results.map((tsk) => (
                      <tr key={tsk.task_id}>
                        <td><code>{tsk.task_id}</code></td>
                        <td><strong>{tsk.title}</strong></td>
                        <td>{tsk.assignee ? tsk.assignee.full_name : "Unassigned"}</td>
                        <td>{tsk.department?.name || "-"}</td>
                        <td>
                          <span className={`status-tag ${tsk.priority.toLowerCase()}`}>
                            {tsk.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`status-tag ${tsk.status.toLowerCase()}`}>
                            {tsk.status}
                          </span>
                        </td>
                        <td>
                          <div className="mini-progress">
                            <div className="mini-track">
                              <div className="mini-fill" style={{ width: `${tsk.progress}%` }} />
                            </div>
                            <span>{tsk.progress}%</span>
                          </div>
                        </td>
                        <td>{tsk.estimated_hours}h / {tsk.actual_hours}h</td>
                        <td>
                          <span style={{ color: tsk.is_overdue ? "#dc2626" : "inherit" }}>
                            {tsk.due_date || "-"} {tsk.is_overdue ? "⚠️ Overdue" : ""}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* 5. LEAVE RECORDS TABLE */}
              {activeTab === "leaves" && (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Req ID</th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Leave Type</th>
                      <th>Date Range</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Reason</th>
                      <th>Reviewed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.results.map((lv) => (
                      <tr key={lv.id}>
                        <td><code>#{lv.id}</code></td>
                        <td>
                          <strong>{lv.employee.full_name}</strong>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{lv.employee.employee_id}</div>
                        </td>
                        <td>{lv.employee.department || "-"}</td>
                        <td>{lv.leave_type.name}</td>
                        <td>{lv.start_date} → {lv.end_date}</td>
                        <td><strong>{lv.duration_days} days</strong></td>
                        <td>
                          <span className={`status-tag ${lv.status.toLowerCase()}`}>
                            {lv.status}
                          </span>
                        </td>
                        <td>{lv.reason}</td>
                        <td>{lv.reviewed_by || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* 6. DEPARTMENT STATS TABLE */}
              {activeTab === "departments" && (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Department Name</th>
                      <th>Department Head</th>
                      <th>Active Headcount</th>
                      <th>Total Tasks</th>
                      <th>Completed Tasks</th>
                      <th>Task Completion Rate</th>
                      <th>Logged Hours</th>
                      <th>Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.results.map((d) => (
                      <tr key={d.code}>
                        <td><code>{d.code}</code></td>
                        <td><strong>{d.name}</strong></td>
                        <td>{d.head}</td>
                        <td><strong>{d.active_employees}</strong></td>
                        <td>{d.total_tasks}</td>
                        <td>{d.completed_tasks}</td>
                        <td>
                          <div className="mini-progress">
                            <div className="mini-track">
                              <div className="mini-fill" style={{ width: `${d.task_completion_rate}%` }} />
                            </div>
                            <span>{d.task_completion_rate}%</span>
                          </div>
                        </td>
                        <td>{d.logged_work_hours} hrs</td>
                        <td>{d.attendance_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Pagination Controls ── */}
            <div className="pagination-bar">
              <div>
                Page <strong>{reportData.current_page}</strong> of <strong>{reportData.total_pages || 1}</strong>{" "}
                ({reportData.count} total records)
              </div>
              <div className="pagination-controls">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value={10}>10 per page</option>
                  <option value={15}>15 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
                <button
                  className="btn-page"
                  disabled={reportData.current_page <= 1}
                  onClick={() => fetchReport(page - 1)}
                  id="page-prev-btn"
                >
                  ← Previous
                </button>
                <button
                  className="btn-page"
                  disabled={reportData.current_page >= reportData.total_pages}
                  onClick={() => fetchReport(page + 1)}
                  id="page-next-btn"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
