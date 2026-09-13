import React, { useState, useEffect } from 'react';
import analyticsService from '../../services/analyticsService';
import primeService from '../../services/primeService';
import usePartner from '../../hooks/usePartner';

/**
 * Carte « Prime DSM » — affiche les primes DSM dédiées (creation + revenus)
 * + critères both-criteria (backend).
 * Sources :
 *   GET /api/partners/{partner_id}/analytics/kpi/dsm-both-criteria  (kpi prop)
 *   GET /api/partners/{partner_id}/primes/dsm/summary  (via analyticsService)
 *   GET /api/partners/{partner_id}/primes/dsm/detail  (via analyticsService)
 *   GET /api/partners/{partner_id}/analytics/dsm/{dsm_id}/production-financiere
 * Aucun seuil n'est codé en dur : backend reste responsable du calcul.
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

const formatFCFA = (v) =>
  v == null ? '—' : `${Number(v).toLocaleString('fr-FR')} FCFA`;
const formatPct = (v) =>
  v == null ? '—' : `${Number(v).toFixed(1)} %`;

const PrimeDsmBody = ({
  stats, details, totalDsm, bothCount,
  dsmId, setDsmId, prodFin, prodLoading, prodError, loadProductionFinanciere,
  primeSummary, primeLoading, primeError, primeDetail, detailLoading, detailError,
}) => (
  <>
    {/* Synthèse both-criteria */}
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

    {/* Prime summary partenaire (période OPEN) */}
    <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Primes DSM — période ouverte</p>
      {primeLoading ? (
        <p className="mt-2 text-xs text-slate-400">Chargement primes…</p>
      ) : primeError ? (
        <p className="mt-2 text-xs text-amber-600">{primeError}</p>
      ) : !primeSummary ? (
        <p className="mt-2 text-xs text-slate-400">Aucune donnée de prime sur période ouverte.</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Taux création global</p>
            <p className="text-sm font-bold text-slate-900">{formatPct(primeSummary.global_creation_achievement_pct)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Taux revenus global</p>
            <p className="text-sm font-bold text-slate-900">{formatPct(primeSummary.global_revenue_achievement_pct)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Prime création</p>
            <p className="text-sm font-bold text-indigo-600">{formatFCFA(primeSummary.total_creation_prime)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Prime revenus</p>
            <p className="text-sm font-bold text-emerald-600">{formatFCFA(primeSummary.total_revenue_prime)}</p>
          </div>
          <div className="col-span-2 sm:col-span-4 flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
            <span className="text-xs text-slate-500">Total primes</span>
            <span className="text-sm font-extrabold text-slate-900">{formatFCFA(primeSummary.total_prime)}</span>
            <span className="text-xs text-slate-400">{primeSummary.dsm_count ?? 0} DSM</span>
          </div>
        </div>
      )}
    </div>

    {/* Sélecteur DSM : production financière + détail prime */}
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

    {/* Détail prime DSM sélectionné */}
    {dsmId ? (
      <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">Détail prime DSM #{dsmId}</p>
        {detailLoading ? (
          <p className="mt-2 text-xs text-slate-400">Chargement détail…</p>
        ) : detailError ? (
          <p className="mt-2 text-xs text-red-500">{detailError}</p>
        ) : !primeDetail || primeDetail.found === false ? (
          <p className="mt-2 text-xs text-slate-400">Aucune commission calculée pour ce DSM sur la période ouverte.</p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Taux création</p>
              <p className="text-sm font-bold text-slate-900">{formatPct(primeDetail.creation_achievement_pct)}</p>
              <p className="text-xs text-slate-400">{primeDetail.creation_realized ?? 0} / {primeDetail.creation_objective ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Taux revenus</p>
              <p className="text-sm font-bold text-slate-900">{formatPct(primeDetail.revenue_achievement_pct)}</p>
              <p className="text-xs text-slate-400">{formatFCFA(primeDetail.revenue_realized)} / {formatFCFA(primeDetail.revenue_objective)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Statut</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${primeDetail.status === 'ELIGIBLE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {primeDetail.status ?? '—'}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Prime création</p>
              <p className="text-sm font-bold text-indigo-600">{formatFCFA(primeDetail.creation_prime_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Prime revenus</p>
              <p className="text-sm font-bold text-emerald-600">{formatFCFA(primeDetail.revenue_prime_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-sm font-extrabold text-slate-900">{formatFCFA(primeDetail.total_prime_amount)}</p>
            </div>
          </div>
        )}
      </div>
    ) : null}

    {/* Détail par DSM : critères et résultat (both-criteria) */}
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


const PrimeDsmCard = ({ loading, stats, kpi }) => {
  const { partnerContextId } = usePartner();
  const [dsmId, setDsmId] = useState('');
  const [prodFin, setProdFin] = useState(null);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState(null);

  const [primeSummary, setPrimeSummary] = useState(null);
  const [primeLoading, setPrimeLoading] = useState(false);
  const [primeError, setPrimeError] = useState(null);
  const [primeDetail, setPrimeDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [openPeriodId, setOpenPeriodId] = useState(null);

  const details = kpi?.details ?? [];
  const totalDsm = kpi?.total_dsm ?? details.length;
  const bothCount = kpi?.dsm_both_criteria ?? 0;

  // Load DSM prime summary for open period
  useEffect(() => {
    if (!partnerContextId) {
      setPrimeSummary(null); setPrimeError(null); setOpenPeriodId(null);
      return;
    }
    let ignore = false;
    const load = async () => {
      setPrimeLoading(true); setPrimeError(null);
      try {
        const res = await primeService.getPeriods(partnerContextId);
        const list = res.data?.items ?? res.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        const open = arr.find((p) => p.status === 'OPEN');
        if (!open) {
          if (!ignore) { setPrimeSummary(null); setOpenPeriodId(null); setPrimeError('Aucune période ouverte.'); }
          return;
        }
        if (!ignore) setOpenPeriodId(open.id);
        const sumRes = await analyticsService.getDsmPrimeSummary(partnerContextId, { prime_period_id: open.id });
        if (!ignore) setPrimeSummary(sumRes.data ?? null);
      } catch (e) {
        if (!ignore) setPrimeError(e?.response?.data?.detail ?? 'Primes DSM indisponibles.');
      } finally {
        if (!ignore) setPrimeLoading(false);
      }
    };
    void load();
    return () => { ignore = true; };
  }, [partnerContextId]);

  const loadProductionFinanciere = async (id) => {
    setProdFin(null);
    setProdError(null);
    setPrimeDetail(null);
    setDetailError(null);
    if (!id) return;
    // production financière
    try {
      setProdLoading(true);
      const res = await analyticsService.getDsmProductionFinanciere(partnerContextId, Number(id));
      setProdFin(res.data ?? null);
    } catch {
      setProdError('Production financière indisponible pour ce DSM.');
    } finally {
      setProdLoading(false);
    }
    // détail prime DSM (si période ouverte)
    if (!openPeriodId) return;
    try {
      setDetailLoading(true);
      const res = await analyticsService.getDsmPrimeDetail(partnerContextId, { dsm_id: Number(id), prime_period_id: openPeriodId });
      setPrimeDetail(res.data ?? null);
    } catch (e) {
      setDetailError(e?.response?.data?.detail ?? 'Détail prime indisponible.');
    } finally {
      setDetailLoading(false);
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
            primeSummary={primeSummary}
            primeLoading={primeLoading}
            primeError={primeError}
            primeDetail={primeDetail}
            detailLoading={detailLoading}
            detailError={detailError}
          />
        )}
      </div>
    </div>
  );
};


export default PrimeDsmCard;
