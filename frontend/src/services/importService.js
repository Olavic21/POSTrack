import api from './api';

/**
 * Service du Module A3 -- Import Excel centralise (ImportBatch).
 *
 * Conformement au contrat Frontend (TEAM_DEVELOPMENT 7) :
 *   - POST  /partners/{id}/imports/validate
 *   - POST  /partners/{id}/imports/{batch_id}/apply
 *   - GET   /partners/{id}/imports/templates/{entity_type}  (gabarit officiel)
 *
 * Le prefixe /partners/{id}/ est automatiquement ajoute par l'intercepteur
 * Axios (services/api.js) a partir du partner_context_id.
 *
 * Source de verite unique : aucune donnee d'import n'est simulée cote
 * client. En cas d'indisponibilite du backend, les erreurs sont propagees
 * a l'UI (etats error dedies).
 */

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;

export const importService = {
  /**
   * Etape 3 -- Depot & Validation du fichier.
   * @param {string} entityType
   * @param {File} file
   */
  async validate(entityType, file) {
    const body = new FormData();
    body.append('file', file);
    body.append('entity_type', entityType);

    const response = await importServicePost('/imports/validate', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalizeBatch(unwrap(response), entityType, file?.name);
  },

  /**
   * Etape 5 -- Confirmation / Commit du lot valide.
   * @param {string} batchId
   */
  async apply(batchId) {
    const response = await api.post(`/imports/${batchId}/apply`, {});
    const result = unwrap(response);
    if (result && typeof result === 'object') return result;
    return { id: batchId, status: 'APPLIED' };
  },

  /** Consultation d'un lot (utile pour reprendre un import en cours). */
  async getBatch(batchId) {
    const response = await api.get(`/imports/${batchId}`);
    return normalizeBatch(unwrap(response));
  },

  /**
   * Etape 1 -- Telechargement du gabarit Excel officiel.
   * Passe par Axios afin d'embarquer le jeton Bearer (un simple <a href>
   * declencherait une 401 faute d'en-tete Authorization).
   * @param {string} entityType
   * @returns {Promise<{ blob: Blob, fileName: string }>}
   */
  async downloadTemplate(entityType) {
    const response = await api.get(`/imports/templates/${encodeURIComponent(entityType)}`, {
      responseType: 'blob',
    });
    const disposition = String(response.headers?.['content-disposition'] || '');
    const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const fileName = match
      ? decodeURIComponent(match[1])
      : `gabarit-${entityType.toLowerCase()}.xlsx`;
    return { blob: response.data, fileName };
  },

  /**
   * Import direct d'un fichier ZONE (format geographique BTS).
   * @param {File} file
   */
  async importZone(file) {
    const body = new FormData();
    body.append('file', file);

    const response = await importServicePost('/imports/zone', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(response);
  },

  /**
   * Import direct d'un fichier STOCK (format hierarchique DSM->POS).
   * @param {File} file
   */
  async importStock(file) {
    const body = new FormData();
    body.append('file', file);

    const response = await importServicePost('/imports/stock', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(response);
  },
};

/**
 * Petit injecteur permettant de tester le service sans dependre du client Axios
 * global (les tests mockeront api.default directement).
 */
const importServicePost = (url, body, config) => api.post(url, body, config);

/** Normalise un lot Backend vers la forme attendue par l'UI. */
function normalizeBatch(batch, entityType = 'POS', fileName = 'import.xlsx') {
  if (!batch || typeof batch !== 'object') {
    throw new Error("Reponse d'import invalide : le backend n'a renvoye aucune donnee.");
  }
  return {
    id: batch.id,
    entity_type: batch.entity_type || entityType,
    status: batch.status || 'VALIDATED',
    file_name: batch.file_name || fileName,
    created_at: batch.created_at,
    columns: batch.columns || Object.keys(batch.rows?.[0]?.cells || {}) || [],
    rows: batch.rows || [],
    errors: batch.errors || batch.error_report?.errors || [],
    warnings: batch.warnings || batch.error_report?.warnings || [],
    summary: {
      total_lines: batch.summary?.total_lines ?? batch.total_lines ?? 0,
      created: batch.summary?.created ?? batch.created ?? 0,
      updated: batch.summary?.updated ?? batch.updated ?? 0,
      errors: batch.summary?.errors ?? batch.errors_count ?? 0,
      warnings: batch.summary?.warnings ?? batch.warnings_count ?? 0,
      status: batch.status || 'VALIDATED',
    },
  };
}

export default importService;
