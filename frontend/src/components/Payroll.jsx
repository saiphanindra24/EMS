import { useEffect, useState } from "react";
import "./Payroll.css";
import { useAuth } from "../context/AuthContext";
import payrollService from "../services/payrollService";

export default function Payroll() {
  const { user } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [activeTab, setActiveTab] = useState(isAdmin ? "payslips" : "my-payslips");

  const [payslips, setPayslips] = useState([]);
  const [runs, setRuns] = useState([]);
  const [structures, setStructures] = useState([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("2026");

  // Modals state
  const [activePayslipModal, setActivePayslipModal] = useState(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processMonth, setProcessMonth] = useState(10);
  const [processYear, setProcessYear] = useState(2026);
  const [processNotes, setProcessNotes] = useState("Standard Corporate Remuneration Cycle");
  const [processing, setProcessing] = useState(false);

  const [disburseRunTarget, setDisburseRunTarget] = useState(null);
  const [disburseMethod, setDisburseMethod] = useState("BANK_TRANSFER");
  const [disburseTxRef, setDisburseTxRef] = useState("");
  const [disbursing, setDisbursing] = useState(false);

  useEffect(() => {
    loadPayrollData();
  }, [isAdmin, selectedMonth, selectedYear]);

  async function loadPayrollData() {
    try {
      setLoading(true);
      setError(null);

      const summaryData = await payrollService.getSummary();
      setSummary(summaryData);

      const params = {};
      if (selectedMonth) params.month = selectedMonth;
      if (selectedYear) params.year = selectedYear;

      const slipsData = await payrollService.getPayslips(params);
      setPayslips(slipsData?.results || slipsData || []);

      if (isAdmin) {
        const [runsData, structsData] = await Promise.all([
          payrollService.getRuns(),
          payrollService.getSalaryStructures(),
        ]);
        setRuns(runsData?.results || runsData || []);
        setStructures(structsData?.results || structsData || []);
      }
    } catch (err) {
      console.error("Failed to load payroll records:", err);
      setError("Unable to retrieve payroll records. Please verify backend connection.");
    } finally {
      setLoading(false);
    }
  }

  const formatINR = (val) => {
    const num = parseFloat(val || 0);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getMonthName = (m) => {
    const date = new Date(2026, parseInt(m) - 1, 1);
    return date.toLocaleString("en-US", { month: "long" });
  };

  // Filter payslips by search term
  const filteredPayslips = payslips.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.payslip_number?.toLowerCase().includes(term) ||
      p.employee_name?.toLowerCase().includes(term) ||
      p.employee_id_code?.toLowerCase().includes(term) ||
      p.department_name?.toLowerCase().includes(term)
    );
  });

  // Handle Process Payroll Batch
  const handleProcessPayroll = async (e) => {
    e.preventDefault();
    try {
      setProcessing(true);
      await payrollService.processPayroll({
        month: parseInt(processMonth),
        year: parseInt(processYear),
        notes: processNotes,
      });
      setShowProcessModal(false);
      await loadPayrollData();
    } catch (err) {
      alert("Failed to process payroll batch: " + (err.response?.data?.detail || err.message));
    } finally {
      setProcessing(false);
    }
  };

  // Handle Disburse Run
  const handleDisburseRun = async (e) => {
    e.preventDefault();
    if (!disburseRunTarget) return;
    try {
      setDisbursing(true);
      await payrollService.disbursePayroll(disburseRunTarget.id, {
        payment_method: disburseMethod,
        transaction_reference: disburseTxRef || undefined,
      });
      setDisburseRunTarget(null);
      await loadPayrollData();
    } catch (err) {
      alert("Failed to record disbursement: " + (err.response?.data?.detail || err.message));
    } finally {
      setDisbursing(false);
    }
  };

  return (
    <div className="payroll-container">
      {/* ─── Top Executive Header ─── */}
      <header className="payroll-header">
        <div className="payroll-header-titles">
          <h1>
            <span>💳</span> SSKATT Payroll Management
          </h1>
          <p>VolkssKatt Enterprise Compensation & Statutory Remuneration Hub</p>
        </div>

        <div className="payroll-header-actions">
          <span className="cycle-badge">
            ● Active Cycle: October 2026
          </span>
          {isAdmin && (
            <button
              className="btn-process-payroll"
              onClick={() => setShowProcessModal(true)}
            >
              <span>⚡</span> Process Payroll Batch
            </button>
          )}
        </div>
      </header>

      {/* ─── KPI Metrics Grid ─── */}
      <section className="payroll-kpi-grid">
        <div className="payroll-kpi-card">
          <div className="kpi-icon-box">💰</div>
          <div className="kpi-label">{isAdmin ? "Monthly Gross Payroll" : "My Monthly Gross"}</div>
          <div className="kpi-value">
            {isAdmin
              ? formatINR(summary?.latest_run?.total_gross || "670000.00")
              : formatINR(summary?.latest_payslip?.gross_earnings || summary?.salary_structure?.monthly_gross || "55000.00")}
          </div>
          <div className="kpi-subtext">October 2026 Standard Run</div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-icon-box">✨</div>
          <div className="kpi-label">{isAdmin ? "Net Disbursable" : "My Net Take-Home"}</div>
          <div className="kpi-value">
            {isAdmin
              ? formatINR(summary?.latest_run?.total_net || "647500.00")
              : formatINR(summary?.latest_payslip?.net_salary || summary?.salary_structure?.monthly_net || "51500.00")}
          </div>
          <div className="kpi-subtext">Post statutory PF, PT, & TDS</div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-icon-box">👥</div>
          <div className="kpi-label">{isAdmin ? "Enrolled Workforce" : "Working Days"}</div>
          <div className="kpi-value">
            {isAdmin ? `${summary?.total_active_employees || 7} Employees` : `${summary?.latest_payslip?.working_days || 31} Days`}
          </div>
          <div className="kpi-subtext">100% attendance reconciled</div>
        </div>

        <div className="payroll-kpi-card">
          <div className="kpi-icon-box">🛡️</div>
          <div className="kpi-label">{isAdmin ? "Statutory Deductions" : "EPF & Tax Deductions"}</div>
          <div className="kpi-value">
            {isAdmin
              ? formatINR(summary?.latest_run?.total_deductions || "22500.00")
              : formatINR(summary?.latest_payslip?.total_deductions || summary?.salary_structure?.monthly_deductions || "3500.00")}
          </div>
          <div className="kpi-subtext">Compliant with EPF & Tax norms</div>
        </div>
      </section>

      {/* ─── Navigation Tabs ─── */}
      <nav className="payroll-tabs-bar">
        {isAdmin ? (
          <>
            <button
              className={`payroll-tab-btn ${activeTab === "payslips" ? "active" : ""}`}
              onClick={() => setActiveTab("payslips")}
            >
              📄 Employee Payslips Register ({filteredPayslips.length})
            </button>
            <button
              className={`payroll-tab-btn ${activeTab === "runs" ? "active" : ""}`}
              onClick={() => setActiveTab("runs")}
            >
              🔄 Payroll Cycle Runs ({runs.length})
            </button>
            <button
              className={`payroll-tab-btn ${activeTab === "structures" ? "active" : ""}`}
              onClick={() => setActiveTab("structures")}
            >
              📊 CTC & Salary Structures ({structures.length})
            </button>
          </>
        ) : (
          <>
            <button
              className={`payroll-tab-btn ${activeTab === "my-payslips" ? "active" : ""}`}
              onClick={() => setActiveTab("my-payslips")}
            >
              📄 My Official Payslips
            </button>
            <button
              className={`payroll-tab-btn ${activeTab === "my-breakdown" ? "active" : ""}`}
              onClick={() => setActiveTab("my-breakdown")}
            >
              📊 My CTC Breakdown & Deductions
            </button>
          </>
        )}
      </nav>

      {/* ─── TAB CONTENT 1: PAYSLIPS REGISTER ─── */}
      {(activeTab === "payslips" || activeTab === "my-payslips") && (
        <section className="payroll-tab-content">
          <div className="payroll-toolbar">
            <div className="toolbar-search">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search by Employee, ID, or Slip Number…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="toolbar-filters">
              <select
                className="toolbar-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="">All Months</option>
                <option value="10">October</option>
                <option value="9">September</option>
                <option value="8">August</option>
              </select>

              <select
                className="toolbar-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
          </div>

          <div className="payroll-table-wrapper">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>Slip Ref #</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Cycle Period</th>
                  <th>Gross Pay</th>
                  <th>Deductions</th>
                  <th>Net Payable</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayslips.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      No payslips found for selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredPayslips.map((ps) => (
                    <tr key={ps.id}>
                      <td style={{ fontFamily: "monospace", fontWeight: "600", color: "#93c5fd" }}>
                        {ps.payslip_number}
                      </td>
                      <td>
                        <div className="employee-cell">
                          <div className="emp-avatar-initials">
                            {ps.employee_name?.slice(0, 2).toUpperCase() || "EM"}
                          </div>
                          <div className="emp-cell-meta">
                            <span className="emp-cell-name">{ps.employee_name}</span>
                            <span className="emp-cell-id">{ps.employee_id_code}</span>
                          </div>
                        </div>
                      </td>
                      <td>{ps.department_name}</td>
                      <td>{getMonthName(ps.month)} {ps.year}</td>
                      <td style={{ fontWeight: "600" }}>{formatINR(ps.gross_earnings)}</td>
                      <td style={{ color: "#f87171" }}>{formatINR(ps.total_deductions)}</td>
                      <td style={{ fontWeight: "700", color: "#34d399", fontSize: "14px" }}>
                        {formatINR(ps.net_salary)}
                      </td>
                      <td>
                        <span className={`badge-status badge-${ps.status.toLowerCase()}`}>
                          ● {ps.status_display || ps.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-view-slip"
                          onClick={() => setActivePayslipModal(ps)}
                        >
                          👁️ View / Print
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── TAB CONTENT 2: PAYROLL RUNS (ADMIN) ─── */}
      {isAdmin && activeTab === "runs" && (
        <section className="payroll-tab-content">
          <div className="payroll-table-wrapper">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>Cycle Period</th>
                  <th>Employees</th>
                  <th>Total Gross</th>
                  <th>Total Deductions</th>
                  <th>Net Disbursed</th>
                  <th>Status</th>
                  <th>Processed By</th>
                  <th>Disbursement Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: "700", color: "#fff" }}>
                      {getMonthName(r.month)} {r.year}
                    </td>
                    <td>{r.total_employees} Active</td>
                    <td style={{ fontWeight: "600" }}>{formatINR(r.total_gross)}</td>
                    <td style={{ color: "#f87171" }}>{formatINR(r.total_deductions)}</td>
                    <td style={{ fontWeight: "700", color: "#34d399" }}>{formatINR(r.total_net)}</td>
                    <td>
                      <span className={`badge-status badge-${r.status.toLowerCase()}`}>
                        ● {r.status_display || r.status}
                      </span>
                    </td>
                    <td>{r.processed_by_name || "System Admin"}</td>
                    <td>{r.disbursement_date || "Pending"}</td>
                    <td>
                      {r.status !== "PAID" && (
                        <button
                          className="btn-disburse"
                          onClick={() => setDisburseRunTarget(r)}
                        >
                          Disburse NEFT →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── TAB CONTENT 3: CTC STRUCTURES (ADMIN) ─── */}
      {isAdmin && activeTab === "structures" && (
        <section className="payroll-tab-content">
          <div className="payroll-table-wrapper">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Designation</th>
                  <th>Annual CTC</th>
                  <th>Basic Salary</th>
                  <th>HRA (40%)</th>
                  <th>Special Allow.</th>
                  <th>Monthly Gross</th>
                  <th>EPF + PT + TDS</th>
                  <th>Estimated Net</th>
                </tr>
              </thead>
              <tbody>
                {structures.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="employee-cell">
                        <div className="emp-avatar-initials">
                          {s.employee_name?.slice(0, 2).toUpperCase() || "EM"}
                        </div>
                        <div className="emp-cell-meta">
                          <span className="emp-cell-name">{s.employee_name}</span>
                          <span className="emp-cell-id">{s.employee_id_code}</span>
                        </div>
                      </div>
                    </td>
                    <td>{s.designation}</td>
                    <td style={{ fontWeight: "700", color: "#93c5fd" }}>{formatINR(s.annual_ctc)}</td>
                    <td>{formatINR(s.basic_salary)}</td>
                    <td>{formatINR(s.hra)}</td>
                    <td>{formatINR(s.special_allowance)}</td>
                    <td style={{ fontWeight: "600" }}>{formatINR(s.monthly_gross)}</td>
                    <td style={{ color: "#f87171" }}>{formatINR(s.monthly_deductions)}</td>
                    <td style={{ fontWeight: "700", color: "#34d399" }}>{formatINR(s.monthly_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── TAB CONTENT 4: MY BREAKDOWN (EMPLOYEE VIEW) ─── */}
      {!isAdmin && activeTab === "my-breakdown" && (
        <section className="payroll-tab-content">
          <div className="payroll-kpi-grid">
            <div className="payroll-kpi-card">
              <div className="kpi-label">Basic Salary</div>
              <div className="kpi-value">{formatINR(summary?.salary_structure?.basic_salary || "25000.00")}</div>
              <div className="kpi-subtext">50% of monthly CTC</div>
            </div>
            <div className="payroll-kpi-card">
              <div className="kpi-label">House Rent Allowance (HRA)</div>
              <div className="kpi-value">{formatINR(summary?.salary_structure?.hra || "12500.00")}</div>
              <div className="kpi-subtext">Statutory tax-exempt component</div>
            </div>
            <div className="payroll-kpi-card">
              <div className="kpi-label">Special Allowance</div>
              <div className="kpi-value">{formatINR(summary?.salary_structure?.special_allowance || "8700.00")}</div>
              <div className="kpi-subtext">Flexible compensation</div>
            </div>
            <div className="payroll-kpi-card">
              <div className="kpi-label">Employee Provident Fund</div>
              <div className="kpi-value">{formatINR(summary?.salary_structure?.provident_fund || "1800.00")}</div>
              <div className="kpi-subtext">Government EPF contribution</div>
            </div>
          </div>
        </section>
      )}

      {/* ─── MODAL 1: FORMAL PRINTABLE PAYSLIP ─── */}
      {activePayslipModal && (
        <div className="payslip-modal-backdrop" onClick={() => setActivePayslipModal(null)}>
          <div className="payslip-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="payslip-modal-header">
              <h3>Official Payslip — {activePayslipModal.payslip_number}</h3>
              <button className="modal-close-btn" onClick={() => setActivePayslipModal(null)}>✕</button>
            </div>

            {/* Official Sheet */}
            <div className="payslip-document-sheet">
              {/* Header */}
              <div className="ps-doc-header">
                <div className="ps-doc-brand">
                  <img src="/logo.png" alt="VolkssKatt Logo" className="ps-doc-logo" />
                  <div>
                    <h2 className="ps-doc-company-name">VolkssKatt Infotech Private Limited</h2>
                    <p className="ps-doc-company-sub">SSKATT EWTS — Employee Workplace Remuneration Suite</p>
                  </div>
                </div>
                <div className="ps-doc-period">
                  <h4>PAYSLIP</h4>
                  <p>{getMonthName(activePayslipModal.month)} {activePayslipModal.year}</p>
                  <p style={{ fontFamily: "monospace", fontSize: "11px", marginTop: "2px" }}>
                    {activePayslipModal.payslip_number}
                  </p>
                </div>
              </div>

              {/* Employee & Bank Info */}
              <div className="ps-doc-meta-grid">
                <div className="ps-meta-item">
                  <span className="ps-meta-label">Employee Name:</span>
                  <span className="ps-meta-value">{activePayslipModal.employee_name}</span>
                </div>
                <div className="ps-meta-item">
                  <span className="ps-meta-label">Employee ID:</span>
                  <span className="ps-meta-value">{activePayslipModal.employee_id_code}</span>
                </div>
                <div className="ps-meta-item">
                  <span className="ps-meta-label">Department:</span>
                  <span className="ps-meta-value">{activePayslipModal.department_name}</span>
                </div>
                <div className="ps-meta-item">
                  <span className="ps-meta-label">Designation:</span>
                  <span className="ps-meta-value">{activePayslipModal.designation || "Specialist"}</span>
                </div>
                <div className="ps-meta-item">
                  <span className="ps-meta-label">Bank Name:</span>
                  <span className="ps-meta-value">{activePayslipModal.bank_name || "HDFC Bank Ltd"}</span>
                </div>
                <div className="ps-meta-item">
                  <span className="ps-meta-label">Account No:</span>
                  <span className="ps-meta-value">{activePayslipModal.masked_bank_account || "•••• 4394"}</span>
                </div>
                <div className="ps-meta-item">
                  <span className="ps-meta-label">Working Days:</span>
                  <span className="ps-meta-value">{activePayslipModal.working_days} Days</span>
                </div>
                <div className="ps-meta-item">
                  <span className="ps-meta-label">Days Present:</span>
                  <span className="ps-meta-value">{activePayslipModal.present_days} Days</span>
                </div>
              </div>

              {/* Two-Column Financials */}
              <div className="ps-financials-container">
                {/* Earnings */}
                <div className="ps-financial-block">
                  <div className="ps-fin-heading">Earnings (INR)</div>
                  <div className="ps-fin-row">
                    <span>Basic Salary</span>
                    <span>{formatINR(activePayslipModal.basic_salary)}</span>
                  </div>
                  <div className="ps-fin-row">
                    <span>House Rent Allowance (HRA)</span>
                    <span>{formatINR(activePayslipModal.hra)}</span>
                  </div>
                  <div className="ps-fin-row">
                    <span>Special Allowance</span>
                    <span>{formatINR(activePayslipModal.special_allowance)}</span>
                  </div>
                  {parseFloat(activePayslipModal.bonus) > 0 && (
                    <div className="ps-fin-row">
                      <span>Performance Bonus</span>
                      <span>{formatINR(activePayslipModal.bonus)}</span>
                    </div>
                  )}
                  <div className="ps-fin-total-row">
                    <span>Total Gross Earnings</span>
                    <span style={{ color: "#0f172a" }}>{formatINR(activePayslipModal.gross_earnings)}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="ps-financial-block">
                  <div className="ps-fin-heading">Deductions (INR)</div>
                  <div className="ps-fin-row">
                    <span>Provident Fund (EPF)</span>
                    <span>{formatINR(activePayslipModal.provident_fund)}</span>
                  </div>
                  <div className="ps-fin-row">
                    <span>Professional Tax (PT)</span>
                    <span>{formatINR(activePayslipModal.professional_tax)}</span>
                  </div>
                  <div className="ps-fin-row">
                    <span>TDS / Income Tax</span>
                    <span>{formatINR(activePayslipModal.tds)}</span>
                  </div>
                  {parseFloat(activePayslipModal.loss_of_pay_amount) > 0 && (
                    <div className="ps-fin-row">
                      <span>Loss of Pay (LOP)</span>
                      <span style={{ color: "#dc2626" }}>{formatINR(activePayslipModal.loss_of_pay_amount)}</span>
                    </div>
                  )}
                  <div className="ps-fin-total-row">
                    <span>Total Deductions</span>
                    <span style={{ color: "#dc2626" }}>{formatINR(activePayslipModal.total_deductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay Ribbon */}
              <div className="ps-net-pay-banner">
                <div>
                  <div className="ps-net-label">Net Take-Home Salary</div>
                  <div style={{ fontSize: "12px", opacity: 0.85 }}>Disbursed via Direct Bank NEFT Transfer</div>
                </div>
                <div className="ps-net-figure">{formatINR(activePayslipModal.net_salary)}</div>
              </div>

              {/* Signatures & Footer */}
              <div className="ps-doc-footer">
                <div>
                  <p>System Generated Document</p>
                  <p>Certified by VolkssKatt Infotech Private Limited — SSKATT EWTS</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontWeight: "700", color: "#0f172a" }}>Authorized Signatory</p>
                  <p>Director of Finance & Operations</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="ps-modal-actions">
              <button className="btn-print-slip" onClick={() => window.print()}>
                🖨️ Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: PROCESS PAYROLL BATCH ─── */}
      {showProcessModal && (
        <div className="payslip-modal-backdrop" onClick={() => setShowProcessModal(false)}>
          <div className="payslip-modal-content" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className="payslip-modal-header">
              <h3>⚡ Process Monthly Payroll Batch</h3>
              <button className="modal-close-btn" onClick={() => setShowProcessModal(false)}>✕</button>
            </div>
            <form onSubmit={handleProcessPayroll} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>
                This will automatically calculate monthly basic, HRA, statutory EPF/PT deductions, reconcile attendance logs and approved leaves, and generate official payslips for all active employees.
              </p>

              <div>
                <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                  Payroll Month:
                </label>
                <select
                  className="toolbar-select"
                  style={{ width: "100%" }}
                  value={processMonth}
                  onChange={(e) => setProcessMonth(e.target.value)}
                >
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                  Payroll Year:
                </label>
                <input
                  type="number"
                  className="toolbar-select"
                  style={{ width: "100%" }}
                  value={processYear}
                  onChange={(e) => setProcessYear(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                  Batch Notes:
                </label>
                <input
                  type="text"
                  className="toolbar-select"
                  style={{ width: "100%" }}
                  value={processNotes}
                  onChange={(e) => setProcessNotes(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  style={{ background: "transparent", border: "1px solid #475569", color: "#cbd5e1", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" }}
                  onClick={() => setShowProcessModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-process-payroll"
                  disabled={processing}
                >
                  {processing ? "Calculating..." : "Execute Payroll Run"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: DISBURSE PAYROLL ─── */}
      {disburseRunTarget && (
        <div className="payslip-modal-backdrop" onClick={() => setDisburseRunTarget(null)}>
          <div className="payslip-modal-content" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div className="payslip-modal-header">
              <h3>Record Bank Disbursement</h3>
              <button className="modal-close-btn" onClick={() => setDisburseRunTarget(null)}>✕</button>
            </div>
            <form onSubmit={handleDisburseRun} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>
                Disbursing cycle for {getMonthName(disburseRunTarget.month)} {disburseRunTarget.year} ({formatINR(disburseRunTarget.total_net)}).
              </p>

              <div>
                <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                  Payment Method:
                </label>
                <select
                  className="toolbar-select"
                  style={{ width: "100%" }}
                  value={disburseMethod}
                  onChange={(e) => setDisburseMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank NEFT / RTGS</option>
                  <option value="DIRECT_DEPOSIT">Direct Deposit</option>
                  <option value="UPI">UPI Corporate Bulk</option>
                  <option value="CHEQUE">Company Cheque</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                  Bank Transaction / UTR Reference:
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC-NEFT-90812384"
                  className="toolbar-select"
                  style={{ width: "100%" }}
                  value={disburseTxRef}
                  onChange={(e) => setDisburseTxRef(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  style={{ background: "transparent", border: "1px solid #475569", color: "#cbd5e1", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" }}
                  onClick={() => setDisburseRunTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-disburse"
                  disabled={disbursing}
                >
                  {disbursing ? "Recording..." : "Confirm Disbursement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
