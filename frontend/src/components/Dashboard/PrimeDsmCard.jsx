import React, { useState, useEffect } from 'react';
import analyticsService from '../../services/analyticsService';
import primeService from '../../services/primeService';
import usePartner from '../../hooks/usePartner';

const CriterionBadge = ({ ok, label }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
    {label}
  </span>
);

const formatFCFA = (v) => v == null ? '—' : `${Number(v).toLocaleString('fr-FR')} FCFA`;
const formatPct = (v) => v == null ? '—' : `${Number(v).toFixed(1)} %`;

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
  const [showDsmDetail, setShowDsmDetail] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const details = kpi?.details ?? [];
  const totalDsm = kpi?.total_dsm ?? details.length;
  const bothCount = kpi?.dsm_both_criteria ?? 0;

  useEffect(() => {
    if (!partnerContextId) { setPrimeSummary(null); setPrimeError(null); setOpenPeriodId(null); return; }
    let ignore = false;
    const load = async () => {
      setPrimeLoading(true); setPrimeError(null);
      try {
        const res = await primeService.getPeriods(partnerContextId);
        const list = res.data?.items ?? res.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        const open = arr.find((p) => p.status === 'OPEN');
        if (!open) { if (!ignore) { setPrimeSummary(null); setOpenPeriodId(null); setPrimeError('Aucune période ouverte.'); } return; }
        if (!ignore) setOpenPeriodId(open.id);
        const sumRes = await analyticsService.getDsmPrimeSummary(partnerContextId, { prime_period_id: open.id });
        if (!ignore) setPrimeSummary(sumRes.data ?? null);
      } catch (e) { if (!ignore) setPrimeError(e?.response?.data?.detail ?? 'Primes DSM indisponibles.'); }
      finally { if (!ignore) setPrimeLoading(false); }
    };
    void load();
    return () => { ignore = true; };
  }, [partnerContextId]);

  const loadProductionFinanciere = async (id) => {
    setProdFin(null); setProdError(null); setPrimeDetail(null); setDetailError(null);
    if (!id) return;
    try {
      setProdLoading(true);
      const params = openPeriodId ? { prime_period_id: openPeriodId } : undefined;
      const res = await analyticsService.getDsmProductionFinanciere(partnerContextId, Number(id), params);
      setProdFin(res.data ?? null);
    } catch { setProdError('Production financière indisponible pour ce DSM.'); }
    finally { setProdLoading(false); }
    if (!openPeriodId) return;
    try {
      setDetailLoading(true);
      const res = await analyticsService.getDsmPrimeDetail(partnerContextId, { dsm_id: Number(id), prime_period_id: openPeriodId });
      setPrimeDetail(res.data ?? null);
    } catch (e) { setDetailError(e?.response?.data?.detail ?? 'Détail prime indisponible.'); }
    finally { setDetailLoading(false); }
  };

  if (loading) {
    return (
      <div className="card overflow-hidden border-l-[3px] border-l-indigo-500">
        <div className="p-4 flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden border-l-[3px] border-l-indigo-500">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0176d3]">Prime DSM — période ouverte</p>
          <span className="text-[11px] text-slate-400">Règle: 200 POS / 500k FCFA — seuils 75%/95% — taux 0,1%/0,5%</span>
        </div>

        {/* Synthèse compacte avec libellés explicites */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-xs text-slate-500" title="Nombre total de POS du partenaire (tous types)">POS partenaire (total)</p>
            <p className="text-lg font-bold text-slate-900">{(stats?.pos_total ?? 0).toLocaleString('fr-FR')}</p>
            <p className="text-[10px] text-slate-400">499 = POS réels ODI (exemple)</p>
          </div>
          <div className="rounded-lg bg-emerald-50/50 p-2">
            <p className="text-xs text-slate-500" title="DSM ayant atteint ≥75% de l'objectif quantité (200 POS/mois)">Critère quantité atteint (≥75%)</p>
            <p className="text-lg font-bold text-emerald-600">{details.filter((d) => d.qty_ok).length}<span className="text-xs font-normal text-slate-400"> / {totalDsm}</span></p>
          </div>
          <div className="rounded-lg bg-sky-50/50 p-2">
            <p className="text-xs text-slate-500" title="DSM ayant atteint ≥75% de l'objectif revenus premières recharges (500k FCFA/mois)">Critère revenus 1ère recharge atteint (≥75%)</p>
            <p className="text-lg font-bold text-sky-600">{details.filter((d) => d.amt_ok).length}<span className="text-xs font-normal text-slate-400"> / {totalDsm}</span></p>
          </div>
          <div className="rounded-lg bg-indigo-50 p-2">
            <p className="text-xs text-slate-500" title="DSM éligibles : les deux critères ≥75% simultanément">DSM éligibles (double critère)</p>
            <p className="text-lg font-bold text-brand-600">{bothCount}<span className="text-xs font-medium text-slate-400"> / {totalDsm}</span></p>
          </div>
        </div>

        {/* Résumé primes — libellés clarifiés */}
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
          {primeLoading ? <p className="text-xs text-slate-400">Chargement primes…</p>
            : primeError ? <p className="text-xs text-amber-600">{primeError}</p>
            : !primeSummary ? <p className="text-xs text-slate-400">Aucune donnée de prime sur période ouverte.</p>
            : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500" title="Réalisation quantité globale vs objectif global">Taux atteinte quantité (global)</p>
                  <p className="text-sm font-bold text-slate-900">{formatPct(primeSummary.global_creation_achievement_pct)}</p>
                  <p className="text-[10px] text-slate-400">{primeSummary.global_creation_realized ?? 0} / {primeSummary.global_creation_target ?? 0} POS</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500" title="Réalisation revenus premières recharges globale">Taux atteinte revenus 1ère recharge (global)</p>
                  <p className="text-sm font-bold text-slate-900">{formatPct(primeSummary.global_revenue_achievement_pct)}</p>
                  <p className="text-[10px] text-slate-400">{formatFCFA(primeSummary.global_revenue_realized)} / {formatFCFA(primeSummary.global_revenue_target)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Prime création (periode)</p>
                  <p className="text-sm font-bold text-indigo-600">{formatFCFA(primeSummary.total_creation_prime)}</p>
                  <p className="text-[10px] text-slate-400">Toujours 0 (règle 3B)</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500" title="Revenu réel éligible × taux final (MIN taux quantité/revenu)">Prime revenus 1ère recharge</p>
                  <p className="text-sm font-bold text-emerald-600">{formatFCFA(primeSummary.total_revenue_prime)}</p>
                </div>
                <div className="col-span-2 sm:col-span-4 flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
                  <span className="text-xs text-slate-500">Total primes période</span>
                  <span className="text-sm font-extrabold text-slate-900">{formatFCFA(primeSummary.total_prime)}</span>
                  <span className="text-xs text-slate-400">{primeSummary.dsm_count ?? 0} DSM</span>
                </div>
              </div>
            )}
        </div>

        {/* Interaction : Sélection DSM */}
        <div className="mt-4">
          <button type="button" onClick={() => setShowDsmDetail((v) => !v)} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
            {showDsmDetail ? 'Masquer le détail par DSM' : 'Voir le détail par DSM'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${showDsmDetail ? 'rotate-180' : ''} transition-transform`}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {showDsmDetail ? (
            <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select value={dsmId} onChange={(e) => { setDsmId(e.target.value); void loadProductionFinanciere(e.target.value); }} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500">
                  <option value="">Sélectionner un DSM…</option>
                  {details.map((d) => (
                    <option key={d.dsm_id} value={d.dsm_id}>{d.matricule ?? `DSM #${d.dsm_id}`}</option>
                  ))}
                </select>
                {prodLoading ? <span className="text-xs text-slate-400">Chargement…</span> : null}
                {!prodLoading && prodFin ? (
                  <span className="text-sm font-bold text-slate-900">{Number(prodFin.production_financiere ?? 0).toLocaleString('fr-FR')} FCFA<span className="ml-2 text-xs font-medium text-slate-400">({prodFin.nombre_pos ?? 0} POS — premières recharges)</span></span>
                ) : null}
                {prodError ? <span className="text-xs text-red-500">{prodError}</span> : null}
              </div>
              {!dsmId ? <p className="mt-2 text-xs text-slate-400">Choisissez un DSM pour afficher ses données.</p> : null}
              {dsmId ? (
                <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">Détail prime DSM #{dsmId}</p>
                  {detailLoading ? <p className="mt-2 text-xs text-slate-400">Chargement détail…</p>
                    : detailError ? <p className="mt-2 text-xs text-red-500">{detailError}</p>
                    : !primeDetail || primeDetail.found === false ? <p className="mt-2 text-xs text-slate-500">Aucune donnée disponible pour ce DSM sur la période sélectionnée.</p>
                    : (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <div><p className="text-xs text-slate-500">Taux création</p><p className="text-sm font-bold text-slate-900">{formatPct(primeDetail.creation_achievement_pct)}</p><p className="text-xs text-slate-400">{primeDetail.creation_realized ?? 0} / {primeDetail.creation_objective ?? 0}</p></div>
                        <div><p className="text-xs text-slate-500">Taux revenus 1ère recharge</p><p className="text-sm font-bold text-slate-900">{formatPct(primeDetail.revenue_achievement_pct)}</p><p className="text-xs text-slate-400">{formatFCFA(primeDetail.revenue_realized)} / {formatFCFA(primeDetail.revenue_objective)}</p></div>
                        <div><p className="text-xs text-slate-500">Statut</p><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${primeDetail.status === 'ELIGIBLE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{primeDetail.status ?? '—'}</span></div>
                        <div><p className="text-xs text-slate-500">Prime revenus</p><p className="text-sm font-bold text-emerald-600">{formatFCFA(primeDetail.revenue_prime_amount)}</p></div>
                        <div className="col-span-2"><p className="text-xs text-slate-500">Total (revenus 1ère recharge × taux final MIN)</p><p className="text-sm font-extrabold text-slate-900">{formatFCFA(primeDetail.total_prime_amount)}</p><p className="text-[10px] text-slate-400">Taux final = MIN(taux création, taux revenus) si double critère ≥75% sinon 0</p></div>
                      </div>
                    )}
                  {primeDetail && primeDetail.found !== false && primeDetail.total_prime_amount === 0 ? (
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">Prime 0 FCFA — motif : {primeDetail.creation_achievement_pct < 75 && primeDetail.revenue_achievement_pct < 75 ? 'critères quantité et revenus non atteints (<75%)' : primeDetail.creation_achievement_pct < 75 ? `critère quantité non atteint (${primeDetail.creation_achievement_pct ?? 0}% <75%)` : primeDetail.revenue_achievement_pct < 75 ? `critère revenus 1ère recharge non atteint (${primeDetail.revenue_achievement_pct ?? 0}% <75%) — réalisé ${formatFCFA(primeDetail.revenue_realized)} / ${formatFCFA(primeDetail.revenue_objective)}` : 'non éligible (vérifier seuils 75/95)'}. </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Tableau DSM — masqué par défaut */}
        <div className="mt-4">
          <button type="button" onClick={() => setShowTable((v) => !v)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            {showTable ? 'Masquer le tableau des primes DSM' : 'Voir le détail des primes DSM'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${showTable ? 'rotate-180' : ''} transition-transform`}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {showTable ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="py-2 px-3">DSM</th>
                    <th className="py-2 px-3">Quantité (≥75% = 200 POS)</th>
                    <th className="py-2 px-3">Montant 1ère recharge (≥75% = 500k FCFA)</th>
                    <th className="py-2 px-3">Résultat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 bg-white">
                  {details.length === 0 ? <tr><td colSpan={4} className="py-4 text-center text-sm text-slate-400">Aucun objectif DSM pour la période en cours.</td></tr>
                    : details.map((d) => (
                      <tr key={d.dsm_id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-sm font-medium text-slate-700">{d.matricule ?? `DSM #${d.dsm_id}`}</td>
                        <td className="py-2 px-3"><CriterionBadge ok={!!d.qty_ok} label={d.qty_ok ? 'Atteint' : 'Non atteint'} /> <span className="ml-1 text-xs text-slate-400">{d.qty_pct != null ? `${d.qty_pct}%` : ''}</span></td>
                        <td className="py-2 px-3"><CriterionBadge ok={!!d.amt_ok} label={d.amt_ok ? 'Atteint' : 'Non atteint'} /> <span className="ml-1 text-xs text-slate-400">{d.amt_pct != null ? `${d.amt_pct}%` : ''}</span></td>
                        <td className="py-2 px-3">{d.both ? <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Éligible</span> : <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">En attente</span>}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PrimeDsmCard;
