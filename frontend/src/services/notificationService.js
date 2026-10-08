import { apiClient } from "./apiClient";

export const notificationService = {
  async getNotifications(params = {}) {
    const query = new URLSearchParams();
    if (params.unread_only) query.append("unread_only", params.unread_only);
    if (params.type) query.append("type", params.type);
    const qs = query.toString();
    const response = await apiClient(`/api/v1/notifications/${qs ? `?${qs}` : ""}`);
    if (!response.ok) {
      throw new Error("Failed to fetch notifications.");
    }
    return response.json();
  },

  async getUnreadCount() {
    const response = await apiClient("/api/v1/notifications/unread-count/");
    if (!response.ok) {
      throw new Error("Failed to fetch unread notification count.");
    }
    return response.json();
  },

  async markAsRead(id) {
    const response = await apiClient(`/api/v1/notifications/${id}/read/`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Failed to mark notification as read.");
    }
    return response.json();
  },

  async markAllAsRead() {
    const response = await apiClient("/api/v1/notifications/mark-all-read/", {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Failed to mark all notifications as read.");
    }
    return response.json();
  },

  async sendAnnouncement(title, message, target_role = null) {
    const payload = { title, message };
    if (target_role) payload.target_role = target_role;
    const response = await apiClient("/api/v1/notifications/announcement/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },
};
