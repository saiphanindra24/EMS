import { apiClient } from "./apiClient";

export const reportService = {
  async getOverview() {
    const res = await apiClient("/api/v1/reports/overview/");
    if (!res.ok) {
      throw new Error("Failed to load reports overview.");
    }
    return res.json();
  },

  async getReport(reportType, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    const endpoint = `/api/v1/reports/${reportType}/${qs ? `?${qs}` : ""}`;
    const res = await apiClient(endpoint);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to load ${reportType} report.`);
    }
    return res.json();
  },

  async exportReport(reportType, format, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "" && key !== "page" && key !== "page_size") {
        query.append(key, val);
      }
    });
    query.append("export", format);

    const qs = query.toString();
    const endpoint = `/api/v1/reports/${reportType}/?${qs}`;
    const res = await apiClient(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to export ${reportType} report.`);
    }

    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition");
    let filename = `emwts_${reportType}_report.${format}`;
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
    return true;
  },
};
