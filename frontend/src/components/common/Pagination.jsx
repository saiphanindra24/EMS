export default function Pagination({
  page = 1,
  totalPages = 1,
  totalCount = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  itemName = "records",
  isLoading = false,
}) {
  if (totalCount === 0 && totalPages <= 1) return null;

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <nav
      className="emp-pagination"
      aria-label="Pagination Navigation"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        padding: "12px 16px",
        borderTop: "1px solid #edf0f4",
        background: "#ffffff",
        fontSize: "13px",
        color: "#64748b",
      }}
    >
      <div className="pagination-count">
        Showing <strong>{totalCount > 0 ? `${startRecord}–${endRecord}` : 0}</strong> of{" "}
        <strong>{totalCount}</strong> {itemName}
      </div>

      <div
        className="pagination-nav"
        style={{ display: "flex", alignItems: "center", gap: "8px" }}
      >
        <button
          type="button"
          className="page-btn"
          onClick={() => onPageChange && onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          aria-label="Previous page"
          style={{
            padding: "6px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            background: page <= 1 ? "#f1f5f9" : "#ffffff",
            cursor: page <= 1 ? "not-allowed" : "pointer",
            fontSize: "12px",
            fontWeight: 500,
            color: page <= 1 ? "#94a3b8" : "#334155",
          }}
        >
          ← Previous
        </button>

        <span style={{ fontSize: "12px", color: "#475569" }}>
          Page <strong>{page}</strong> of <strong>{totalPages || 1}</strong>
        </span>

        <button
          type="button"
          className="page-btn"
          onClick={() => onPageChange && onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          aria-label="Next page"
          style={{
            padding: "6px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            background: page >= totalPages ? "#f1f5f9" : "#ffffff",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            fontSize: "12px",
            fontWeight: 500,
            color: page >= totalPages ? "#94a3b8" : "#334155",
          }}
        >
          Next →
        </button>
      </div>

      {onPageSizeChange && (
        <div
          className="pagination-per-page"
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
        >
          <label htmlFor="per-page-select">Per page:</label>
          <select
            id="per-page-select"
            className="emp-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={isLoading}
            style={{
              padding: "4px 8px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              background: "#ffffff",
              fontSize: "12px",
              color: "#334155",
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )}
    </nav>
  );
}
