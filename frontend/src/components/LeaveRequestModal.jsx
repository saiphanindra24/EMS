import { useEffect, useState } from "react";
import { leaveService } from "../services/leaveService";

export default function LeaveRequestModal({
  isOpen,
  onClose,
  onSuccess,
  leaveTypes = [],
}) {
  const [formData, setFormData] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [attachment, setAttachment] = useState(null);
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      // Default to first active leave type if available
      const defaultType = leaveTypes[0]?.id ? String(leaveTypes[0].id) : "";
      setFormData({
        leave_type_id: defaultType,
        start_date: "",
        end_date: "",
        reason: "",
      });
      setAttachment(null);
      setCalculatedDays(0);
      setError("");
    }
  }, [isOpen, leaveTypes]);

  // Recalculate duration days whenever start or end dates change
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (end >= start) {
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.round(diffTime / (1000 * 3600 * 24)) + 1;
        setCalculatedDays(diffDays);
      } else {
        setCalculatedDays(0);
      }
    } else {
      setCalculatedDays(0);
    }
  }, [formData.start_date, formData.end_date]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    } else {
      setAttachment(null);
    }
  };

  const selectedType = leaveTypes.find(
    (t) => String(t.id) === String(formData.leave_type_id)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leave_type_id) {
      setError("Please select a leave category.");
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      setError("Both start and end dates are required.");
      return;
    }
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setError("End date cannot be prior to start date.");
      return;
    }
    if (!formData.reason.trim()) {
      setError("Please state the reason for your leave request.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      let payload;
      if (attachment) {
        payload = new FormData();
        payload.append("leave_type_id", formData.leave_type_id);
        payload.append("start_date", formData.start_date);
        payload.append("end_date", formData.end_date);
        payload.append("reason", formData.reason.trim());
        payload.append("attachment", attachment);
      } else {
        payload = {
          leave_type_id: parseInt(formData.leave_type_id, 10),
          start_date: formData.start_date,
          end_date: formData.end_date,
          reason: formData.reason.trim(),
        };
      }

      await leaveService.createLeave(payload);
      onSuccess?.();
      onClose();
    } catch (err) {
      if (typeof err === "string") {
        setError(err);
      } else if (Array.isArray(err)) {
        setError(err.join(" "));
      } else if (err && typeof err === "object") {
        const messages = Object.entries(err)
          .map(([k, v]) => `${k !== "non_field_errors" ? `${k}: ` : ""}${Array.isArray(v) ? v.join(", ") : v}`)
          .join(" | ");
        setError(messages || "Failed to submit leave request.");
      } else {
        setError("Failed to submit leave request.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Submit Leave Request</h3>
            <p>Request time off with real-time policy and conflict validation</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="leaveTypeSelect">
                Leave Category <span className="req">*</span>
              </label>
              <select
                id="leaveTypeSelect"
                name="leave_type_id"
                value={formData.leave_type_id}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              >
                <option value="">Select a category...</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.is_paid ? "Paid" : "Unpaid"}
                    {t.annual_allowance ? ` · Quota: ${t.annual_allowance}d` : ""})
                  </option>
                ))}
              </select>
              {selectedType && (
                <div className="type-desc-pill">
                  <span>ℹ️ {selectedType.description || selectedType.name}</span>
                  <span className={`paid-tag ${selectedType.is_paid ? "paid" : "unpaid"}`}>
                    {selectedType.is_paid ? "Paid Leave" : "Unpaid Leave"}
                  </span>
                </div>
              )}
            </div>

            <div className="form-group full-width">
              <div className="quick-date-chips" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>Quick Range:</span>
                <button
                  type="button"
                  className="chip-btn"
                  style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "2px 8px", fontSize: "11px", cursor: "pointer", color: "#334155" }}
                  onClick={() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    setFormData((prev) => ({ ...prev, start_date: todayStr, end_date: todayStr }));
                  }}
                >
                  Today Only (1d)
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "2px 8px", fontSize: "11px", cursor: "pointer", color: "#334155" }}
                  onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
                    setFormData((prev) => ({ ...prev, start_date: tomorrowStr, end_date: tomorrowStr }));
                  }}
                >
                  Tomorrow (1d)
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "2px 8px", fontSize: "11px", cursor: "pointer", color: "#334155" }}
                  onClick={() => {
                    const start = new Date();
                    start.setDate(start.getDate() + 1);
                    const end = new Date(start);
                    end.setDate(end.getDate() + 2);
                    setFormData((prev) => ({
                      ...prev,
                      start_date: start.toISOString().slice(0, 10),
                      end_date: end.toISOString().slice(0, 10),
                    }));
                  }}
                >
                  3 Days
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "2px 8px", fontSize: "11px", cursor: "pointer", color: "#334155" }}
                  onClick={() => {
                    const start = new Date();
                    start.setDate(start.getDate() + 1);
                    const end = new Date(start);
                    end.setDate(end.getDate() + 4);
                    setFormData((prev) => ({
                      ...prev,
                      start_date: start.toISOString().slice(0, 10),
                      end_date: end.toISOString().slice(0, 10),
                    }));
                  }}
                >
                  1 Week (5d)
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="startDateInput">
                Start Date <span className="req">*</span>
              </label>
              <input
                type="date"
                id="startDateInput"
                name="start_date"
                value={formData.start_date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="endDateInput">
                End Date <span className="req">*</span>
              </label>
              <input
                type="date"
                id="endDateInput"
                name="end_date"
                value={formData.end_date}
                min={formData.start_date || new Date().toISOString().slice(0, 10)}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group full-width">
              <div className="duration-highlight">
                <span>Requested Duration:</span>
                <strong>
                  {calculatedDays > 0
                    ? `${calculatedDays} Day${calculatedDays > 1 ? "s" : ""} (Inclusive)`
                    : "Select valid date range"}
                </strong>
              </div>
            </div>

            <div className="form-group full-width">
              <label htmlFor="leaveReason">
                Reason / Justification <span className="req">*</span>
              </label>
              <textarea
                id="leaveReason"
                name="reason"
                rows={3}
                value={formData.reason}
                onChange={handleChange}
                placeholder="Provide a brief explanation for your leave..."
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="leaveAttachment">
                Supporting Document / Attachment <span className="opt">(Optional)</span>
              </label>
              <input
                type="file"
                id="leaveAttachment"
                onChange={handleFileChange}
                disabled={isSubmitting}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              />
              <span className="field-hint">
                Attach medical certificates, travel itineraries, etc. Max 10MB.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={isSubmitting || calculatedDays === 0}
            >
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
