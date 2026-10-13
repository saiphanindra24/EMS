import apiClient from "./apiClient";

export const expenseService = {
  /**
   * Retrieves all corporate expense claims with optional filtering
   */
  async getExpenseClaims(params = {}) {
    const res = await apiClient.get("/api/v1/expenses/claims/", { params });
    return res.data;
  },

  /**
   * Retrieves claims belonging to the authenticated employee
   */
  async getMyClaims() {
    const res = await apiClient.get("/api/v1/expenses/claims/my_claims/");
    return res.data;
  },

  /**
   * Retrieves high-level KPI and category breakdown statistics
   */
  async getExpenseStats() {
    const res = await apiClient.get("/api/v1/expenses/claims/stats/");
    return res.data;
  },

  /**
   * Submits a new expense claim
   */
  async createClaim(payload) {
    const res = await apiClient.post("/api/v1/expenses/claims/", payload);
    return res.data;
  },

  /**
   * Updates an existing draft claim
   */
  async updateClaim(id, payload) {
    const res = await apiClient.patch(`/api/v1/expenses/claims/${id}/`, payload);
    return res.data;
  },

  /**
   * Manager review: Approve or Reject with feedback
   */
  async managerReview(claimId, payload) {
    const res = await apiClient.post(
      `/api/v1/expenses/claims/${claimId}/manager_review/`,
      payload
    );
    return res.data;
  },

  /**
   * Finance review & disbursement: Approve, Reject, or Reimburse
   */
  async financeSettlement(claimId, payload) {
    const res = await apiClient.post(
      `/api/v1/expenses/claims/${claimId}/finance_settlement/`,
      payload
    );
    return res.data;
  },

  /**
   * Fetches active client projects for associating billable expenses
   */
  async getProjects() {
    const res = await apiClient.get("/api/v1/projects/items/");
    return res.data;
  },
};

export default expenseService;
