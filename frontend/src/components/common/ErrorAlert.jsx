export default function ErrorAlert({
  message,
  onRetry = null,
  onDismiss = null,
  className = "",
}) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`alert-feedback error ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 16px",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: "8px",
        color: "#991b1b",
        fontSize: "13px",
        margin: "8px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span aria-hidden="true" style={{ fontSize: "16px" }}>⚠️</span>
        <span>{message}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 600,
              border: "1px solid #f87171",
              borderRadius: "6px",
              background: "#ffffff",
              color: "#b91c1c",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            style={{
              background: "transparent",
              border: "none",
              color: "#991b1b",
              cursor: "pointer",
              fontSize: "14px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
