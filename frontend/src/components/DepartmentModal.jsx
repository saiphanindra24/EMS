import { useEffect, useState } from "react";
import { employeeService } from "../services/employeeService";

export default function DepartmentModal({
  isOpen,
  onClose,
  onSuccess,
  department = null,
  employees = [],
}) {
  const isEditing = Boolean(department);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    head: "",
    is_active: true,
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || "",
        code: department.code || "",
        description: department.description || "",
        head: department.head || "",
        is_active: department.is_active ?? true,
      });
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        head: "",
        is_active: true,
      });
    }
    setFieldErrors({});
    setGeneralError("");
  }, [department, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setGeneralError("");
    setFieldErrors({});

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      description: formData.description.trim(),
      head: formData.head ? Number(formData.head) : null,
      is_active: formData.is_active,
    };

    try {
      if (isEditing) {
        await employeeService.updateDepartment(department.id, payload);
      } else {
        await employeeService.createDepartment(payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      if (typeof err === "object" && err !== null) {
        if (err.detail) {
          setGeneralError(err.detail);
        } else {
          setFieldErrors(err);
          if (err.non_field_errors) {
            setGeneralError(err.non_field_errors.join(", "));
          }
        }
      } else {
        setGeneralError("Failed to save department. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? `Edit Department (${department?.code})` : "Add Department"}</h2>
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

          <div className="form-field">
            <label>Department Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Product Engineering"
              required
            />
            {fieldErrors.name && <span className="form-field-error">{fieldErrors.name}</span>}
          </div>

          <div className="form-field">
            <label>Department Code *</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              placeholder="e.g. ENG"
              maxLength={10}
              required
            />
            {fieldErrors.code && <span className="form-field-error">{fieldErrors.code}</span>}
          </div>

          <div className="form-field">
            <label>Department Head</label>
            <select name="head" value={formData.head} onChange={handleChange}>
              <option value="">-- No Department Head --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.designation || emp.employee_id})
                </option>
              ))}
            </select>
            {fieldErrors.head && <span className="form-field-error">{fieldErrors.head}</span>}
          </div>

          <div className="form-field">
            <label>Description</label>
            <textarea
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              placeholder="Responsibilities, team mission, or notes..."
            />
            {fieldErrors.description && (
              <span className="form-field-error">{fieldErrors.description}</span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              style={{ width: "auto", cursor: "pointer" }}
            />
            <label htmlFor="is_active" style={{ fontSize: "13px", cursor: "pointer" }}>
              Department is Active
            </label>
          </div>

          <div className="modal-footer" style={{ padding: 0, borderTop: "none" }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Department" : "Create Department"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
