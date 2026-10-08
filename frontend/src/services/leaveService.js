import { apiClient } from "./apiClient";

export const leaveService = {
  async getLeaveTypes(params = {}) {
    const query = new URLSearchParams();
    if (params.active_only) query.append("active_only", params.active_only);
    const qs = query.toString();
    const response = await apiClient(`/api/v1/leave/types/${qs ? `?${qs}` : ""}`);
    if (!response.ok) {
      throw new Error("Failed to fetch leave types.");
    }
    return response.json();
  },

  async getLeaves(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append("status", params.status);
    if (params.scope) query.append("scope", params.scope);
    if (params.leave_type) query.append("leave_type", params.leave_type);
    if (params.department) query.append("department", params.department);
    if (params.employee) query.append("employee", params.employee);
    if (params.start_date) query.append("start_date", params.start_date);
    if (params.end_date) query.append("end_date", params.end_date);

    const qs = query.toString();
    const response = await apiClient(`/api/v1/leave/${qs ? `?${qs}` : ""}`);
    if (!response.ok) {
      throw new Error("Failed to fetch leave requests.");
    }
    return response.json();
  },

  async getLeaveRequests(params = {}) {
    return this.getLeaves(params);
  },

  async getLeave(id) {
    const response = await apiClient(`/api/v1/leave/${id}/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch leave request #${id}`);
    }
    return response.json();
  },

  async createLeave(data) {
    const isFormData = data instanceof FormData;
    const options = {
      method: "POST",
      body: isFormData ? data : JSON.stringify(data),
    };
    if (isFormData) {
      options.headers = {}; // Let browser set multipart boundary
    }
    const response = await apiClient("/api/v1/leave/", options);
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async approveLeave(id) {
    const response = await apiClient(`/api/v1/leave/${id}/approve/`, {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async rejectLeave(id, rejection_reason) {
    const response = await apiClient(`/api/v1/leave/${id}/reject/`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async cancelLeave(id) {
    const response = await apiClient(`/api/v1/leave/${id}/cancel/`, {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async getLeaveBalances(params = {}) {
    const query = new URLSearchParams();
    if (params.employee) query.append("employee", params.employee);
    if (params.year) query.append("year", params.year);
    const qs = query.toString();
    const response = await apiClient(`/api/v1/leave/balances/${qs ? `?${qs}` : ""}`);
    if (!response.ok) {
      throw new Error("Failed to fetch leave balances.");
    }
    return response.json();
  },

  async getLeaveSummary() {
    const response = await apiClient("/api/v1/leave/summary/");
    if (!response.ok) {
      throw new Error("Failed to fetch leave summary.");
    }
    return response.json();
  },

  async getLeaveCalendar(params = {}) {
    const query = new URLSearchParams();
    if (params.start_date) query.append("start_date", params.start_date);
    if (params.end_date) query.append("end_date", params.end_date);
    const qs = query.toString();
    const response = await apiClient(`/api/v1/leave/calendar/${qs ? `?${qs}` : ""}`);
    if (!response.ok) {
      throw new Error("Failed to fetch leave calendar.");
    }
    return response.json();
  },
};
