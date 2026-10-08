export default function LoadingSpinner({
  message = "Loading...",
  subtext = "",
  size = "md",
  className = "",
}) {
  const spinnerSizes = {
    sm: "20px",
    md: "36px",
    lg: "52px",
  };

  const dimension = spinnerSizes[size] || spinnerSizes.md;

  return (
    <div
      className={`loading-state-container ${className}`}
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: size === "sm" ? "16px" : "48px 16px",
        gap: "12px",
        textAlign: "center",
      }}
    >
      <div
        className="spinner-circle"
        style={{
          width: dimension,
          height: dimension,
          border: "3px solid #e2e8f0",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span
          style={{
            fontSize: size === "sm" ? "12px" : "14px",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >
          {message}
        </span>
        {subtext && (
          <span style={{ fontSize: "12px", color: "#64748b" }}>{subtext}</span>
        )}
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
