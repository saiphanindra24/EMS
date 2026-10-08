import { useEffect, useState } from "react";
import { attendanceService } from "../services/attendanceService";

export default function AttendanceCorrectionModal({
  isOpen,
  onClose,
  onSuccess,
  record,
}) {
  const [formData, setFormData] = useState({
    check_in: "",
    check_out: "",
    status: "PRESENT",
    reason: "",
  });

  const [auditHistory, setAuditHistory] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (record) {
      // Format timestamps for datetime-local input (YYYY-MM-DDTHH:mm)
      const formatDT = (dtStr) => {
        if (!dtStr) return "";
        const d = new Date(dtStr);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      };

      setFormData({
        check_in: formatDT(record.check_in),
        check_out: formatDT(record.check_out),
        status: record.status || "PRESENT",
        reason: "",
      });

      // Load existing audit history for this record
      setLoadingAudit(true);
      attendanceService
        .getCorrectionHistory(record.id)
        .then((data) => setAuditHistory(Array.isArray(data) ? data : data.results || []))
        .catch(() => setAuditHistory([]))

        .finally(() => setLoadingAudit(false));
    } else {
      setAuditHistory([]);
    }
    setError("");
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.reason.trim()) {
      setError("A documented justification / reason is mandatory for audit compliance.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const payload = {
        reason: formData.reason.trim(),
        status: formData.status,
      };

      if (formData.check_in) {
        payload.check_in = new Date(formData.check_in).toISOString();
      }
      if (formData.check_out) {
        payload.check_out = new Date(formData.check_out).toISOString();
      }

      await attendanceService.correctAttendance(record.id, payload);
      onSuccess();
      onClose();
    } catch (err) {
      if (err.detail) {
        setError(err.detail);
      } else if (err.reason) {
        setError(Array.isArray(err.reason) ? err.reason.join(" ") : err.reason);
      } else {
        setError("Failed to apply attendance correction.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            Correct Attendance Record ({record.date})
          </h2>
          <button className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="login-alert" style={{ margin: 0 }}>
              <span>{error}</span>
            </div>
          )}

          {/* Record summary */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              fontSize: "13px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>
              <strong>{record.employee_name}</strong> ({record.employee_id_code})
              <div style={{ color: "var(--text)", fontSize: "12px" }}>{record.department_name}</div>
            </div>
            <div>
              <span>Current Status: </span>
              <span className={`att-badge ${record.status?.toLowerCase()}`}>{record.status}</span>
            </div>
          </div>

          {/* Form fields */}
          <div className="form-grid-3">
            <div className="form-field">
              <label>Adjusted Check-in</label>
              <input
                type="datetime-local"
                name="check_in"
                value={formData.check_in}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label>Adjusted Check-out</label>
              <input
                type="datetime-local"
                name="check_out"
                value={formData.check_out}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label>Adjusted Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ABSENT">Absent</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="HOLIDAY">Holiday</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Audit Justification / Reason *</label>
            <textarea
              name="reason"
              rows={2}
              required
              placeholder="e.g. Employee badge reader malfunction reported; verified with building reception log."
              value={formData.reason}
              onChange={handleChange}
            />
          </div>

          {/* Audit History List */}
          <div>
            <div className="form-section-title">
              <span>📜</span> Correction Audit Trail
            </div>

            {loadingAudit ? (
              <p style={{ fontSize: "12px", color: "var(--text)" }}>Loading audit history...</p>
            ) : auditHistory.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--text)" }}>
                No prior corrections recorded for this entry.
              </p>
            ) : (
              <div className="audit-list">
                {auditHistory.map((audit) => (
                  <div key={audit.id} className="audit-item">
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>Adjusted by {audit.corrected_by_name || "Admin"}</strong>
                      <span>{new Date(audit.created_at).toLocaleString()}</span>
                    </div>
                    <div style={{ margin: "2px 0", color: "#f3f4f6" }}>
                      Status changed from <code>{audit.original_status}</code> →{" "}
                      <code>{audit.new_status}</code>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontStyle: "italic" }}>
                      "{audit.reason}"
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ padding: 0, borderTop: "none" }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving Audit..." : "Apply & Log Correction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
