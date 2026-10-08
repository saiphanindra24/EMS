import { useEffect, useState } from "react";
import ConfirmationModal from "./ConfirmationModal";
import DepartmentManagement from "./DepartmentManagement";
import EmployeeDetailModal from "./EmployeeDetailModal";
import EmployeeModal from "./EmployeeModal";
import Pagination from "./common/Pagination";
import "./Employees.css";
import { employeeService } from "../services/employeeService";
import { useAuth } from "../context/AuthContext";

export default function EmployeeDirectory() {
  const { roles } = useAuth();
  const isHRorAdmin = Boolean(roles?.is_super_admin || roles?.is_hr_admin);

  // Active view: 'employees' | 'departments'
  const [activeTab, setActiveTab] = useState("employees");

  // View style: 'grid' | 'table'
  const [viewMode, setViewMode] = useState("grid");

  // Data states
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [includeArchived, setIncludeArchived] = useState(false);

  // Modals state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingEmployeeId, setViewingEmployeeId] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    action: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch departments for filtering and dropdowns
  const loadDepartments = async () => {
    try {
      const data = await employeeService.getDepartments({ page_size: 100 });
      setDepartments(data.results || data);
    } catch (err) {
      console.error("Failed to load departments:", err);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  // Fetch employees
  const fetchEmployees = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await employeeService.getEmployees({
        page,
        page_size: pageSize,
        search: search.trim(),
        department: selectedDept,
        status: selectedStatus,
        employment_type: selectedType,
        ordering,
        include_archived: includeArchived ? "true" : "false",
      });
      setEmployees(data.results || data);
      setTotalCount(data.count ?? (data.results || data).length);
    } catch (err) {
      setError(err.message || "Failed to fetch employees.");
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search & filter trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 250);
    return () => clearTimeout(timer);
  }, [page, pageSize, search, selectedDept, selectedStatus, selectedType, ordering, includeArchived]);

  // Reset to page 1 on filter change
  const handleFilterChange = (setter, value) => {
    setter(value);
    setPage(1);
  };

  const handleDeactivatePrompt = (emp) => {
    setConfirmModal({
      isOpen: true,
      title: `Deactivate Employee: ${emp.full_name}`,
      message: `Are you sure you want to deactivate ${emp.full_name} (${emp.employee_id})? This will archive their profile and revoke application login access. All records remain safely preserved in the database.`,
      confirmText: "Deactivate",
      confirmStyle: "danger",
      action: async () => {
        setActionLoading(true);
        try {
          await employeeService.deactivateEmployee(emp.id);
          setConfirmModal({ isOpen: false });
          fetchEmployees();
        } catch (err) {
          alert(err.detail || "Failed to deactivate employee.");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleReactivatePrompt = (emp) => {
    setConfirmModal({
      isOpen: true,
      title: `Reactivate Employee: ${emp.full_name}`,
      message: `Do you want to restore ${emp.full_name} (${emp.employee_id})? Their profile status will become Active and their system login will be re-enabled.`,
      confirmText: "Reactivate",
      confirmStyle: "primary",
      action: async () => {
        setActionLoading(true);
        try {
          await employeeService.reactivateEmployee(emp.id);
          setConfirmModal({ isOpen: false });
          fetchEmployees();
        } catch (err) {
          alert(err.detail || "Failed to reactivate employee.");
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="emp-container">
      {/* Top Header & Tab Switcher */}
      <div className="emp-header-bar">
        <div className="emp-tabs">
          <button
            className={`emp-tab-btn ${activeTab === "employees" ? "active" : ""}`}
            onClick={() => setActiveTab("employees")}
          >
            <span>👥</span> Employee Directory
            <span className="emp-tab-badge">{totalCount}</span>
          </button>
          <button
            className={`emp-tab-btn ${activeTab === "departments" ? "active" : ""}`}
            onClick={() => setActiveTab("departments")}
          >
            <span>🏢</span> Departments
            <span className="emp-tab-badge">{departments.length}</span>
          </button>
        </div>

        {activeTab === "employees" && isHRorAdmin && (
          <div className="emp-actions">
            <button
              className="btn-primary"
              onClick={() => {
                setEditingEmployee(null);
                setIsEmployeeModalOpen(true);
              }}
            >
              <span>+</span> Add Employee
            </button>
          </div>
        )}
      </div>

      {/* RENDER DEPARTMENTS MODULE */}
      {activeTab === "departments" && (
        <DepartmentManagement
          canManage={isHRorAdmin}
          allEmployees={employees}
          onSelectEmployee={(empId) => {
            setActiveTab("employees");
            setViewingEmployeeId(empId);
          }}
        />
      )}

      {/* RENDER EMPLOYEES DIRECTORY MODULE */}
      {activeTab === "employees" && (
        <>
          {/* Filter & Search Toolbar */}
          <div className="emp-toolbar">
            <div className="emp-search-group">
              <span>🔍</span>
              <input
                type="search"
                placeholder="Search by name, ID, email, or designation..."
                value={search}
                onChange={(e) => handleFilterChange(setSearch, e.target.value)}
              />
            </div>

            <div className="emp-filter-group">
              {/* Department filter */}
              <select
                className="emp-select"
                value={selectedDept}
                onChange={(e) => handleFilterChange(setSelectedDept, e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                className="emp-select"
                value={selectedStatus}
                onChange={(e) => handleFilterChange(setSelectedStatus, e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="TERMINATED">Terminated</option>
              </select>

              {/* Employment type filter */}
              <select
                className="emp-select"
                value={selectedType}
                onChange={(e) => handleFilterChange(setSelectedType, e.target.value)}
              >
                <option value="">All Types</option>
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </select>

              {/* Sorting */}
              <select
                className="emp-select"
                value={ordering}
                onChange={(e) => handleFilterChange(setOrdering, e.target.value)}
              >
                <option value="-created_at">Recently Added</option>
                <option value="user__first_name">Name (A-Z)</option>
                <option value="-user__first_name">Name (Z-A)</option>
                <option value="employee_id">Employee ID (Asc)</option>
                <option value="-employee_id">Employee ID (Desc)</option>
                <option value="-date_joined">Join Date (Newest)</option>
              </select>

              {/* Include archived checkbox for HR/Admin */}
              {isHRorAdmin && (
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => handleFilterChange(setIncludeArchived, e.target.checked)}
                  />
                  <span>Show Archived</span>
                </label>
              )}

              {/* View mode toggle */}
              <div className="view-toggle-btns">
                <button
                  className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Grid Cards"
                >
                  ▦
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                  onClick={() => setViewMode("table")}
                  title="Table View"
                >
                  ▤
                </button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="login-alert">
              <span>{error}</span>
              <button className="btn-secondary" onClick={fetchEmployees} style={{ padding: "4px 8px" }}>
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="state-box">
              <div className="icon">⏳</div>
              <h3>Loading Employees...</h3>
              <p>Fetching directory data from backend...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && employees.length === 0 && (
            <div className="state-box">
              <div className="icon">👥</div>
              <h3>No Employees Found</h3>
              <p>No employee records matched your active filter or search criteria.</p>
              {(search || selectedDept || selectedStatus || selectedType) && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSearch("");
                    setSelectedDept("");
                    setSelectedStatus("");
                    setSelectedType("");
                    setPage(1);
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}

          {/* GRID VIEW */}
          {!isLoading && employees.length > 0 && viewMode === "grid" && (
            <div className="emp-grid">
              {employees.map((emp) => {
                const initials =
                  ((emp.first_name?.[0] || "") + (emp.last_name?.[0] || "")).toUpperCase() ||
                  emp.email?.[0]?.toUpperCase() ||
                  "?";

                return (
                  <div key={emp.id} className={`emp-card ${emp.is_archived ? "archived" : ""}`}>
                    <div className="emp-card-top">
                      <div className="emp-avatar">
                        {emp.profile_photo ? (
                          <img src={emp.profile_photo} alt={emp.full_name} />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="emp-meta">
                        <div className="emp-name-row">
                          <h4 className="emp-name" title={emp.full_name}>
                            {emp.full_name}
                          </h4>
                          <span className="emp-id-tag">{emp.employee_id}</span>
                        </div>
                        <div className="emp-title">{emp.designation || "Staff"}</div>
                        <div className="emp-badges">
                          <span className="badge-dept">{emp.department_name || "Unassigned"}</span>
                          <span className={`badge-status ${emp.status?.toLowerCase()}`}>
                            {emp.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="emp-info-list">
                      <div className="emp-info-item">
                        <span className="emp-info-icon">✉️</span>
                        <a href={`mailto:${emp.email}`}>{emp.email}</a>
                      </div>
                      {emp.phone && (
                        <div className="emp-info-item">
                          <span className="emp-info-icon">📞</span>
                          <span>{emp.phone}</span>
                        </div>
                      )}
                      <div className="emp-info-item">
                        <span className="emp-info-icon">📍</span>
                        <span>{emp.work_location}</span>
                      </div>
                      {emp.manager_name && (
                        <div className="emp-info-item">
                          <span className="emp-info-icon">👤</span>
                          <span>Reports to: {emp.manager_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="emp-card-footer">
                      <button
                        className="btn-secondary"
                        style={{ padding: "5px 12px", fontSize: "12px" }}
                        onClick={() => setViewingEmployeeId(emp.id)}
                      >
                        View Profile
                      </button>

                      {isHRorAdmin && (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: "5px 8px", fontSize: "12px" }}
                            onClick={() => {
                              setEditingEmployee(emp);
                              setIsEmployeeModalOpen(true);
                            }}
                            title="Edit Employee"
                          >
                            ✏️
                          </button>

                          {emp.status === "ACTIVE" && !emp.is_archived ? (
                            <button
                              className="btn-secondary"
                              style={{
                                padding: "5px 8px",
                                fontSize: "12px",
                                color: "#fca5a5",
                                borderColor: "rgba(239, 68, 68, 0.3)",
                              }}
                              onClick={() => handleDeactivatePrompt(emp)}
                              title="Soft Deactivate"
                            >
                              ⏸
                            </button>
                          ) : (
                            <button
                              className="btn-secondary"
                              style={{
                                padding: "5px 8px",
                                fontSize: "12px",
                                color: "#86efac",
                                borderColor: "rgba(34, 197, 94, 0.3)",
                              }}
                              onClick={() => handleReactivatePrompt(emp)}
                              title="Reactivate Employee"
                            >
                              ▶
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE VIEW */}
          {!isLoading && employees.length > 0 && viewMode === "table" && (
            <div className="emp-table-container">
              <table className="emp-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>ID</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const initials =
                      ((emp.first_name?.[0] || "") + (emp.last_name?.[0] || "")).toUpperCase() ||
                      emp.email?.[0]?.toUpperCase() ||
                      "?";

                    return (
                      <tr key={emp.id} style={{ opacity: emp.is_archived ? 0.6 : 1 }}>
                        <td>
                          <div className="emp-table-user">
                            <div className="emp-avatar" style={{ width: "36px", height: "36px", fontSize: "14px" }}>
                              {emp.profile_photo ? (
                                <img src={emp.profile_photo} alt={emp.full_name} />
                              ) : (
                                initials
                              )}
                            </div>
                            <div>
                              <strong>{emp.full_name}</strong>
                              <div style={{ fontSize: "12px", color: "var(--text)" }}>{emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <code>{emp.employee_id}</code>
                        </td>
                        <td>
                          <span className="badge-dept">{emp.department_name || "Unassigned"}</span>
                        </td>
                        <td>{emp.designation || "Staff"}</td>
                        <td>📍 {emp.work_location}</td>
                        <td>
                          <span className={`badge-status ${emp.status?.toLowerCase()}`}>
                            {emp.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "12px", marginRight: "6px" }}
                            onClick={() => setViewingEmployeeId(emp.id)}
                          >
                            View
                          </button>
                          {isHRorAdmin && (
                            <>
                              <button
                                className="btn-secondary"
                                style={{ padding: "4px 8px", fontSize: "12px", marginRight: "6px" }}
                                onClick={() => {
                                  setEditingEmployee(emp);
                                  setIsEmployeeModalOpen(true);
                                }}
                              >
                                ✏️
                              </button>
                              {emp.status === "ACTIVE" && !emp.is_archived ? (
                                <button
                                  className="btn-secondary"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "12px",
                                    color: "#fca5a5",
                                    borderColor: "rgba(239, 68, 68, 0.3)",
                                  }}
                                  onClick={() => handleDeactivatePrompt(emp)}
                                >
                                  ⏸
                                </button>
                              ) : (
                                <button
                                  className="btn-secondary"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "12px",
                                    color: "#86efac",
                                    borderColor: "rgba(34, 197, 94, 0.3)",
                                  }}
                                  onClick={() => handleReactivatePrompt(emp)}
                                >
                                  ▶
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && employees.length > 0 && (
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
              pageSizeOptions={[6, 9, 15, 30]}
              itemName="employees"
              isLoading={isLoading}
            />
          )}

          {/* Add / Edit Employee Modal */}
          <EmployeeModal
            isOpen={isEmployeeModalOpen}
            onClose={() => {
              setIsEmployeeModalOpen(false);
              setEditingEmployee(null);
            }}
            onSuccess={() => {
              fetchEmployees();
              loadDepartments();
            }}
            employee={editingEmployee}
            departments={departments}
            managers={employees}
            isHRorAdmin={isHRorAdmin}
          />

          {/* Employee Detail Slide / Modal */}
          <EmployeeDetailModal
            isOpen={Boolean(viewingEmployeeId)}
            onClose={() => setViewingEmployeeId(null)}
            employeeId={viewingEmployeeId}
            canManage={isHRorAdmin}
            onEdit={(emp) => {
              setEditingEmployee(emp);
              setIsEmployeeModalOpen(true);
            }}
            onDeactivate={handleDeactivatePrompt}
            onReactivate={handleReactivatePrompt}
          />

          {/* Generic Confirmation Modal */}
          <ConfirmationModal
            isOpen={confirmModal.isOpen}
            title={confirmModal.title}
            message={confirmModal.message}
            confirmText={confirmModal.confirmText}
            confirmStyle={confirmModal.confirmStyle}
            onConfirm={confirmModal.action}
            onClose={() => setConfirmModal({ isOpen: false })}
            isLoading={actionLoading}
          />
        </>
      )}
    </div>
  );
}
