import { apiClient } from "./apiClient";

export const attendanceService = {
  // Get current user's attendance status today
  async getTodayAttendance() {
    const response = await apiClient("/api/v1/attendance/today/");
    if (!response.ok) {
      throw new Error("Failed to fetch today's attendance status.");
    }
    return response.json();
  },

  // Check-in (backend controls timestamp)
  async checkIn(notes = "") {
    const response = await apiClient("/api/v1/attendance/check-in/", {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  // Check-out (backend controls timestamp)
  async checkOut(notes = "") {
    const response = await apiClient("/api/v1/attendance/check-out/", {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  // List attendance records with filters and pagination
  async getAttendanceRecords(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append("page", params.page);
    if (params.page_size) query.append("page_size", params.page_size);
    if (params.date) query.append("date", params.date);
    if (params.start_date) query.append("start_date", params.start_date);
    if (params.end_date) query.append("end_date", params.end_date);
    if (params.status) query.append("status", params.status);
    if (params.employee) query.append("employee", params.employee);
    if (params.department) query.append("department", params.department);

    const qs = query.toString();
    const endpoint = `/api/v1/attendance/${qs ? `?${qs}` : ""}`;
    const response = await apiClient(endpoint);
    if (!response.ok) {
      throw new Error("Failed to fetch attendance history.");
    }
    return response.json();
  },

  // Attendance stats for today
  async getAttendanceStats() {
    const response = await apiClient("/api/v1/attendance/stats/");
    if (!response.ok) {
      throw new Error("Failed to fetch attendance statistics.");
    }
    return response.json();
  },

  // Authorized correction (HR / Super Admin only)
  async correctAttendance(id, data) {
    const response = await apiClient(`/api/v1/attendance/${id}/correct/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  // Audit history of corrections
  async getCorrectionHistory(id) {
    const response = await apiClient(`/api/v1/attendance/${id}/corrections/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch audit corrections for record #${id}`);
    }
    return response.json();
  },

  // Corporate work schedule
  async getWorkSchedule() {
    const response = await apiClient("/api/v1/attendance/schedule/");
    if (!response.ok) {
      throw new Error("Failed to load corporate work schedule.");
    }
    return response.json();
  },
};
