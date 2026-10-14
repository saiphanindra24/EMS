import apiClient from "./apiClient";

export const performanceService = {
  /**
   * Retrieves the current active appraisal cycle
   */
  async getActiveCycle() {
    const res = await apiClient.get("/api/v1/performance/cycles/active/");
    return res.data;
  },

  /**
   * Retrieves all appraisal cycles
   */
  async getCycles() {
    const res = await apiClient.get("/api/v1/performance/cycles/");
    return res.data;
  },

  /**
   * Retrieves KPI goals (scoped by role/user)
   */
  async getGoals(params = {}) {
    const res = await apiClient.get("/api/v1/performance/goals/", { params });
    return res.data;
  },

  /**
   * Creates a new performance goal / KPI
   */
  async createGoal(payload) {
    const res = await apiClient.post("/api/v1/performance/goals/", payload);
    return res.data;
  },

  /**
   * Updates goal progress percentage
   */
  async updateGoalProgress(goalId, currentProgress) {
    const res = await apiClient.patch(
      `/api/v1/performance/goals/${goalId}/update_progress/`,
      { current_progress: currentProgress }
    );
    return res.data;
  },

  /**
   * Retrieves appraisal reviews (scoped by role/manager)
   */
  async getReviews(params = {}) {
    const res = await apiClient.get("/api/v1/performance/reviews/", { params });
    return res.data;
  },

  /**
   * Retrieves logged-in user's personal reviews
   */
  async getMyReviews() {
    const res = await apiClient.get("/api/v1/performance/reviews/my_reviews/");
    return res.data;
  },

  /**
   * Retrieves performance high-level stats & leaderboard
   */
  async getStats() {
    const res = await apiClient.get("/api/v1/performance/reviews/stats/");
    return res.data;
  },

  /**
   * Submits self-assessment rating and achievements
   */
  async submitSelfReview(reviewId, payload) {
    const res = await apiClient.post(
      `/api/v1/performance/reviews/${reviewId}/self_submit/`,
      payload
    );
    return res.data;
  },

  /**
   * Submits manager evaluation score and promotion recommendation
   */
  async submitManagerReview(reviewId, payload) {
    const res = await apiClient.post(
      `/api/v1/performance/reviews/${reviewId}/manager_submit/`,
      payload
    );
    return res.data;
  },

  /**
   * Submits 360-degree peer feedback
   */
  async submit360Feedback(payload) {
    const res = await apiClient.post("/api/v1/performance/feedback360/", payload);
    return res.data;
  },
};

export default performanceService;
