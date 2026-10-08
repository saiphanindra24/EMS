export default function StatusBadge({
  status = "",
  type = "generic",
  label,
  className = "",
}) {
  if (!status && !label) return null;

  const raw = String(status || label).trim();
  const normalized = raw.toUpperCase().replace(/\s+/g, "_");

  // Semantic color and label mapping
  let bg = "#f1f5f9";
  let color = "#475569";
  let border = "#e2e8f0";
  let displayLabel = label || raw;

  switch (normalized) {
    // Attendance statuses
    case "PRESENT":
      bg = "#ecfdf5";
      color = "#047857";
      border = "#a7f3d0";
      displayLabel = "Present";
      break;
    case "LATE":
      bg = "#fefce8";
      color = "#b45309";
      border = "#fde68a";
      displayLabel = "Late";
      break;
    case "HALF_DAY":
      bg = "#eff6ff";
      color = "#1d4ed8";
      border = "#bfdbfe";
      displayLabel = "Half Day";
      break;
    case "ABSENT":
      bg = "#fef2f2";
      color = "#b91c1c";
      border = "#fecaca";
      displayLabel = "Absent";
      break;
    case "ON_LEAVE":
      bg = "#faf5ff";
      color = "#7e22ce";
      border = "#e9d5ff";
      displayLabel = "On Leave";
      break;

    // Task statuses
    case "TODO":
      bg = "#f1f5f9";
      color = "#475569";
      border = "#cbd5e1";
      displayLabel = "To Do";
      break;
    case "IN_PROGRESS":
      bg = "#eff6ff";
      color = "#1d4ed8";
      border = "#bfdbfe";
      displayLabel = "In Progress";
      break;
    case "IN_REVIEW":
      bg = "#fefce8";
      color = "#a16207";
      border = "#fde68a";
      displayLabel = "In Review";
      break;
    case "COMPLETED":
      bg = "#ecfdf5";
      color = "#047857";
      border = "#a7f3d0";
      displayLabel = "Completed";
      break;
    case "CANCELLED":
      bg = "#f8fafc";
      color = "#94a3b8";
      border = "#e2e8f0";
      displayLabel = "Cancelled";
      break;

    // Priorities
    case "LOW":
      bg = "#f0fdf4";
      color = "#15803d";
      border = "#bbf7d0";
      displayLabel = "Low";
      break;
    case "MEDIUM":
      bg = "#eff6ff";
      color = "#1d4ed8";
      border = "#bfdbfe";
      displayLabel = "Medium";
      break;
    case "HIGH":
      bg = "#fff7ed";
      color = "#c2410c";
      border = "#fed7aa";
      displayLabel = "High";
      break;
    case "URGENT":
      bg = "#fef2f2";
      color = "#b91c1c";
      border = "#fecaca";
      displayLabel = "Urgent";
      break;

    // Leave statuses
    case "PENDING":
      bg = "#fefce8";
      color = "#a16207";
      border = "#fde68a";
      displayLabel = "Pending";
      break;
    case "APPROVED":
      bg = "#ecfdf5";
      color = "#047857";
      border = "#a7f3d0";
      displayLabel = "Approved";
      break;
    case "REJECTED":
      bg = "#fef2f2";
      color = "#b91c1c";
      border = "#fecaca";
      displayLabel = "Rejected";
      break;

    // Roles
    case "SUPER_ADMIN":
      bg = "#fae8ff";
      color = "#86198f";
      border = "#f5d0fe";
      displayLabel = "Super Admin";
      break;
    case "HR_ADMIN":
      bg = "#e0e7ff";
      color = "#3730a3";
      border = "#c7d2fe";
      displayLabel = "HR Admin";
      break;
    case "MANAGER":
      bg = "#e0f2fe";
      color = "#0369a1";
      border = "#bae6fd";
      displayLabel = "Manager";
      break;
    case "EMPLOYEE":
      bg = "#f1f5f9";
      color = "#475569";
      border = "#e2e8f0";
      displayLabel = "Employee";
      break;

    // Active / Inactive
    case "ACTIVE":
    case "TRUE":
      bg = "#ecfdf5";
      color = "#047857";
      border = "#a7f3d0";
      displayLabel = "Active";
      break;
    case "INACTIVE":
    case "FALSE":
      bg = "#f8fafc";
      color = "#64748b";
      border = "#e2e8f0";
      displayLabel = "Inactive";
      break;

    default:
      break;
  }

  return (
    <span
      className={`status-badge-standard ${className}`}
      role="status"
      aria-label={`${type} status: ${displayLabel}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3px 9px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: "0.2px",
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
        whiteSpace: "nowrap",
      }}
    >
      {displayLabel}
    </span>
  );
}
