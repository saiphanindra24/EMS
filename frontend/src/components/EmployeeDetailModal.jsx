import { useEffect, useState } from "react";
import { employeeService } from "../services/employeeService";

export default function EmployeeDetailModal({
  isOpen,
  onClose,
  employeeId,
  onEdit,
  onDeactivate,
  onReactivate,
  canManage = false,
}) {
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !employeeId) {
      setEmployee(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError("");

    employeeService
      .getEmployee(employeeId)
      .then((data) => {
        if (isMounted) {
          setEmployee(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load employee details.");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, employeeId]);

  if (!isOpen) return null;

  const initials = employee
    ? ((employee.first_name?.[0] || "") + (employee.last_name?.[0] || "")).toUpperCase() ||
      employee.email?.[0]?.toUpperCase() ||
      "?"
    : "?";

  const hasSensitiveData = Boolean(
    employee &&
      (employee.base_salary !== undefined ||
        employee.bank_account_number !== undefined ||
        employee.national_id !== undefined ||
        employee.emergency_contact_phone !== undefined)
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Employee Profile</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {isLoading && (
            <div className="state-box">
              <div className="icon">⏳</div>
              <h3>Loading Employee Profile...</h3>
            </div>
          )}

          {error && (
            <div className="login-alert">
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && employee && (
            <>
              {/* Profile Card Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  padding: "16px 20px",
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "16px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div
                  className="emp-avatar"
                  style={{ width: "68px", height: "68px", fontSize: "24px" }}
                >
                  {employee.profile_photo ? (
                    <img src={employee.profile_photo} alt={employee.full_name} />
                  ) : (
                    initials
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: "20px", color: "var(--text-h)" }}>
                      {employee.full_name}
                    </h3>
                    <span className="emp-id-tag">{employee.employee_id}</span>
                    <span className={`badge-status ${employee.status?.toLowerCase()}`}>
                      {employee.status}
                    </span>
                    {employee.is_archived && (
                      <span className="badge-status inactive">Archived</span>
                    )}
                  </div>

                  <p style={{ margin: "4px 0 8px", color: "var(--text)", fontSize: "14px" }}>
                    {employee.designation || "No Designation"} ·{" "}
                    <strong>{employee.department_name || "Unassigned"}</strong>
                  </p>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span className="role-badge" style={{ margin: 0 }}>
                      Role: {employee.role}
                    </span>
                    <span className="badge-dept">{employee.employment_type?.replace("_", " ")}</span>
                    <span className="badge-dept" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}>
                      📍 {employee.work_location}
                    </span>
                  </div>
                </div>
              </div>

              {/* Information Sections */}
              <div>
                <div className="form-section-title">
                  <span>📋</span> Employment &amp; Contact Overview
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "14px",
                    background: "rgba(255,255,255,0.02)",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text)", display: "block", fontSize: "11.5px" }}>Email</span>
                    <a href={`mailto:${employee.email}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                      {employee.email}
                    </a>
                  </div>
                  <div>
                    <span style={{ color: "var(--text)", display: "block", fontSize: "11.5px" }}>Phone</span>
                    <span>{employee.phone || "Not provided"}</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text)", display: "block", fontSize: "11.5px" }}>Date Joined</span>
                    <span>{employee.date_joined || "N/A"}</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text)", display: "block", fontSize: "11.5px" }}>Reporting Manager</span>
                    <span>{employee.manager_name || "None / Executive"}</span>
                  </div>
                </div>
              </div>

              {/* Sensitive Details Section */}
              <div>
                <div className="form-section-title">
                  <span>🔒</span> Confidential Personal Data
                </div>

                {hasSensitiveData ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "14px",
                      background: "rgba(170, 59, 255, 0.04)",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1px solid rgba(170, 59, 255, 0.2)",
                      fontSize: "13px",
                    }}
                  >
                    {employee.base_salary !== undefined && (
                      <div>
                        <span style={{ color: "rgba(255,255,255,0.6)", display: "block", fontSize: "11.5px" }}>
                          Annual Compensation
                        </span>
                        <strong style={{ color: "#86efac", fontSize: "15px" }}>
                          ${Number(employee.base_salary).toLocaleString()}
                        </strong>
                      </div>
                    )}
                    {employee.date_of_birth && (
                      <div>
                        <span style={{ color: "rgba(255,255,255,0.6)", display: "block", fontSize: "11.5px" }}>
                          Date of Birth
                        </span>
                        <span>{employee.date_of_birth}</span>
                      </div>
                    )}
                    {employee.gender && (
                      <div>
                        <span style={{ color: "rgba(255,255,255,0.6)", display: "block", fontSize: "11.5px" }}>
                          Gender / Pronouns
                        </span>
                        <span>{employee.gender}</span>
                      </div>
                    )}
                    {employee.national_id && (
                      <div>
                        <span style={{ color: "rgba(255,255,255,0.6)", display: "block", fontSize: "11.5px" }}>
                          National / Tax ID
                        </span>
                        <code>{employee.national_id}</code>
                      </div>
                    )}
                    {employee.bank_account_number && (
                      <div>
                        <span style={{ color: "rgba(255,255,255,0.6)", display: "block", fontSize: "11.5px" }}>
                          Bank Account
                        </span>
                        <span>
                          {employee.bank_account_number} ({employee.bank_name || "Bank"})
                        </span>
                      </div>
                    )}
                    {employee.emergency_contact_name && (
                      <div>
                        <span style={{ color: "rgba(255,255,255,0.6)", display: "block", fontSize: "11.5px" }}>
                          Emergency Contact
                        </span>
                        <span>
                          {employee.emergency_contact_name} ({employee.emergency_contact_phone || "N/A"})
                        </span>
                      </div>
                    )}
                    {employee.address && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)", display: "block", fontSize: "11.5px" }}>
                          Residential Address
                        </span>
                        <span>{employee.address}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="sensitive-notice">
                    <span>🛡️</span>
                    <span>
                      Private compensation and tax records are strictly protected. They are only accessible by authorized HR Administrators and the employee.
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {canManage && employee && (
            <>
              <button
                className="btn-secondary"
                onClick={() => {
                  onClose();
                  onEdit(employee);
                }}
              >
                ✏️ Edit Profile
              </button>

              {employee.status === "ACTIVE" && !employee.is_archived ? (
                <button
                  className="btn-secondary"
                  style={{ color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.3)" }}
                  onClick={() => {
                    onClose();
                    onDeactivate(employee);
                  }}
                >
                  ⏸ Deactivate
                </button>
              ) : (
                <button
                  className="btn-secondary"
                  style={{ color: "#86efac", borderColor: "rgba(34, 197, 94, 0.3)" }}
                  onClick={() => {
                    onClose();
                    onReactivate(employee);
                  }}
                >
                  ▶ Reactivate
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
