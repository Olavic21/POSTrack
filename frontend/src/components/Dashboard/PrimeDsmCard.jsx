import React, { useState, useEffect } from 'react';
import analyticsService from '../../services/analyticsService';
import primeService from '../../services/primeService';
import usePartner from '../../hooks/usePartner';
import ProgressBar from '../ui/ProgressBar';

const formatFCFA = (v) => v == null ? '—' : `${Number(v).toLocaleString('fr-FR')} FCFA`;
const formatPct = (v) => v == null ? '—' : `${Number(v).toFixed(1)}%`;

const PrimeDsmCard = ({ loading, stats, kpi, onPrimeSummaryChange, onPeriodSelected }) => {
  const { partnerContextId } = usePartner();
  const [dsmId, setDsmId] = useState('');
  const [prodFin, setProdFin] = useState(null);
  const [prodLoading, setProdLoading] = useState(false);
  const [primeSummary, setPrimeSummary] = useState(null);
  const [primeLoading, setPrimeLoading] = useState(false);
  const [primeError, setPrimeError] = useState(null);
  const [primeDetail, setPrimeDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState(null);
  const [showDsmDetail, setShowDsmDetail] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const primeDsmDetails = primeSummary?.by_dsm ? primeSummary.by_dsm.map((r) => ({
    dsm_id: r.dsm_id, matricule: r.dsm_name,
    qty_ok: !!r.creation_qualified, amt_ok: !!r.revenue_qualified, both: !!r.double_qualified,
    qty_pct: r.creation_achievement_pct, amt_pct: r.revenue_achievement_pct,
  })) : null;
  const details = primeDsmDetails ?? kpi?.details ?? [];
  const totalDsm = primeSummary?.dsm_count ?? kpi?.total_dsm ?? details.length;
  const bothCount = primeSummary?.double_qualified_dsm_count ?? kpi?.dsm_both_criteria ?? 0;
  const qtyCount = primeSummary?.quantity_qualified_dsm_count ?? details.filter((d) => d.qty_ok).length;
  const revCount = primeSummary?.revenue_qualified_dsm_count ?? details.filter((d) => d.amt_ok).length;

  useEffect(() => {
    if (!partnerContextId) { setPrimeSummary(null); setPrimeError(null); setPeriods([]); setSelectedPeriodId(null); setSelectedPeriodLabel(null); return; }
    let ignore = false;
    const loadPeriods = async () => {
      try {
        const res = await primeService.getPeriods(partnerContextId);
        const list = res.data?.items ?? res.data ?? [];
        const arr = Array.isArray(list) ? list : [];
        if (!ignore) setPeriods(arr);
        if (arr.length === 0) { if (!ignore) { setPrimeSummary(null); setSelectedPeriodId(null); setSelectedPeriodLabel(null); } return; }
        const open = arr.find((p) => p.status === 'OPEN') || arr[0];
        if (!ignore) {
          setSelectedPeriodId(open.id);
          setSelectedPeriodLabel(open.label ?? open.code ?? '');
          if (onPeriodSelected) onPeriodSelected(open);
        }
      } catch (e) { if (!ignore) setPrimeError('Périodes indisponibles.'); }
    };
    void loadPeriods();
    return () => { ignore = true; };
  }, [partnerContextId]);

  useEffect(() => {
    if (!partnerContextId || !selectedPeriodId) return;
    let ignore = false;
    const load = async () => {
      setPrimeLoading(true); setPrimeError(null);
      try {
        const sumRes = await primeService.getDsmPrimeSummary(partnerContextId, selectedPeriodId);
        const data = sumRes.data ?? null;
        if (!ignore) {
          setPrimeSummary(data);
          if (onPrimeSummaryChange) onPrimeSummaryChange(data);
        }
      } catch (e) {
        try {
          const sumRes2 = await analyticsService.getDsmPrimeSummary(partnerContextId, { prime_period_id: selectedPeriodId });
          if (!ignore) {
            setPrimeSummary(sumRes2.data ?? null);
            if (onPrimeSummaryChange) onPrimeSummaryChange(sumRes2.data ?? null);
          }
        } catch (e2) { if (!ignore) setPrimeError('Primes indisponibles pour cette période.'); }
      } finally { if (!ignore) setPrimeLoading(false); }
    };
    void load();
    return () => { ignore = true; };
  }, [partnerContextId, selectedPeriodId]);

  const loadProductionFinanciere = async (id) => {
    setProdFin(null); setPrimeDetail(null);
    if (!id) return;
    try {
      setProdLoading(true);
      const params = selectedPeriodId ? { prime_period_id: selectedPeriodId } : undefined;
      const res = await analyticsService.getDsmProductionFinanciere(partnerContextId, Number(id), params);
      setProdFin(res.data ?? null);
    } catch { /* ignore */ } finally { setProdLoading(false); }
    if (!selectedPeriodId) return;
    try {
      setDetailLoading(true);
      const res = await primeService.getDsmPrimeDetail(partnerContextId, Number(id), selectedPeriodId);
      setPrimeDetail(res.data ?? null);
    } catch (e) {
      try {
        const res2 = await analyticsService.getDsmPrimeDetail(partnerContextId, { dsm_id: Number(id), prime_period_id: selectedPeriodId });
        setPrimeDetail(res2.data ?? null);
      } catch (e2) { /* ignore */ }
    } finally { setDetailLoading(false); }
  };

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Primes DSM</h3>
            <p className="text-xs text-slate-500">{selectedPeriodLabel ?? 'Période de prime'} • {primeSummary?.dsm_count ? `${primeSummary.dsm_count} DSM` : ''}</p>
          </div>
          {periods.length > 1 ? (
            <select
              value={selectedPeriodId ?? ''}
              onChange={(e) => {
                const pid = Number(e.target.value);
                setSelectedPeriodId(pid);
                const p = periods.find((x) => x.id === pid);
                setSelectedPeriodLabel(p?.label ?? p?.code ?? '');
                if (onPeriodSelected && p) onPeriodSelected(p);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
              aria-label="Période"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.label ?? p.code} {p.status === 'OPEN' ? '• Ouverte' : ''}</option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">POS créés</p>
            <p className="mt-1 text-xl font-extrabold text-slate-900">{primeSummary ? (primeSummary.global_creation_realized ?? 0).toLocaleString('fr-FR') : '—'}</p>
            <p className="text-xs text-slate-500">sur la période</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Création ≥75%</p>
            <p className="mt-1 text-xl font-extrabold text-emerald-700">{primeSummary?.quantity_qualified_dsm_count ?? qtyCount} <span className="text-sm font-semibold text-slate-500">/ {primeSummary?.dsm_count ?? totalDsm}</span></p>
            <ProgressBar value={totalDsm ? ((primeSummary?.quantity_qualified_dsm_count ?? qtyCount) / totalDsm) * 100 : 0} tone="success" className="mt-2" />
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700">Revenus ≥75%</p>
            <p className="mt-1 text-xl font-extrabold text-sky-700">{primeSummary?.revenue_qualified_dsm_count ?? revCount} <span className="text-sm font-semibold text-slate-500">/ {primeSummary?.dsm_count ?? totalDsm}</span></p>
            <ProgressBar value={totalDsm ? ((primeSummary?.revenue_qualified_dsm_count ?? revCount) / totalDsm) * 100 : 0} tone="info" className="mt-2" />
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">DSM primés</p>
            <p className="mt-1 text-xl font-extrabold text-indigo-700">{primeSummary?.by_dsm ? primeSummary.by_dsm.filter((r)=> Number(r.total_prime_amount||0)>0).length : bothCount} <span className="text-sm font-semibold text-slate-500">/ {primeSummary?.dsm_count ?? totalDsm}</span></p>
            <p className="text-xs text-slate-500">prime &gt; 0 FCFA</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {primeLoading ? <p className="p-6 text-sm text-slate-400 text-center">Chargement…</p>
            : primeError ? <p className="p-6 text-sm text-amber-600 text-center">{primeError}</p>
            : !primeSummary ? <p className="p-6 text-sm text-slate-400 text-center">Aucune donnée pour cette période.</p>
            : (
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <div className="p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Performance création</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Objectif</span><span className="font-bold">{primeSummary.global_creation_target ?? 118} POS</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Réalisé</span><span className="font-bold text-indigo-700">{primeSummary.global_creation_realized ?? 0} POS</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Taux</span><span className="font-extrabold text-indigo-700">{formatPct(primeSummary.global_creation_achievement_pct)}</span></div>
                    <ProgressBar value={primeSummary.global_creation_achievement_pct ?? 0} tone="brand" className="mt-2" />
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Performance revenus</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Objectif</span><span className="font-bold">{formatFCFA(primeSummary.global_revenue_target)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Réalisé</span><span className="font-bold text-emerald-700">{formatFCFA(primeSummary.global_revenue_realized)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Taux</span><span className="font-extrabold text-emerald-700">{formatPct(primeSummary.global_revenue_achievement_pct)}</span></div>
                    <ProgressBar value={primeSummary.global_revenue_achievement_pct ?? 0} tone="success" className="mt-2" />
                  </div>
                </div>
                <div className="p-5 bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-100">Primes à distribuer</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-indigo-100">Création</span><span className="font-bold">{formatFCFA(primeSummary.total_creation_prime)}</span></div>
                    <div className="flex justify-between"><span className="text-indigo-100">Revenus</span><span className="font-bold">{formatFCFA(primeSummary.total_revenue_prime)}</span></div>
                    <div className="flex justify-between border-t border-white/20 pt-2 text-base"><span className="font-extrabold">Total</span><span className="font-extrabold">{formatFCFA(primeSummary.total_prime ?? (Number(primeSummary.total_creation_prime||0)+Number(primeSummary.total_revenue_prime||0)))}</span></div>
                  </div>
                </div>
              </div>
            )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowDsmDetail((v) => !v)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
            {showDsmDetail ? 'Masquer le détail par DSM' : 'Détail par DSM'}
          </button>
          <button type="button" onClick={() => setShowTable((v) => !v)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
            {showTable ? 'Masquer le tableau' : 'Voir le tableau DSM'}
          </button>
        </div>

        {showDsmDetail ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <select value={dsmId} onChange={(e) => { setDsmId(e.target.value); void loadProductionFinanciere(e.target.value); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="">Sélectionner un DSM…</option>
                {details.map((d) => (
                  <option key={d.dsm_id} value={d.dsm_id}>{d.matricule ?? `DSM #${d.dsm_id}`}</option>
                ))}
              </select>
              {prodLoading ? <span className="text-xs text-slate-400">Chargement…</span> : null}
              {prodFin ? <span className="text-sm font-bold text-slate-900">{Number(prodFin.production_financiere ?? 0).toLocaleString('fr-FR')} FCFA</span> : null}
            </div>
            {dsmId && primeDetail && primeDetail.found !== false ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white border border-slate-200 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Quantité — 2 POS</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Objectif</span><span className="font-bold">{primeDetail.creation_objective ?? 0} POS</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Réalisé</span><span className="font-semibold">{primeDetail.creation_realized ?? 0} POS</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Taux</span><span className="font-bold">{formatPct(primeDetail.creation_achievement_pct)}</span></div>
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-emerald-100 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Revenus — 500 000 FCFA</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Objectif</span><span className="font-bold">{formatFCFA(primeDetail.revenue_objective)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Réalisé</span><span className="font-semibold">{formatFCFA(primeDetail.revenue_realized)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Taux</span><span className="font-bold">{formatPct(primeDetail.revenue_achievement_pct)}</span></div>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900 text-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">Prime totale</p>
                  <p className="mt-2 text-xl font-extrabold">{formatFCFA(primeDetail.total_prime_amount)}</p>
                  <p className="text-xs text-slate-400 mt-1">{primeDetail.status ?? ''}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {showTable ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="py-3 px-4">DSM</th>
                    <th className="py-3 px-4">Création ≥75%</th>
                    <th className="py-3 px-4">Revenus ≥75%</th>
                    <th className="py-3 px-4">Prime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {details.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-sm text-slate-400">Aucun DSM pour cette période.</td></tr>
                    : details.map((d) => (
                      <tr key={d.dsm_id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm font-semibold text-slate-900">{d.matricule ?? `DSM #${d.dsm_id}`}</td>
                        <td className="py-3 px-4"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${d.qty_ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>{d.qty_ok ? 'Atteint' : 'Non atteint'}</span> <span className="text-xs text-slate-400">{d.qty_pct != null ? `${d.qty_pct}%` : ''}</span></td>
                        <td className="py-3 px-4"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${d.amt_ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>{d.amt_ok ? 'Atteint' : 'Non atteint'}</span> <span className="text-xs text-slate-400">{d.amt_pct != null ? `${d.amt_pct}%` : ''}</span></td>
                        <td className="py-3 px-4">{d.both ? <span className="inline-flex rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-bold text-indigo-700">Éligible</span> : <span className="inline-flex rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">Non éligible</span>}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PrimeDsmCard;
