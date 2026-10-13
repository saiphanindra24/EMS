import apiClient from "./apiClient";

export const payrollService = {
  /**
   * Fetches the top-level payroll KPI summary for admin or employee view
   */
  async getSummary() {
    const res = await apiClient.get("/api/v1/payroll/summary/");
    return res.data;
  },

  /**
   * Lists historical payroll cycles/runs (Admin only)
   */
  async getRuns() {
    const res = await apiClient.get("/api/v1/payroll/runs/");
    return res.data;
  },

  /**
   * Triggers a new monthly payroll processing run (Admin only)
   */
  async processPayroll(payload) {
    const res = await apiClient.post("/api/v1/payroll/runs/process/", payload);
    return res.data;
  },

  /**
   * Marks a payroll run and its payslips as disbursed / paid (Admin only)
   */
  async disbursePayroll(runId, payload = {}) {
    const res = await apiClient.post(`/api/v1/payroll/runs/${runId}/disburse/`, payload);
    return res.data;
  },

  /**
   * Retrieves payslips (role-filtered by server)
   */
  async getPayslips(params = {}) {
    const res = await apiClient.get("/api/v1/payroll/payslips/", { params });
    return res.data;
  },

  /**
   * Retrieves a single detailed payslip
   */
  async getPayslipDetail(id) {
    const res = await apiClient.get(`/api/v1/payroll/payslips/${id}/`);
    return res.data;
  },

  /**
   * Retrieves salary structures (Admin only)
   */
  async getSalaryStructures(params = {}) {
    const res = await apiClient.get("/api/v1/payroll/structures/", { params });
    return res.data;
  },

  /**
   * Updates an employee's salary structure (Admin only)
   */
  async updateSalaryStructure(id, payload) {
    const res = await apiClient.patch(`/api/v1/payroll/structures/${id}/`, payload);
    return res.data;
  },
};

export default payrollService;
