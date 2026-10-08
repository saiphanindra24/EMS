import { useState } from "react";

export default function LeaveRejectModal({ isOpen, onClose, onConfirm, requestId }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a reason for rejecting this leave request.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onConfirm(requestId, reason.trim());
      setReason("");
      onClose();
    } catch (err) {
      setError(err?.rejection_reason?.[0] || err?.error || "Failed to reject leave request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Reject Leave Request</h3>
            <p>Request #{requestId} · Mandatory rejection explanation</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-group">
            <label htmlFor="rejectionReason">
              Reason for Rejection <span className="req">*</span>
            </label>
            <textarea
              id="rejectionReason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this request is being rejected (e.g. critical project milestone, team scheduling conflict)..."
              disabled={isSubmitting}
              required
            />
            <span className="field-hint">
              This reason will be recorded in the decision audit trail and shown to the employee.
            </span>
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
              className="btn danger"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
