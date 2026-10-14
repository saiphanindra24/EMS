import apiClient from "./apiClient";

export const lifecycleService = {
  /**
   * Retrieves training courses catalogue
   */
  async getCourses(params = {}) {
    const res = await apiClient.get("/api/v1/lifecycle/courses/", { params });
    return res.data;
  },

  /**
   * Creates a new training course
   */
  async createCourse(payload) {
    const res = await apiClient.post("/api/v1/lifecycle/courses/", payload);
    return res.data;
  },

  /**
   * Enrolls authenticated employee in course
   */
  async enrollCourse(courseId) {
    const res = await apiClient.post(`/api/v1/lifecycle/courses/${courseId}/enroll/`);
    return res.data;
  },

  /**
   * Retrieves course enrollments (scoped by role/user)
   */
  async getEnrollments(params = {}) {
    const res = await apiClient.get("/api/v1/lifecycle/enrollments/", { params });
    return res.data;
  },

  /**
   * Updates enrollment progress percent and course feedback
   */
  async updateEnrollment(enrollmentId, payload) {
    const res = await apiClient.patch(
      `/api/v1/lifecycle/enrollments/${enrollmentId}/update_progress/`,
      payload
    );
    return res.data;
  },

  /**
   * Retrieves verified professional certifications
   */
  async getCertifications(params = {}) {
    const res = await apiClient.get("/api/v1/lifecycle/certifications/", { params });
    return res.data;
  },

  /**
   * Logs a new employee certification
   */
  async createCertification(payload) {
    const res = await apiClient.post("/api/v1/lifecycle/certifications/", payload);
    return res.data;
  },

  /**
   * Retrieves exit separation requests and clearances
   */
  async getExits(params = {}) {
    const res = await apiClient.get("/api/v1/lifecycle/exits/", { params });
    return res.data;
  },

  /**
   * Submits employee resignation with notice period
   */
  async submitResignation(payload) {
    const res = await apiClient.post("/api/v1/lifecycle/exits/submit_resignation/", payload);
    return res.data;
  },

  /**
   * Manager endorsement of resignation
   */
  async managerReviewExit(exitId, payload) {
    const res = await apiClient.post(
      `/api/v1/lifecycle/exits/${exitId}/manager_review/`,
      payload
    );
    return res.data;
  },

  /**
   * Signs off on a departmental clearance item (IT, Finance, HR, Manager)
   */
  async signClearance(exitId, payload) {
    const res = await apiClient.post(
      `/api/v1/lifecycle/exits/${exitId}/sign_clearance/`,
      payload
    );
    return res.data;
  },

  /**
   * Completes final separation, exit interview, and releases relieving letter
   */
  async completeSeparation(exitId, payload) {
    const res = await apiClient.post(
      `/api/v1/lifecycle/exits/${exitId}/complete_separation/`,
      payload
    );
    return res.data;
  },

  /**
   * Retrieves high-level lifecycle KPI statistics
   */
  async getStats() {
    const res = await apiClient.get("/api/v1/lifecycle/exits/stats/");
    return res.data;
  },
};

export default lifecycleService;
