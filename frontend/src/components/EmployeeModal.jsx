import { useEffect, useState } from "react";
import { employeeService } from "../services/employeeService";

export default function EmployeeModal({
  isOpen,
  onClose,
  onSuccess,
  employee = null, // null for create, object for edit
  departments = [],
  managers = [],
  isHRorAdmin = true,
}) {
  const isEditing = Boolean(employee);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "EMPLOYEE",
    password: "",
    employee_id: "",
    phone: "",
    department: "",
    designation: "",
    manager: "",
    employment_type: "FULL_TIME",
    status: "ACTIVE",
    work_location: "On-site",
    date_joined: new Date().toISOString().split("T")[0],
    // Sensitive
    date_of_birth: "",
    gender: "",
    address: "",
    national_id: "",
    bank_account_number: "",
    bank_name: "",
    base_salary: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        first_name: employee.first_name || "",
        last_name: employee.last_name || "",
        email: employee.email || "",
        role: employee.role || "EMPLOYEE",
        password: "",
        employee_id: employee.employee_id || "",
        phone: employee.phone || "",
        department: employee.department || "",
        designation: employee.designation || "",
        manager: employee.manager || "",
        employment_type: employee.employment_type || "FULL_TIME",
        status: employee.status || "ACTIVE",
        work_location: employee.work_location || "On-site",
        date_joined: employee.date_joined || new Date().toISOString().split("T")[0],
        date_of_birth: employee.date_of_birth || "",
        gender: employee.gender || "",
        address: employee.address || "",
        national_id: employee.national_id || "",
        bank_account_number: employee.bank_account_number || "",
        bank_name: employee.bank_name || "",
        base_salary: employee.base_salary ? String(employee.base_salary) : "",
        emergency_contact_name: employee.emergency_contact_name || "",
        emergency_contact_phone: employee.emergency_contact_phone || "",
      });
      setPhotoPreview(employee.profile_photo || null);
    } else {
      // Reset form
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        role: "EMPLOYEE",
        password: "",
        employee_id: `EMP-${Math.floor(100 + Math.random() * 900)}`,
        phone: "",
        department: departments[0]?.id || "",
        designation: "",
        manager: "",
        employment_type: "FULL_TIME",
        status: "ACTIVE",
        work_location: "On-site",
        date_joined: new Date().toISOString().split("T")[0],
        date_of_birth: "",
        gender: "",
        address: "",
        national_id: "",
        bank_account_number: "",
        bank_name: "",
        base_salary: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
      });
      setPhotoFile(null);
      setPhotoPreview(null);
    }
    setFieldErrors({});
    setGeneralError("");
  }, [employee, departments, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, profile_photo: "File size must be under 5MB." }));
      return;
    }
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setFieldErrors((prev) => ({ ...prev, profile_photo: "Only JPG, PNG, WEBP, or GIF allowed." }));
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setFieldErrors((prev) => ({ ...prev, profile_photo: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setGeneralError("");
    setFieldErrors({});

    // Client-side quick check
    const errors = {};
    if (!formData.first_name.trim()) errors.first_name = "First name is required.";
    if (!formData.email.trim()) errors.email = "Email is required.";
    if (!formData.employee_id.trim()) errors.employee_id = "Employee ID is required.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = new FormData();

      Object.entries(formData).forEach(([key, val]) => {
        if (val !== "" && val !== null && val !== undefined) {
          // If editing and password is empty, don't send password
          if (key === "password" && isEditing && !val) return;
          payload.append(key, val);
        }
      });

      if (photoFile) {
        payload.append("profile_photo", photoFile);
      }

      if (isEditing) {
        await employeeService.updateEmployee(employee.id, payload);
      } else {
        await employeeService.createEmployee(payload);
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (typeof err === "object" && err !== null) {
        if (err.detail) {
          setGeneralError(err.detail);
        } else {
          setFieldErrors(err);
          // If there's an overarching error
          if (err.non_field_errors) {
            setGeneralError(err.non_field_errors.join(", "));
          }
        }
      } else {
        setGeneralError("An unexpected error occurred while saving the employee.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? `Edit Employee (${employee?.employee_id})` : "Add New Employee"}</h2>
          <button className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {generalError && (
            <div className="login-alert" style={{ margin: 0 }}>
              <span>{generalError}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div>
            <div className="form-section-title">
              <span>👤</span> Basic Profile &amp; Login
            </div>
            <div className="form-grid-3">
              <div className="form-field">
                <label>First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="e.g. Ananya"
                  required
                />
                {fieldErrors.first_name && <span className="form-field-error">{fieldErrors.first_name}</span>}
              </div>

              <div className="form-field">
                <label>Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="e.g. Rao"
                />
                {fieldErrors.last_name && <span className="form-field-error">{fieldErrors.last_name}</span>}
              </div>

              <div className="form-field">
                <label>System Role *</label>
                <select name="role" value={formData.role} onChange={handleChange} disabled={!isHRorAdmin}>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="HR_ADMIN">HR Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
                {fieldErrors.role && <span className="form-field-error">{fieldErrors.role}</span>}
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: "12px" }}>
              <div className="form-field">
                <label>Work Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="user@emwts.local"
                  required
                />
                {fieldErrors.email && <span className="form-field-error">{fieldErrors.email}</span>}
              </div>

              <div className="form-field">
                <label>Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 000-0000"
                />
                {fieldErrors.phone && <span className="form-field-error">{fieldErrors.phone}</span>}
              </div>
            </div>

            {!isEditing && (
              <div className="form-field" style={{ marginTop: "12px" }}>
                <label>Initial Password (optional)</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Leave empty for auto-generated password"
                />
                <span style={{ fontSize: "11px", color: "var(--text)" }}>
                  If omitted, defaults to [EmployeeID]Pass2026!
                </span>
                {fieldErrors.password && <span className="form-field-error">{fieldErrors.password}</span>}
              </div>
            )}
          </div>

          {/* Section 2: Work & Organization */}
          <div>
            <div className="form-section-title">
              <span>🏢</span> Employment Details
            </div>
            <div className="form-grid-3">
              <div className="form-field">
                <label>Employee ID *</label>
                <input
                  type="text"
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={handleChange}
                  placeholder="EMP-010"
                  required
                />
                {fieldErrors.employee_id && <span className="form-field-error">{fieldErrors.employee_id}</span>}
              </div>

              <div className="form-field">
                <label>Department</label>
                <select name="department" value={formData.department} onChange={handleChange}>
                  <option value="">-- No Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
                {fieldErrors.department && <span className="form-field-error">{fieldErrors.department}</span>}
              </div>

              <div className="form-field">
                <label>Designation / Title</label>
                <input
                  type="text"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  placeholder="e.g. Senior Frontend Engineer"
                />
                {fieldErrors.designation && <span className="form-field-error">{fieldErrors.designation}</span>}
              </div>
            </div>

            <div className="form-grid-3" style={{ marginTop: "12px" }}>
              <div className="form-field">
                <label>Reporting Manager</label>
                <select name="manager" value={formData.manager} onChange={handleChange}>
                  <option value="">-- None / Reports to Executive --</option>
                  {managers
                    .filter((m) => !employee || m.id !== employee.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.designation || m.role})
                      </option>
                    ))}
                </select>
                {fieldErrors.manager && <span className="form-field-error">{fieldErrors.manager}</span>}
              </div>

              <div className="form-field">
                <label>Employment Type</label>
                <select name="employment_type" value={formData.employment_type} onChange={handleChange}>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Intern</option>
                </select>
                {fieldErrors.employment_type && (
                  <span className="form-field-error">{fieldErrors.employment_type}</span>
                )}
              </div>

              <div className="form-field">
                <label>Status</label>
                <select name="status" value={formData.status} onChange={handleChange}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="TERMINATED">Terminated</option>
                </select>
                {fieldErrors.status && <span className="form-field-error">{fieldErrors.status}</span>}
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: "12px" }}>
              <div className="form-field">
                <label>Work Location</label>
                <input
                  type="text"
                  name="work_location"
                  value={formData.work_location}
                  onChange={handleChange}
                  placeholder="e.g. Remote, New York HQ, Hybrid"
                />
                {fieldErrors.work_location && (
                  <span className="form-field-error">{fieldErrors.work_location}</span>
                )}
              </div>

              <div className="form-field">
                <label>Date Joined</label>
                <input
                  type="date"
                  name="date_joined"
                  value={formData.date_joined}
                  onChange={handleChange}
                />
                {fieldErrors.date_joined && (
                  <span className="form-field-error">{fieldErrors.date_joined}</span>
                )}
              </div>
            </div>

            {/* Profile Photo Upload */}
            <div className="form-field" style={{ marginTop: "12px" }}>
              <label>Profile Photo</label>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      objectFit: "cover",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "12px",
                    }}
                  >
                    No Pic
                  </div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handlePhotoChange}
                  style={{ fontSize: "12.5px" }}
                />
              </div>
              {fieldErrors.profile_photo && (
                <span className="form-field-error">{fieldErrors.profile_photo}</span>
              )}
            </div>
          </div>

          {/* Section 3: Sensitive Details */}
          {isHRorAdmin && (
            <div>
              <div className="form-section-title">
                <span>🔒</span> Confidential Records (HR &amp; Super Admin Only)
              </div>
              <div className="sensitive-notice">
                <span>ℹ️</span>
                <span>
                  These personal and compensation details are strictly restricted on the backend. Regular employees and colleagues cannot view them.
                </span>
              </div>

              <div className="form-grid-3" style={{ marginTop: "14px" }}>
                <div className="form-field">
                  <label>Base Annual Salary ($)</label>
                  <input
                    type="number"
                    name="base_salary"
                    step="0.01"
                    value={formData.base_salary}
                    onChange={handleChange}
                    placeholder="e.g. 110000"
                  />
                  {fieldErrors.base_salary && (
                    <span className="form-field-error">{fieldErrors.base_salary}</span>
                  )}
                </div>

                <div className="form-field">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                  />
                  {fieldErrors.date_of_birth && (
                    <span className="form-field-error">{fieldErrors.date_of_birth}</span>
                  )}
                </div>

                <div className="form-field">
                  <label>Gender / Pronouns</label>
                  <input
                    type="text"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    placeholder="e.g. Female, Male, Non-binary"
                  />
                  {fieldErrors.gender && <span className="form-field-error">{fieldErrors.gender}</span>}
                </div>
              </div>

              <div className="form-grid-3" style={{ marginTop: "12px" }}>
                <div className="form-field">
                  <label>National ID / Tax ID</label>
                  <input
                    type="text"
                    name="national_id"
                    value={formData.national_id}
                    onChange={handleChange}
                    placeholder="e.g. TAX-990-11"
                  />
                  {fieldErrors.national_id && (
                    <span className="form-field-error">{fieldErrors.national_id}</span>
                  )}
                </div>

                <div className="form-field">
                  <label>Bank Account Number</label>
                  <input
                    type="text"
                    name="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={handleChange}
                    placeholder="e.g. US98-1002"
                  />
                  {fieldErrors.bank_account_number && (
                    <span className="form-field-error">{fieldErrors.bank_account_number}</span>
                  )}
                </div>

                <div className="form-field">
                  <label>Bank Name</label>
                  <input
                    type="text"
                    name="bank_name"
                    value={formData.bank_name}
                    onChange={handleChange}
                    placeholder="e.g. Chase, Silicon Valley Bank"
                  />
                  {fieldErrors.bank_name && (
                    <span className="form-field-error">{fieldErrors.bank_name}</span>
                  )}
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: "12px" }}>
                <div className="form-field">
                  <label>Emergency Contact Name</label>
                  <input
                    type="text"
                    name="emergency_contact_name"
                    value={formData.emergency_contact_name}
                    onChange={handleChange}
                    placeholder="e.g. Spouse / Parent name"
                  />
                  {fieldErrors.emergency_contact_name && (
                    <span className="form-field-error">{fieldErrors.emergency_contact_name}</span>
                  )}
                </div>

                <div className="form-field">
                  <label>Emergency Contact Phone</label>
                  <input
                    type="tel"
                    name="emergency_contact_phone"
                    value={formData.emergency_contact_phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                  />
                  {fieldErrors.emergency_contact_phone && (
                    <span className="form-field-error">{fieldErrors.emergency_contact_phone}</span>
                  )}
                </div>
              </div>

              <div className="form-field" style={{ marginTop: "12px" }}>
                <label>Home Address</label>
                <textarea
                  name="address"
                  rows={2}
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Street address, City, State, ZIP"
                />
                {fieldErrors.address && <span className="form-field-error">{fieldErrors.address}</span>}
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ padding: "0", borderTop: "none" }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving Employee..." : isEditing ? "Save Changes" : "Create Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
