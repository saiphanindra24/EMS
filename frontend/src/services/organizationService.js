import { apiClient } from "./apiClient";

export const organizationService = {
  // ── Organization Core Settings ──
  async getSettings() {
    const res = await apiClient("/api/v1/organization/settings/");
    if (!res.ok) throw new Error("Failed to load organization settings.");
    return res.json();
  },

  async updateSettings(data) {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    const res = await apiClient("/api/v1/organization/settings/", {
      method: "PATCH",
      body: isFormData ? data : JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw result;
    return result;
  },

  // ── Work Schedule ──
  async getSchedule() {
    const res = await apiClient("/api/v1/organization/schedule/");
    if (!res.ok) throw new Error("Failed to load work schedule.");
    return res.json();
  },

  async updateSchedule(data) {
    const res = await apiClient("/api/v1/organization/schedule/", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw result;
    return result;
  },

  // ── Holiday Calendar ──
  async getHolidays(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await apiClient(`/api/v1/organization/holidays/${query ? `?${query}` : ""}`);
    if (!res.ok) throw new Error("Failed to load holidays.");
    return res.json();
  },

  async createHoliday(data) {
    const res = await apiClient("/api/v1/organization/holidays/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw result;
    return result;
  },

  async deleteHoliday(id) {
    const res = await apiClient(`/api/v1/organization/holidays/${id}/`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 204) throw new Error("Failed to delete holiday.");
    return true;
  },

  // ── Leave Types ──
  async getLeaveTypes() {
    const res = await apiClient("/api/v1/organization/leave-types/");
    if (!res.ok) throw new Error("Failed to load leave types.");
    return res.json();
  },

  async createLeaveType(data) {
    const res = await apiClient("/api/v1/organization/leave-types/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw result;
    return result;
  },

  async updateLeaveType(id, data) {
    const res = await apiClient(`/api/v1/organization/leave-types/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw result;
    return result;
  },

  async deactivateLeaveType(id) {
    const res = await apiClient(`/api/v1/organization/leave-types/${id}/`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 204) throw new Error("Failed to deactivate leave category.");
    return true;
  },

  // ── Notification Preferences ──
  async getNotificationPreferences() {
    const res = await apiClient("/api/v1/organization/notifications/preferences/");
    if (!res.ok) throw new Error("Failed to load notification preferences.");
    return res.json();
  },

  async updateNotificationPreferences(data) {
    const res = await apiClient("/api/v1/organization/notifications/preferences/", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw result;
    return result;
  },

  // ── Users & Roles ──
  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await apiClient(`/api/v1/organization/users/${query ? `?${query}` : ""}`);
    if (!res.ok) throw new Error("Failed to load organization users.");
    return res.json();
  },

  async updateUserRole(userId, role) {
    const res = await apiClient(`/api/v1/organization/users/${userId}/`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw result;
    return result;
  },

  async toggleUserStatus(userId, isActive) {
    const res = await apiClient(`/api/v1/organization/users/${userId}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw result;
    return result;
  },

  // ── Audit Logs ──
  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await apiClient(`/api/v1/organization/audit-logs/${query ? `?${query}` : ""}`);
    if (!res.ok) throw new Error("Failed to load administration audit logs.");
    return res.json();
  },

  // ── Personal Profile Settings ──
  async getProfile() {
    const res = await apiClient("/api/v1/auth/profile/");
    if (!res.ok) throw new Error("Failed to load user profile.");
    return res.json();
  },

  async updateProfile(data) {
    const res = await apiClient("/api/v1/auth/profile/", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw result;
    return result;
  },

  async changePassword(data) {
    const res = await apiClient("/api/v1/auth/change-password/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw result;
    return result;
  },
};
