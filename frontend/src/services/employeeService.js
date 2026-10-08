import { apiClient } from "./apiClient";

export const employeeService = {
  // Employee APIs
  async getEmployees(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append("page", params.page);
    if (params.page_size) query.append("page_size", params.page_size);
    if (params.search) query.append("search", params.search);
    if (params.department) query.append("department", params.department);
    if (params.status) query.append("status", params.status);
    if (params.employment_type) query.append("employment_type", params.employment_type);
    if (params.work_location) query.append("work_location", params.work_location);
    if (params.ordering) query.append("ordering", params.ordering);
    if (params.include_archived) query.append("include_archived", params.include_archived);
    if (params.manager) query.append("manager", params.manager);

    const queryString = query.toString();
    const endpoint = `/api/v1/employees/${queryString ? `?${queryString}` : ""}`;
    const response = await apiClient(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch employees: ${response.statusText}`);
    }
    return response.json();
  },

  async getEmployee(id) {
    const response = await apiClient(`/api/v1/employees/${id}/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch employee #${id}`);
    }
    return response.json();
  },

  async createEmployee(data) {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    const response = await apiClient("/api/v1/employees/", {
      method: "POST",
      body: isFormData ? data : JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async updateEmployee(id, data) {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    const response = await apiClient(`/api/v1/employees/${id}/`, {
      method: "PATCH",
      body: isFormData ? data : JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async deactivateEmployee(id) {
    const response = await apiClient(`/api/v1/employees/${id}/deactivate/`, {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async reactivateEmployee(id) {
    const response = await apiClient(`/api/v1/employees/${id}/reactivate/`, {
      method: "POST",
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  // Department APIs
  async getDepartments(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append("page", params.page);
    if (params.page_size) query.append("page_size", params.page_size || "100");
    if (params.search) query.append("search", params.search);
    if (params.is_active !== undefined) query.append("is_active", params.is_active);
    if (params.ordering) query.append("ordering", params.ordering);

    const queryString = query.toString();
    const endpoint = `/api/v1/departments/${queryString ? `?${queryString}` : ""}`;
    const response = await apiClient(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch departments: ${response.statusText}`);
    }
    return response.json();
  },

  async getDepartment(id) {
    const response = await apiClient(`/api/v1/departments/${id}/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch department #${id}`);
    }
    return response.json();
  },

  async createDepartment(data) {
    const response = await apiClient("/api/v1/departments/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async updateDepartment(id, data) {
    const response = await apiClient(`/api/v1/departments/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      throw result;
    }
    return result;
  },

  async deleteDepartment(id) {
    const response = await apiClient(`/api/v1/departments/${id}/`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      const result = await response.json().catch(() => ({}));
      throw result;
    }
    return true;
  },

  async getDepartmentEmployees(id) {
    const response = await apiClient(`/api/v1/departments/${id}/employees/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch employees for department #${id}`);
    }
    return response.json();
  },
};
