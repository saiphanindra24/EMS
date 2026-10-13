import apiClient from "./apiClient";

export const projectService = {
  /**
   * Lists all projects with optional status, health, and search filters
   */
  async getProjects(params = {}) {
    const res = await apiClient.get("/api/v1/projects/items/", { params });
    return res.data;
  },

  /**
   * Retrieves high-level KPI stats (Total, Active, Completed, Budget, Spent)
   */
  async getProjectStats() {
    const res = await apiClient.get("/api/v1/projects/items/stats/");
    return res.data;
  },

  /**
   * Retrieves detailed project info with milestones and members
   */
  async getProjectDetail(id) {
    const res = await apiClient.get(`/api/v1/projects/items/${id}/`);
    return res.data;
  },

  /**
   * Creates a new project
   */
  async createProject(payload) {
    const res = await apiClient.post("/api/v1/projects/items/", payload);
    return res.data;
  },

  /**
   * Updates an existing project
   */
  async updateProject(id, payload) {
    const res = await apiClient.patch(`/api/v1/projects/items/${id}/`, payload);
    return res.data;
  },

  /**
   * Adds or updates a team member's capacity/role on a project
   */
  async addMember(projectId, payload) {
    const res = await apiClient.post(`/api/v1/projects/items/${projectId}/add-member/`, payload);
    return res.data;
  },

  /**
   * Toggles milestone completion
   */
  async toggleMilestone(milestoneId) {
    const res = await apiClient.post(`/api/v1/projects/milestones/${milestoneId}/toggle-achieved/`);
    return res.data;
  },

  /**
   * Creates a new milestone
   */
  async createMilestone(payload) {
    const res = await apiClient.post("/api/v1/projects/milestones/", payload);
    return res.data;
  },

  /**
   * Lists Daily Work Reports (DWR)
   */
  async getDailyWorkReports(params = {}) {
    const res = await apiClient.get("/api/v1/projects/dwr/", { params });
    return res.data;
  },

  /**
   * Checks if current user has submitted today's work report
   */
  async getTodayReportStatus() {
    const res = await apiClient.get("/api/v1/projects/dwr/today-status/");
    return res.data;
  },

  /**
   * Submits a Daily Work Report
   */
  async submitDailyWorkReport(payload) {
    const res = await apiClient.post("/api/v1/projects/dwr/", payload);
    return res.data;
  },

  /**
   * Reviews (Approve / Request Revision) a Daily Work Report
   */
  async reviewDailyWorkReport(id, payload) {
    const res = await apiClient.post(`/api/v1/projects/dwr/${id}/review/`, payload);
    return res.data;
  },
};

export default projectService;
