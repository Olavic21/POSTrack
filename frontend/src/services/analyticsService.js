import api from './api';

export const analyticsService = {
  getDashboard: (partnerId, dsmId) => api.get(`/partners/${partnerId}/analytics/dashboard`, { params: dsmId ? { dsm_id: dsmId } : {}, skipPartnerPrefix: true }),
  getSalesSummary: (partnerId) => api.get(`/partners/${partnerId}/analytics/sales-summary`, { skipPartnerPrefix: true }),
  listSalesTargets: (partnerId) => api.get(`/partners/${partnerId}/analytics/sales-targets`, { skipPartnerPrefix: true }),
  upsertSalesTarget: (partnerId, payload) => api.post(`/partners/${partnerId}/analytics/sales-targets`, payload, { skipPartnerPrefix: true }),
  getLoadingSummary: (partnerId, params) => api.get(`/partners/${partnerId}/analytics/loading-summary`, { params, skipPartnerPrefix: true }),
  getMonthlyTable: (partnerId) => api.get(`/partners/${partnerId}/analytics/monthly-table`, { skipPartnerPrefix: true }),
  getDSMSummary: (partnerId) => api.get(`/partners/${partnerId}/analytics/dsm-summary`, { skipPartnerPrefix: true }),

  // --- Phase 1 : KPI objectifs / réalisations ---
  getKpiObjectives: (partnerId, params) => api.get(`/partners/${partnerId}/analytics/kpi/objectives`, { params, skipPartnerPrefix: true }),
  getKpiRealisations: (partnerId, params) => api.get(`/partners/${partnerId}/analytics/kpi/realisations`, { params, skipPartnerPrefix: true }),
  getKpiDsmBothCriteria: (partnerId, params) => api.get(`/partners/${partnerId}/analytics/kpi/dsm-both-criteria`, { params, skipPartnerPrefix: true }),

  // --- Phase 1 : BTS / SIM / production financière ---
  getBtsProduction: (partnerId) => api.get(`/partners/${partnerId}/analytics/bts-production`, { skipPartnerPrefix: true }),
  getBtsEtat: (partnerId) => api.get(`/partners/${partnerId}/analytics/bts-etat`, { skipPartnerPrefix: true }),
  getSimLinkage: (partnerId) => api.get(`/partners/${partnerId}/analytics/sim-linkage`, { skipPartnerPrefix: true }),
  getDsmProductionFinanciere: (partnerId, dsmId, params) => api.get(`/partners/${partnerId}/analytics/dsm/${dsmId}/production-financiere`, { params, skipPartnerPrefix: true }),

  // --- Phase 1 : suivi quotidien & table des ventes ---
  getDailyTracking: (partnerId, params) => api.get(`/partners/${partnerId}/analytics/tracking/daily`, { params, skipPartnerPrefix: true }),
  createDailyTracking: (partnerId, payload) => api.post(`/partners/${partnerId}/analytics/tracking/daily`, payload, { skipPartnerPrefix: true }),
  updateDailyTracking: (partnerId, perfId, payload) => api.put(`/partners/${partnerId}/analytics/tracking/daily/${perfId}`, payload, { skipPartnerPrefix: true }),
  deleteDailyTracking: (partnerId, perfId) => api.delete(`/partners/${partnerId}/analytics/tracking/daily/${perfId}`, { skipPartnerPrefix: true }),
  getSalesTable: (partnerId, params) => api.get(`/partners/${partnerId}/analytics/sales/table`, { params, skipPartnerPrefix: true }),

  // --- Prime DSM canonique (via /primes/dsm-summary) — évite alias déprécié /primes/dsm/summary ---
  getDsmPrimeSummary: (partnerId, params) => api.get(`/partners/${partnerId}/primes/dsm-summary`, { params, skipPartnerPrefix: true }),
  getDsmPrimeDetail: (partnerId, params) => api.get(`/partners/${partnerId}/primes/dsm/detail`, { params, skipPartnerPrefix: true }),

};

export default analyticsService;
