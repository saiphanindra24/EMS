import { useEffect, useState } from "react";
import "./Attendance.css";
import AttendanceCorrectionModal from "./AttendanceCorrectionModal";
import Pagination from "./common/Pagination";
import { attendanceService } from "../services/attendanceService";
import { employeeService } from "../services/employeeService";
import { useAuth } from "../context/AuthContext";

export default function Attendance() {
  const { roles } = useAuth();
  const isHRorAdmin = Boolean(roles?.is_super_admin || roles?.is_hr_admin);
  const isManager = Boolean(roles?.is_manager);
  const canViewTeam = isHRorAdmin || isManager;

  // Active view tab: 'my' | 'overview'
  const [activeTab, setActiveTab] = useState("my");

  // Clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Today's attendance state for current user
  const [todayRecord, setTodayRecord] = useState(null);
  const [hasProfile, setHasProfile] = useState(true);
  const [punchNote, setPunchNote] = useState("");
  const [punchLoading, setPunchLoading] = useState(false);
  const [punchMessage, setPunchMessage] = useState({ type: "", text: "" });

  // History & Overview tables state
  const [records, setRecords] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [errorRecords, setErrorRecords] = useState("");

  // Filters
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");

  // Statistics for HR/Manager overview
  const [stats, setStats] = useState(null);

  // Departments & Employees lists for dropdowns
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Modal for corrections
  const [correctingRecord, setCorrectingRecord] = useState(null);

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's personal attendance status
  const fetchTodayStatus = async () => {
    try {
      const data = await attendanceService.getTodayAttendance();
      setHasProfile(data.has_profile !== false);
      setTodayRecord(data.record);
    } catch (err) {
      console.error("Failed to load today's attendance:", err);
    }
  };

  // Fetch metadata for overview filters
  useEffect(() => {
    fetchTodayStatus();

    if (canViewTeam) {
      attendanceService.getAttendanceStats().then(setStats).catch(() => {});
      employeeService.getDepartments().then((d) => setDepartments(d.results || d)).catch(() => {});
      employeeService.getEmployees({ page_size: 100 }).then((e) => setEmployees(e.results || e)).catch(() => {});
    }
  }, [canViewTeam]);

  // Fetch attendance records list
  const fetchRecords = async () => {
    setLoadingRecords(true);
    setErrorRecords("");
    try {
      const params = {
        page,
        page_size: pageSize,
        date: filterDate,
        status: filterStatus,
      };

      if (activeTab === "overview") {
        if (filterDept) params.department = filterDept;
        if (filterEmployee) params.employee = filterEmployee;
      }

      const data = await attendanceService.getAttendanceRecords(params);
      setRecords(data.results || data);
      setTotalCount(data.count ?? (data.results || data).length);
    } catch (err) {
      setErrorRecords(err.message || "Failed to load attendance records.");
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [activeTab, page, pageSize, filterDate, filterStatus, filterDept, filterEmployee]);

  // Handle Punch In
  const handleCheckIn = async () => {
    setPunchLoading(true);
    setPunchMessage({ type: "", text: "" });
    try {
      const res = await attendanceService.checkIn(punchNote);
      setPunchMessage({ type: "success", text: res.message });
      setPunchNote("");
      fetchTodayStatus();
      fetchRecords();
      if (canViewTeam) attendanceService.getAttendanceStats().then(setStats).catch(() => {});
    } catch (err) {
      setPunchMessage({ type: "error", text: err.detail || "Check-in failed. Please try again." });
    } finally {
      setPunchLoading(false);
    }
  };

  // Handle Punch Out
  const handleCheckOut = async () => {
    setPunchLoading(true);
    setPunchMessage({ type: "", text: "" });
    try {
      const res = await attendanceService.checkOut(punchNote);
      setPunchMessage({ type: "success", text: res.message });
      setPunchNote("");
      fetchTodayStatus();
      fetchRecords();
      if (canViewTeam) attendanceService.getAttendanceStats().then(setStats).catch(() => {});
    } catch (err) {
      setPunchMessage({ type: "error", text: err.detail || "Check-out failed. Please try again." });
    } finally {
      setPunchLoading(false);
    }
  };

  // Helper format time
  const formatTime = (isoStr) => {
    if (!isoStr) return "--:--";
    return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Punch button state determination
  const canCheckIn = hasProfile && (!todayRecord || (!todayRecord.check_in && !todayRecord.check_out));
  const canCheckOut = hasProfile && todayRecord && todayRecord.check_in && !todayRecord.check_out;
  const sessionCompleted = todayRecord && todayRecord.check_in && todayRecord.check_out;

  return (
    <div className="att-container">
      {/* Top Punch Clock Widget */}
      <div className="att-punch-card">
        <div className="att-punch-left">
          <div className="att-live-time">
            {currentTime.toLocaleTimeString([], { hour12: true })}
          </div>
          <div className="att-live-date">
            {currentTime.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        <div className="att-punch-center">
          <div className="att-metric-box">
            <span className="att-metric-label">Check-in</span>
            <span className="att-metric-val">{formatTime(todayRecord?.check_in)}</span>
          </div>

          <div style={{ height: "30px", width: "1px", background: "rgba(255,255,255,0.1)" }} />

          <div className="att-metric-box">
            <span className="att-metric-label">Check-out</span>
            <span className="att-metric-val">{formatTime(todayRecord?.check_out)}</span>
          </div>

          <div style={{ height: "30px", width: "1px", background: "rgba(255,255,255,0.1)" }} />

          <div className="att-metric-box">
            <span className="att-metric-label">Duration</span>
            <span className="att-metric-val" style={{ color: "#86efac" }}>
              {todayRecord?.work_duration_hours ? `${todayRecord.work_duration_hours} hrs` : "0.00 hrs"}
            </span>
          </div>

          <div style={{ height: "30px", width: "1px", background: "rgba(255,255,255,0.1)" }} />

          <div className="att-metric-box">
            <span className="att-metric-label">Today's Status</span>
            <div>
              {todayRecord ? (
                <span className={`att-badge ${todayRecord.status?.toLowerCase()}`}>
                  {todayRecord.is_active_session && <span className="pulse-dot" />}
                  {todayRecord.status}
                </span>
              ) : (
                <span style={{ color: "var(--text)", fontSize: "13px" }}>Not Checked In</span>
              )}
            </div>
          </div>
        </div>

        <div className="att-punch-right">
          <div className="punch-btn-group">
            <input
              type="text"
              className="punch-note-input"
              placeholder="Optional note (e.g. Remote)"
              value={punchNote}
              onChange={(e) => setPunchNote(e.target.value)}
              disabled={punchLoading || sessionCompleted}
            />

            {canCheckOut ? (
              <button
                className="btn-checkout"
                onClick={handleCheckOut}
                disabled={punchLoading}
              >
                <span>⏹</span> {punchLoading ? "Processing..." : "Check Out"}
              </button>
            ) : (
              <button
                className="btn-checkin"
                onClick={handleCheckIn}
                disabled={!canCheckIn || punchLoading || sessionCompleted}
              >
                <span>▶</span> {punchLoading ? "Processing..." : "Check In"}
              </button>
            )}
          </div>

          {sessionCompleted && (
            <span style={{ fontSize: "12px", color: "#86efac" }}>
              ✓ Shift completed for today ({todayRecord.work_duration_hours} hrs worked)
            </span>
          )}
        </div>
      </div>

      {/* Alert banner for punch actions */}
      {punchMessage.text && (
        <div
          className={punchMessage.type === "error" ? "login-alert" : "sensitive-notice"}
          style={{ margin: 0, justifyContent: "space-between" }}
        >
          <span>{punchMessage.text}</span>
          <button
            className="alert-close"
            onClick={() => setPunchMessage({ type: "", text: "" })}
          >
            ✕
          </button>
        </div>
      )}

      {/* Overview Statistics for HR/Super Admin & Managers */}
      {canViewTeam && stats && (
        <div className="att-stats-row">
          <div className="att-stat-item">
            <span className="att-stat-title">Present Today</span>
            <span className="att-stat-number" style={{ color: "#86efac" }}>
              {stats.present}
            </span>
          </div>
          <div className="att-stat-item">
            <span className="att-stat-title">Late Arrivals</span>
            <span className="att-stat-number" style={{ color: "#fcd34d" }}>
              {stats.late}
            </span>
          </div>
          <div className="att-stat-item">
            <span className="att-stat-title">Half Day</span>
            <span className="att-stat-number" style={{ color: "#a5b4fc" }}>
              {stats.half_day}
            </span>
          </div>
          <div className="att-stat-item">
            <span className="att-stat-title">On Leave</span>
            <span className="att-stat-number" style={{ color: "#d8b4fe" }}>
              {stats.on_leave}
            </span>
          </div>
          <div className="att-stat-item">
            <span className="att-stat-title">Absent / Not In</span>
            <span className="att-stat-number" style={{ color: "#fca5a5" }}>
              {stats.absent}
            </span>
          </div>
          <div className="att-stat-item">
            <span className="att-stat-title">Avg Work Hours</span>
            <span className="att-stat-number" style={{ color: "#93c5fd" }}>
              {stats.average_work_hours} hrs
            </span>
          </div>
        </div>
      )}

      {/* Module Tabs (My History vs Team Overview) */}
      <div className="emp-header-bar">
        <div className="emp-tabs">
          <button
            className={`emp-tab-btn ${activeTab === "my" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("my");
              setPage(1);
            }}
          >
            <span>👤</span> My Attendance History
          </button>
          {canViewTeam && (
            <button
              className={`emp-tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("overview");
                setPage(1);
              }}
            >
              <span>📊</span> {isHRorAdmin ? "Company Overview" : "Team Attendance"}
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="emp-toolbar">
        <div className="emp-filter-group" style={{ width: "100%", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Date filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--text)" }}>Date:</span>
              <input
                type="date"
                className="emp-select"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Status filter */}
            <select
              className="emp-select"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ABSENT">Absent</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="HOLIDAY">Holiday</option>
            </select>

            {/* Department filter (overview only) */}
            {activeTab === "overview" && isHRorAdmin && (
              <select
                className="emp-select"
                value={filterDept}
                onChange={(e) => {
                  setFilterDept(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}

            {/* Employee filter (overview only) */}
            {activeTab === "overview" && (
              <select
                className="emp-select"
                value={filterEmployee}
                onChange={(e) => {
                  setFilterEmployee(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            )}

            {(filterDate || filterStatus || filterDept || filterEmployee) && (
              <button
                className="btn-secondary"
                style={{ padding: "4px 10px", fontSize: "12px" }}
                onClick={() => {
                  setFilterDate("");
                  setFilterStatus("");
                  setFilterDept("");
                  setFilterEmployee("");
                  setPage(1);
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div style={{ fontSize: "12px", color: "var(--text)" }}>
            Found <strong>{totalCount}</strong> attendance records
          </div>
        </div>
      </div>

      {/* Error state */}
      {errorRecords && (
        <div className="login-alert">
          <span>{errorRecords}</span>
          <button className="btn-secondary" onClick={fetchRecords} style={{ padding: "4px 8px" }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loadingRecords && (
        <div className="state-box">
          <div className="icon">⏳</div>
          <h3>Loading Attendance Records...</h3>
        </div>
      )}

      {/* Empty state */}
      {!loadingRecords && records.length === 0 && (
        <div className="state-box">
          <div className="icon">📅</div>
          <h3>No Attendance Records Found</h3>
          <p>
            {activeTab === "my"
              ? "You have no attendance records matching the selected date or status filters."
              : "No team attendance entries matched your search criteria."}
          </p>
        </div>
      )}

      {/* Attendance History Table */}
      {!loadingRecords && records.length > 0 && (
        <div className="emp-table-container">
          <table className="emp-table">
            <thead>
              <tr>
                {activeTab === "overview" && <th>Employee</th>}
                <th>Date</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Notes</th>
                {isHRorAdmin && activeTab === "overview" && <th style={{ textAlign: "right" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => (
                <tr key={rec.id}>
                  {activeTab === "overview" && (
                    <td>
                      <div>
                        <strong>{rec.employee_name}</strong>
                        <div style={{ fontSize: "11.5px", color: "var(--text)" }}>
                          <code>{rec.employee_id_code}</code> · {rec.department_name}
                        </div>
                      </div>
                    </td>
                  )}
                  <td>
                    <strong>{rec.date}</strong>
                  </td>
                  <td>{formatTime(rec.check_in)}</td>
                  <td>{formatTime(rec.check_out)}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: rec.work_duration_hours > 0 ? "#86efac" : "inherit" }}>
                      {rec.work_duration_hours} hrs
                    </span>
                  </td>
                  <td>
                    <span className={`att-badge ${rec.status?.toLowerCase()}`}>
                      {rec.is_active_session && <span className="pulse-dot" />}
                      {rec.status}
                    </span>
                  </td>
                  <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {rec.notes || "--"}
                  </td>
                  {isHRorAdmin && activeTab === "overview" && (
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => setCorrectingRecord(rec)}
                        title="Authorized correction with audit trail"
                      >
                        ✏️ Correct
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loadingRecords && records.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={(newPage) => setPage(newPage)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          pageSizeOptions={[10, 20, 50]}
          itemName="attendance records"
          isLoading={loadingRecords}
        />
      )}

      {/* Correction Modal */}
      {correctingRecord && (
        <AttendanceCorrectionModal
          isOpen={true}
          record={correctingRecord}
          onClose={() => setCorrectingRecord(null)}
          onSuccess={() => {
            fetchRecords();
            fetchTodayStatus();
            if (canViewTeam) attendanceService.getAttendanceStats().then(setStats).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
