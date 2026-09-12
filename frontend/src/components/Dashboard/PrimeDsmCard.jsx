import React, { useState } from 'react';
import analyticsService from '../../services/analyticsService';
import usePartner from '../../hooks/usePartner';

/**
 * Carte « Prime DSM » — évaluation des primes DSM.
 * Les critères quantité / montant et le résultat par DSM proviennent
 * EXCLUSIVEMENT du backend :
 *   GET /api/partners/{partner_id}/analytics/kpi/dsm-both-criteria
 * Les recettes des premières recharges (production financière) sont
 * chargées à la demande par DSM via :
 *   GET /api/partners/{partner_id}/analytics/dsm/{dsm_id}/production-financiere
 * Aucun seuil (75 % / 95 % / 100 %…) n'est codé en dur ici : le backend
 * (grilles de primes configurables) reste responsable du calcul métier.
 */

const CriterionBadge = ({ ok, label }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
    }`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
    {label}
  </span>
);

const PrimeDsmCard = ({ loading, stats, kpi }) => {
  const { partnerContextId } = usePartner();
  const [dsmId, setDsmId] = useState('');
  const [prodFin, setProdFin] = useState(null);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState(null);

  const details = kpi?.details ?? [];
  const totalDsm = kpi?.total_dsm ?? details.length;
  const bothCount = kpi?.dsm_both_criteria ?? 0;

  const loadProductionFinanciere = async (id) => {
    setProdFin(null);
    setProdError(null);
    if (!id) return;
    try {
      setProdLoading(true);
      const res = await analyticsService.getDsmProductionFinanciere(partnerContextId, Number(id));
      setProdFin(res.data ?? null);
    } catch {
      setProdError('Production financière indisponible pour ce DSM.');
    } finally {
      setProdLoading(false);
    }
  };

  return (
    <div className="card overflow-hidden border-l-[3px] border-l-indigo-500">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0176d3]">Prime DSM</p>
          <span className="text-[11px] text-slate-400">Évaluation backend</span>
        </div>
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <PrimeDsmBody
            stats={stats}
            details={details}
            totalDsm={totalDsm}
            bothCount={bothCount}
            dsmId={dsmId}
            setDsmId={setDsmId}
            prodFin={prodFin}
            prodLoading={prodLoading}
            prodError={prodError}
            loadProductionFinanciere={loadProductionFinanciere}
          />
        )}
      </div>
    </div>
  );
};

export default PrimeDsmCard;

const PrimeDsmBody = ({ stats, details, totalDsm, bothCount, dsmId, setDsmId, prodFin, prodLoading, prodError, loadProductionFinanciere }) => (
  <>
    {/* Synthèse */}
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div>
        <p className="text-xs text-slate-500">Nombre de POS</p>
        <p className="text-lg font-bold text-slate-900">
          {(stats?.pos_total ?? 0).toLocaleString('fr-FR')}
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Critère quantité OK</p>
        <p className="text-lg font-bold text-emerald-600">{details.filter((d) => d.qty_ok).length}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Critère montant OK</p>
        <p className="text-lg font-bold text-sky-600">{details.filter((d) => d.amt_ok).length}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Les 2 critères</p>
        <p className="text-lg font-bold text-brand-600">
          {bothCount} <span className="text-xs font-medium text-slate-400">/ {totalDsm}</span>
        </p>
      </div>
    </div>

    {/* Recettes des premières recharges (production financière) — par DSM, à la demande */}
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <select
        value={dsmId}
        onChange={(e) => {
          setDsmId(e.target.value);
          void loadProductionFinanciere(e.target.value);
        }}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        <option value="">Recettes premières recharges — choisir un DSM…</option>
        {details.map((d) => (
          <option key={d.dsm_id} value={d.dsm_id}>
            {d.matricule ?? `DSM #${d.dsm_id}`}
          </option>
        ))}
      </select>
      {prodLoading ? <span className="text-xs text-slate-400">Chargement…</span> : null}
      {!prodLoading && prodFin ? (
        <span className="text-sm font-bold text-slate-900">
          {Number(prodFin.production_financiere ?? 0).toLocaleString('fr-FR')} FCFA
          <span className="ml-2 text-xs font-medium text-slate-400">({prodFin.nombre_pos ?? 0} POS)</span>
        </span>
      ) : null}
      {prodError ? <span className="text-xs text-red-500">{prodError}</span> : null}
    </div>

    {/* Détail par DSM : critères et résultat */}
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <th className="py-1.5 pr-3">DSM</th>
            <th className="py-1.5 pr-3">Quantité</th>
            <th className="py-1.5 pr-3">Montant</th>
            <th className="py-1.5">Résultat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {details.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-center text-sm text-slate-400">
                Aucun objectif DSM pour la période en cours.
              </td>
            </tr>
          ) : (
            details.map((d) => (
              <tr key={d.dsm_id} className="table-row-hover transition-colors">
                <td className="py-2 pr-3 text-sm font-medium text-slate-700">
                  {d.matricule ?? `DSM #${d.dsm_id}`}
                </td>
                <td className="py-2 pr-3">
                  <CriterionBadge ok={!!d.qty_ok} label={d.qty_ok ? 'Atteint' : 'Non atteint'} />
                </td>
                <td className="py-2 pr-3">
                  <CriterionBadge ok={!!d.amt_ok} label={d.amt_ok ? 'Atteint' : 'Non atteint'} />
                </td>
                <td className="py-2">
                  {d.both ? (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      Éligible
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      En attente
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </>
);
