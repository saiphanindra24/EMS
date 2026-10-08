export default function EmptyState({
  icon = "📂",
  title = "No data found",
  description = "There are no records matching your criteria.",
  actionText = "",
  onAction = null,
  className = "",
}) {
  return (
    <div
      className={`empty-state-card ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        background: "#ffffff",
        borderRadius: "12px",
        border: "1px dashed #cbd5e1",
        margin: "12px 0",
      }}
    >
      <div
        style={{
          fontSize: "40px",
          marginBottom: "12px",
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3
        style={{
          margin: "0 0 6px",
          fontSize: "16px",
          fontWeight: 600,
          color: "#1e293b",
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            margin: "0 0 18px",
            fontSize: "13px",
            color: "#64748b",
            maxWidth: "400px",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn-primary"
          style={{
            padding: "8px 18px",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "8px",
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
