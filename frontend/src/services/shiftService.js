import api from "./apiClient";

export const shiftService = {
  // 1. Shift Templates
  getShiftTemplates: async (params = {}) => {
    const response = await api.get("/shifts/templates/", { params });
    return response.data?.results || response.data;
  },

  createShiftTemplate: async (data) => {
    const response = await api.post("/shifts/templates/", data);
    return response.data;
  },

  // 2. Roster Assignments
  getRoster: async (params = {}) => {
    const response = await api.get("/shifts/roster/", { params });
    return response.data?.results || response.data;
  },

  getMyRoster: async (params = {}) => {
    const response = await api.get("/shifts/roster/my_roster/", { params });
    return response.data;
  },

  bulkAssignShifts: async (data) => {
    const response = await api.post("/shifts/roster/bulk_assign/", data);
    return response.data;
  },

  // 3. Shift Swap Requests
  getSwapRequests: async (params = {}) => {
    const response = await api.get("/shifts/swaps/", { params });
    return response.data?.results || response.data;
  },

  submitSwapRequest: async (data) => {
    const response = await api.post("/shifts/swaps/submit_swap/", data);
    return response.data;
  },

  respondPeerSwap: async (id, decision, targetAssignmentId = null) => {
    const payload = { decision };
    if (targetAssignmentId) payload.target_assignment_id = targetAssignmentId;
    const response = await api.post(`/shifts/swaps/${id}/peer_respond/`, payload);
    return response.data;
  },

  reviewManagerSwap: async (id, decision, notes = "") => {
    const response = await api.post(`/shifts/swaps/${id}/manager_review/`, {
      decision,
      notes,
    });
    return response.data;
  },

  // 4. Overtime Records
  getOvertimeRecords: async (params = {}) => {
    const response = await api.get("/shifts/overtime/", { params });
    return response.data?.results || response.data;
  },

  submitOvertime: async (data) => {
    const response = await api.post("/shifts/overtime/submit_overtime/", data);
    return response.data;
  },

  reviewOvertime: async (id, decision, notes = "") => {
    const response = await api.post(`/shifts/overtime/${id}/review_overtime/`, {
      decision,
      notes,
    });
    return response.data;
  },

  // 5. Shift & Overtime KPIs
  getShiftStats: async () => {
    const response = await api.get("/shifts/overtime/stats/");
    return response.data;
  },
};

export default shiftService;
