import { useEffect, useState } from "react";
import { leaveService } from "../services/leaveService";
import LeaveRejectModal from "./LeaveRejectModal";

export default function LeaveDetailModal({
  isOpen,
  onClose,
  requestId,
  canApprove = false,
  isOwnRequest = false,
  onUpdated,
}) {
  const [request, setRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !requestId) {
      setRequest(null);
      setError("");
      setActionError("");
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError("");

    leaveService
      .getLeave(requestId)
      .then((data) => {
        if (isMounted) {
          setRequest(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || "Failed to load leave request details.");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, requestId]);

  if (!isOpen) return null;

  const handleApprove = async () => {
    if (!window.confirm("Are you sure you want to approve this leave request?")) return;
    setIsProcessing(true);
    setActionError("");
    try {
      const updated = await leaveService.approveLeave(requestId);
      setRequest(updated);
      onUpdated?.();
    } catch (err) {
      setActionError(err?.error || "Failed to approve request.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectConfirm = async (id, reason) => {
    const updated = await leaveService.rejectLeave(id, reason);
    setRequest(updated);
    onUpdated?.();
  };

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel your leave request?")) return;
    setIsProcessing(true);
    setActionError("");
    try {
      const updated = await leaveService.cancelLeave(requestId);
      setRequest(updated);
      onUpdated?.();
    } catch (err) {
      setActionError(err?.error || "Failed to cancel request.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadgeClass = (st) => {
    switch (st) {
      case "APPROVED":
        return "status-badge approved";
      case "REJECTED":
        return "status-badge rejected";
      case "CANCELLED":
        return "status-badge cancelled";
      case "PENDING":
      default:
        return "status-badge pending";
    }
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-card md" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h3>Leave Request #{requestId}</h3>
              <p>Review submission parameters, audit logs, and status</p>
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="modal-body">
            {isLoading && (
              <div className="modal-loading-state">
                <div className="spinner-sm" />
                <span>Loading request details...</span>
              </div>
            )}

            {error && <div className="form-error-banner">{error}</div>}
            {actionError && <div className="form-error-banner">{actionError}</div>}

            {!isLoading && request && (
              <div className="detail-sections">
                {/* Status banner */}
                <div className="status-overview-banner">
                  <div className="banner-left">
                    <span className="lbl">Status</span>
                    <span className={getStatusBadgeClass(request.status)}>
                      {request.status}
                    </span>
                  </div>
                  <div className="banner-right">
                    <span className="duration-pill">
                      🗓️ {request.duration_days} Day(s)
                    </span>
                    <span className={`paid-tag ${request.is_paid ? "paid" : "unpaid"}`}>
                      {request.is_paid ? "Paid Leave" : "Unpaid Leave"}
                    </span>
                  </div>
                </div>

                {/* Details grid */}
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Employee</span>
                    <strong>{request.employee_name || "—"}</strong>
                    <span className="sub">{request.employee_code}</span>
                  </div>

                  <div className="detail-item">
                    <span className="label">Department</span>
                    <strong>{request.department_name || "Unassigned"}</strong>
                  </div>

                  <div className="detail-item">
                    <span className="label">Leave Category</span>
                    <strong>{request.leave_type_name}</strong>
                  </div>

                  <div className="detail-item">
                    <span className="label">Period</span>
                    <strong>
                      {request.start_date} → {request.end_date}
                    </strong>
                  </div>

                  <div className="detail-item">
                    <span className="label">Submitted At</span>
                    <span>{new Date(request.submitted_at).toLocaleString()}</span>
                  </div>

                  <div className="detail-item">
                    <span className="label">Reviewed By</span>
                    <span>
                      {request.reviewed_by_name
                        ? `${request.reviewed_by_name} (${new Date(request.reviewed_at).toLocaleDateString()})`
                        : "Pending Review"}
                    </span>
                  </div>
                </div>

                {/* Reason block */}
                <div className="detail-block">
                  <span className="label">Reason / Justification</span>
                  <p className="block-content">{request.reason}</p>
                </div>

                {/* Rejection reason (if any) */}
                {request.rejection_reason && (
                  <div className="detail-block rejection-block">
                    <span className="label">Rejection Reason</span>
                    <p className="block-content danger">{request.rejection_reason}</p>
                  </div>
                )}

                {/* Attachment if present */}
                {request.attachment && (
                  <div className="detail-block">
                    <span className="label">Attachment</span>
                    <a
                      href={request.attachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="attachment-link"
                    >
                      📎 View Uploaded Document
                    </a>
                  </div>
                )}

                {/* Decision Audit Trail */}
                <div className="audit-trail-section">
                  <h4>Decision & Audit Trail</h4>
                  {request.audit_logs && request.audit_logs.length > 0 ? (
                    <div className="audit-timeline">
                      {request.audit_logs.map((log) => (
                        <div key={log.id} className="timeline-item">
                          <div className="timeline-marker" />
                          <div className="timeline-content">
                            <div className="timeline-head">
                              <strong>{log.action}</strong>
                              <span>{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="timeline-actor">
                              Performed by: {log.performed_by_name || "System"}
                            </div>
                            {log.note && <p className="timeline-note">{log.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-subtext">No audit history recorded yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer space-between">
            <div>
              {/* Requester or Admin can cancel pending request */}
              {request?.status === "PENDING" && (isOwnRequest || canApprove) && (
                <button
                  type="button"
                  className="btn secondary danger-text"
                  onClick={handleCancel}
                  disabled={isProcessing}
                >
                  Cancel Request
                </button>
              )}
            </div>

            <div className="actions-right">
              <button
                type="button"
                className="btn secondary"
                onClick={onClose}
                disabled={isProcessing}
              >
                Close
              </button>

              {/* Approval controls for managers / HR on pending requests */}
              {request?.status === "PENDING" && canApprove && !isOwnRequest && (
                <>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => setIsRejectModalOpen(true)}
                    disabled={isProcessing}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn primary success-bg"
                    onClick={handleApprove}
                    disabled={isProcessing}
                  >
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <LeaveRejectModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        requestId={requestId}
        onConfirm={handleRejectConfirm}
      />
    </>
  );
}
