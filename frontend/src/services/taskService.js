import { apiClient } from "./apiClient";

export const taskService = {
  async getTasks(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append("page", params.page);
    if (params.page_size) query.append("page_size", params.page_size);
    if (params.search) query.append("search", params.search);
    if (params.status) query.append("status", params.status);
    if (params.priority) query.append("priority", params.priority);
    if (params.department) query.append("department", params.department);
    if (params.assignee) query.append("assignee", params.assignee);
    if (params.overdue) query.append("overdue", params.overdue);
    if (params.ordering) query.append("ordering", params.ordering);
    if (params.include_archived) query.append("include_archived", params.include_archived);

    const qs = query.toString();
    const endpoint = `/api/v1/tasks/${qs ? `?${qs}` : ""}`;
    const response = await apiClient(endpoint);
    if (!response.ok) {
      throw new Error("Failed to fetch tasks.");
    }
    return response.json();
  },

  async getTask(id) {
    const response = await apiClient(`/api/v1/tasks/${id}/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch task #${id}`);
    }
    return response.json();
  },

  async createTask(data) {
    const response = await apiClient("/api/v1/tasks/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async updateTask(id, data) {
    const response = await apiClient(`/api/v1/tasks/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async archiveTask(id) {
    const response = await apiClient(`/api/v1/tasks/${id}/`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      const result = await response.json().catch(() => ({}));
      throw result;
    }
    return true;
  },

  async getComments(taskId) {
    const response = await apiClient(`/api/v1/tasks/${taskId}/comments/`);
    if (!response.ok) {
      throw new Error("Failed to fetch task comments.");
    }
    return response.json();
  },

  async addComment(taskId, content) {
    const response = await apiClient(`/api/v1/tasks/${taskId}/comments/`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async getTaskStats() {
    const response = await apiClient("/api/v1/tasks/stats/");
    if (!response.ok) {
      throw new Error("Failed to fetch task statistics.");
    }
    return response.json();
  },
};
