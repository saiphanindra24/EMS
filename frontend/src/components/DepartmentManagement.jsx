import { useEffect, useState } from "react";
import ConfirmationModal from "./ConfirmationModal";
import DepartmentModal from "./DepartmentModal";
import { employeeService } from "../services/employeeService";

export default function DepartmentManagement({
  canManage = false,
  allEmployees = [],
  onSelectEmployee,
}) {
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const [activeModal, setActiveModal] = useState(null); // 'create' | 'edit' | 'delete' | 'roster'
  const [selectedDept, setSelectedDept] = useState(null);
  const [deptEmployees, setDeptEmployees] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDepartments = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await employeeService.getDepartments({
        search: search.trim(),
        ordering: "name",
      });
      setDepartments(data.results || data);
    } catch (err) {
      setError(err.message || "Failed to load departments.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDepartments();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenRoster = async (dept) => {
    setSelectedDept(dept);
    setActiveModal("roster");
    setLoadingRoster(true);
    try {
      const data = await employeeService.getDepartmentEmployees(dept.id);
      setDeptEmployees(data.results || data);
    } catch (err) {
      console.error("Error loading roster:", err);
      setDeptEmployees([]);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!selectedDept) return;
    setActionLoading(true);
    try {
      await employeeService.deleteDepartment(selectedDept.id);
      setActiveModal(null);
      fetchDepartments();
    } catch (err) {
      alert(err.detail || "Could not deactivate department.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="emp-container">
      {/* Toolbar */}
      <div className="emp-toolbar">
        <div className="emp-search-group">
          <span>🔍</span>
          <input
            type="search"
            placeholder="Search departments by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {canManage && (
          <button
            className="btn-primary"
            onClick={() => {
              setSelectedDept(null);
              setActiveModal("create");
            }}
          >
            <span>+</span> Add Department
          </button>
        )}
      </div>

      {error && (
        <div className="login-alert">
          <span>{error}</span>
          <button className="btn-secondary" onClick={fetchDepartments} style={{ padding: "4px 8px" }}>
            Retry
          </button>
        </div>
      )}

      {isLoading && (
        <div className="state-box">
          <div className="icon">⏳</div>
          <h3>Loading Departments...</h3>
        </div>
      )}

      {!isLoading && departments.length === 0 && (
        <div className="state-box">
          <div className="icon">🏢</div>
          <h3>No Departments Found</h3>
          <p>Create a department or adjust your search keywords.</p>
        </div>
      )}

      {/* Department Cards Grid */}
      {!isLoading && departments.length > 0 && (
        <div className="dept-grid">
          {departments.map((dept) => (
            <div key={dept.id} className="dept-card">
              <div className="dept-card-header">
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "17px", color: "var(--text-h)" }}>
                    {dept.name}
                  </h3>
                  <span className="dept-code-pill">{dept.code}</span>
                </div>
                <span className={`badge-status ${dept.is_active ? "active" : "inactive"}`}>
                  {dept.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <p className="dept-card-desc">
                {dept.description || "No mission description provided for this department."}
              </p>

              {/* Head info */}
              <div className="dept-head-info">
                <span>👤 Head:</span>
                {dept.head_details ? (
                  <strong>
                    {dept.head_details.full_name}{" "}
                    <span style={{ fontSize: "11px", color: "var(--text)" }}>
                      ({dept.head_details.designation || "Lead"})
                    </span>
                  </strong>
                ) : (
                  <span style={{ color: "var(--text)" }}>Unassigned</span>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "12.5px",
                  color: "var(--text)",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  paddingTop: "12px",
                  marginTop: "auto",
                }}
              >
                <span>
                  Team size: <strong>{dept.employee_count ?? 0} members</strong>
                </span>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                    onClick={() => handleOpenRoster(dept)}
                  >
                    👥 Roster
                  </button>
                  {canManage && (
                    <>
                      <button
                        className="btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "12px" }}
                        onClick={() => {
                          setSelectedDept(dept);
                          setActiveModal("edit");
                        }}
                      >
                        ✏️
                      </button>
                      {dept.is_active && (
                        <button
                          className="btn-secondary"
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            color: "#fca5a5",
                            borderColor: "rgba(239, 68, 68, 0.3)",
                          }}
                          onClick={() => {
                            setSelectedDept(dept);
                            setActiveModal("delete");
                          }}
                          title="Soft deactivate department"
                        >
                          ⏸
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Department Modal */}
      {(activeModal === "create" || activeModal === "edit") && (
        <DepartmentModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          onSuccess={fetchDepartments}
          department={selectedDept}
          employees={allEmployees}
        />
      )}

      {/* Confirmation Modal for Department Soft Delete */}
      {activeModal === "delete" && selectedDept && (
        <ConfirmationModal
          isOpen={true}
          title={`Deactivate Department: ${selectedDept.name}`}
          message={`Are you sure you want to deactivate ${selectedDept.name} (${selectedDept.code})? It will be marked inactive but its records and employees will be preserved.`}
          confirmText="Deactivate Department"
          onConfirm={handleSoftDelete}
          onClose={() => setActiveModal(null)}
          isLoading={actionLoading}
        />
      )}

      {/* Department Roster Slide/Modal */}
      {activeModal === "roster" && selectedDept && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {selectedDept.name} ({selectedDept.code}) — Team Roster
              </h2>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {loadingRoster && (
                <div className="state-box">
                  <div className="icon">⏳</div>
                  <h3>Loading Department Members...</h3>
                </div>
              )}
              {!loadingRoster && deptEmployees.length === 0 && (
                <div className="state-box">
                  <div className="icon">👥</div>
                  <h3>No Employees in this Department</h3>
                  <p>Assign employees to {selectedDept.name} through their profile.</p>
                </div>
              )}
              {!loadingRoster && deptEmployees.length > 0 && (
                <div className="emp-table-container">
                  <table className="emp-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>ID</th>
                        <th>Designation</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptEmployees.map((emp) => (
                        <tr key={emp.id}>
                          <td>
                            <strong>{emp.full_name}</strong>
                            <div style={{ fontSize: "11.5px", color: "var(--text)" }}>{emp.email}</div>
                          </td>
                          <td>
                            <code>{emp.employee_id}</code>
                          </td>
                          <td>{emp.designation || "N/A"}</td>
                          <td>
                            <span className={`badge-status ${emp.status?.toLowerCase()}`}>
                              {emp.status}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-secondary"
                              style={{ padding: "4px 8px", fontSize: "11.5px" }}
                              onClick={() => {
                                setActiveModal(null);
                                if (onSelectEmployee) onSelectEmployee(emp.id);
                              }}
                            >
                              View Profile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
