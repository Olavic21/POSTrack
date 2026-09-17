import api from './api';

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const normalizePrime = (prime) => ({
  ...prime,
  id: prime?.id,
  montant: prime?.montant ?? prime?.amount ?? 0,
  date_attribution: prime?.date_attribution ?? prime?.date ?? '',
  statut: prime?.statut ?? prime?.status ?? '',
  pos: prime?.pos ? {
    ...prime.pos,
    nom: prime.pos.nom ?? prime.pos.name ?? '',
    name: prime.pos.name ?? prime.pos.nom ?? '',
    code_pos: prime.pos.code_pos ?? prime.pos.code ?? '',
    partenaire: prime.pos.partenaire ? {
      ...prime.pos.partenaire,
      nom: prime.pos.partenaire.nom ?? prime.pos.partenaire.name ?? '',
      name: prime.pos.partenaire.name ?? prime.pos.partenaire.nom ?? '',
    } : prime.pos.partenaire,
  } : prime?.pos,
  partenaire: prime?.partenaire ? {
    ...prime.partenaire,
    nom: prime.partenaire.nom ?? prime.partenaire.name ?? '',
    name: prime.partenaire.name ?? prime.partenaire.nom ?? '',
  } : prime?.partenaire,
});

export const primeService = {
  getAll: async (params) => {
    const response = await api.get('/primes', { params });
    const list = normalizeList(response.data).map(normalizePrime);
    return { ...response, data: { ...(response.data || {}), items: list } };
  },

  // --- Objectifs DSM ---
  distributeObjectives: (partnerId, payload) =>
    api.post(`/partners/${partnerId}/dsm-objectives/distribute`, payload, { skipPartnerPrefix: true }),

  getObjectives: (partnerId, params) =>
    api.get(`/partners/${partnerId}/dsm-objectives`, { params, skipPartnerPrefix: true }),

  getObjectivesSummary: (partnerId, params) =>
    api.get(`/partners/${partnerId}/dsm-objectives/summary`, { params, skipPartnerPrefix: true }),

  updateObjective: (partnerId, objectiveId, payload) =>
    api.patch(`/partners/${partnerId}/dsm-objectives/${objectiveId}`, payload, { skipPartnerPrefix: true }),

  // --- Calcul primes DSM ---
  calculateDsmPrimes: (partnerId, periodId) =>
    api.post(`/partners/${partnerId}/primes/calculate-dsm`, null, {
      params: { prime_period_id: periodId },
      skipPartnerPrefix: true,
    }),

  getDsmPrimeSummary: (partnerId, periodId) =>
    api.get(`/partners/${partnerId}/primes/dsm-summary`, {
      params: { prime_period_id: periodId },
      skipPartnerPrefix: true,
    }),

  getDsmPrimeDetail: (partnerId, dsmId, periodId) =>
    api.get(`/partners/${partnerId}/primes/dsm/detail`, {
      params: { dsm_id: dsmId, prime_period_id: periodId },
      skipPartnerPrefix: true,
    }),

  // --- Periodes de prime ---
  getPeriods: (partnerId) =>
    api.get(`/partners/${partnerId}/prime-periods`, { skipPartnerPrefix: true }),

  createPeriod: (partnerId, payload) =>
    api.post(`/partners/${partnerId}/prime-periods`, payload, { skipPartnerPrefix: true }),

  updatePeriodStatus: (partnerId, periodId, status) =>
    api.patch(`/partners/${partnerId}/prime-periods/${periodId}/status`, { status }, { skipPartnerPrefix: true }),
};

export default primeService;
