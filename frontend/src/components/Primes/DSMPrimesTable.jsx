import React from 'react';

const formatInt = (v) => {
  if (v === null || v === undefined) return '0';
  return new Intl.NumberFormat('fr-FR').format(v);
};
const formatCurrency = (v) => {
  if (v === null || v === undefined) return '0 FCFA';
  return `${new Intl.NumberFormat('fr-FR').format(Number(v))} FCFA`;
};
const formatPct = (v) => {
  if (v === null || v === undefined || isNaN(Number(v))) return '—';
  return `${Number(v).toFixed(1)} %`;
};
const achievementColor = (pct) => {
  if (pct >= 95) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (pct >= 85) return 'text-sky-700 bg-sky-50 border-sky-200';
  if (pct >= 75) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
};
const tierLabel = (pct) => {
  if (pct == null) return '—';
  if (pct >= 95) return '≥95% →7%';
  if (pct >= 85) return '85-95% →6%';
  if (pct >= 75) return '75-85% →5%';
  return '<75% →0%';
};
const statusBadge = (row) => {
  const ps = row.prime_status;
  const total = Number(row.total_prime_amount || 0);
  if (ps === 'PRIMÉ' || (total > 0 && row.double_qualified)) return { label: 'PRIMÉ', cls: 'bg-emerald-600 text-white border-emerald-600' };
  if (ps === 'PRIMÉ_1_COMPOSANTE' || (total > 0 && !row.double_qualified)) return { label: 'PRIMÉ — 1 COMPOSANTE', cls: 'bg-amber-500 text-white border-amber-500' };
  if (ps === 'PARTIELLEMENT_ATTEINT') return { label: 'PARTIELLEMENT ATTEINT', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (ps === 'NON_PRIMÉ' || ps === 'NON_ELIGIBLE' || total === 0) {
    // Distinguish qualified but 0 vs not qualified for tooltip but badge stays NON PRIMÉ
    return { label: 'NON PRIMÉ', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  return { label: ps || 'NON PRIMÉ', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
};

// New hierarchy §19: primés en premier (total>0 DESC), puis qualifiés non primés, puis non primés
const classifyRow = (row) => {
  const total = Number(row.total_prime_amount || 0);
  if (total > 0) return 'PRIMÉ';
  if (row.creation_qualified || row.revenue_qualified) return 'QUALIFIÉ_NON_PRIMÉ';
  return 'NON_PRIMÉ';
};
const groupConfig = {
  PRIMÉ: { title: '🟢 DSM PRIMÉS', subtitle: 'Prime totale >0 — tri par prime décroissante', color: 'border-emerald-500 bg-emerald-50/40' },
  QUALIFIÉ_NON_PRIMÉ: { title: '🟠 DSM QUALIFIÉS NON PRIMÉS', subtitle: 'Au moins un critère ≥75% mais prime 0 (montant généré 0)', color: 'border-amber-400 bg-amber-50/30' },
  NON_PRIMÉ: { title: '⚪ DSM NON PRIMÉS', subtitle: 'Aucun critère ≥75% — prime 0', color: 'border-slate-300 bg-slate-50/50' },
  // legacy compat
  PARTIELLEMENT_ATTEINT: { title: '🟠 DSM PARTIELLEMENT ATTEINTS', subtitle: 'Au moins un critère ≥75% mais pas les deux — prime 0', color: 'border-amber-400 bg-amber-50/30' },
  NON_ELIGIBLE: { title: '⚪ DSM NON ÉLIGIBLES', subtitle: 'Aucun critère ≥75% — prime 0', color: 'border-slate-300 bg-slate-50/50' },
};

const DSMPrimesTable = ({ data, loading = false, onDsmClick }) => {
  const rows = data?.by_dsm || [];

  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="card-header"><div className="skeleton h-4 w-48 rounded" /></div>
        <div className="p-4 space-y-2">{[1, 2, 3].map((i) => (<div key={i} className="skeleton h-10 w-full rounded" />))}</div>
      </div>
    );
  }

  // Group rows by new hierarchy: primés (total>0) first, then qualifiés non primés, then non primés
  const groups = { PRIMÉ: [], QUALIFIÉ_NON_PRIMÉ: [], NON_PRIMÉ: [] };
  rows.forEach((r) => {
    const k = classifyRow(r);
    if (groups[k]) groups[k].push(r);
    else groups.NON_PRIMÉ.push(r);
  });
  const hasRows = rows.length > 0;
  const orderKeys = ['PRIMÉ', 'QUALIFIÉ_NON_PRIMÉ', 'NON_PRIMÉ'];

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">DSM — primes par performance</h3>
            <p className="text-xs text-slate-500">Tri : primés d’abord • Objectifs 2 POS / 500 000 FCFA</p>
          </div>
          <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">{rows.length} DSM</span>
        </div>
        {/* Desktop table with grouping */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">DSM</th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Statut prime</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">POS<br /><span className="normal-case font-normal text-[10px]">réalisé / 2</span></th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">% quantité</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Revenus<br /><span className="normal-case font-normal text-[10px]">réalisé / 500k</span></th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">% revenus</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Prime création</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Prime revenus</th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Prime totale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {!hasRows ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">Aucune donnée de prime disponible. Calculez les primes pour cette période.</td></tr>
              ) : (
                orderKeys.map((gk) => {
                  const gRows = groups[gk];
                  if (gRows.length === 0) return null;
                  return (
                    <React.Fragment key={gk}>
                      <tr className={`${groupConfig[gk].color} border-l-4`}>
                        <td colSpan={9} className="px-3 py-2">
                          <span className="text-xs font-extrabold tracking-wide text-slate-800">{groupConfig[gk].title}</span>
                          <span className="ml-2 text-[11px] text-slate-500">{groupConfig[gk].subtitle} — {gRows.length} DSM</span>
                        </td>
                      </tr>
                      {gRows.map((row) => {
                        const qtyPct = row.creation_achievement_pct ?? 0;
                        const revPct = row.revenue_achievement_pct ?? 0;
                        const badge = statusBadge(row);
                        const clickable = !!onDsmClick;
                        const isPrimed = Number(row.total_prime_amount||0) > 0;
                        return (
                          <tr
                            key={row.dsm_id}
                            onClick={() => clickable && onDsmClick(row.dsm_id)}
                            className={`${clickable ? 'cursor-pointer hover:bg-indigo-50/60' : 'hover:bg-slate-50'} transition-colors ${isPrimed ? 'bg-emerald-50/20' : ''}`}
                            title={clickable ? 'Cliquer pour voir le détail prime de ce DSM (création + revenus)' : undefined}
                          >
                            <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">
                              <span className="text-indigo-600">{row.dsm_name || `DSM #${row.dsm_id}`}</span>
                              <span className="ml-1 text-[10px] text-slate-400">#{row.dsm_id}</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-center"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span></td>
                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                              <span className="font-semibold">{formatInt(row.creation_realized)} / {formatInt(row.creation_objective ?? 2)}</span>
                              <span className="ml-1 text-[10px] text-slate-400">POS</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${achievementColor(qtyPct)}`}>{formatPct(qtyPct)}</span>
                              <div className="text-[10px] text-slate-400">{row.creation_tier ?? tierLabel(qtyPct)} • {row.creation_rate_pct ?? tierLabel(qtyPct).split('→')[1]}</div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-xs">
                              <div className="font-medium">{formatCurrency(row.revenue_realized)}</div>
                              <div className="text-[10px] text-slate-400">/ {formatCurrency(row.revenue_objective ?? 500000)}</div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${achievementColor(revPct)}`}>{formatPct(revPct)}</span>
                              <div className="text-[10px] text-slate-400">{row.revenue_tier ?? tierLabel(revPct)} • {row.revenue_rate_pct ?? 0}%</div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-xs">
                              <div className={`font-bold ${Number(row.creation_prime_amount||0)>0?'text-indigo-700':'text-slate-400'}`}>{formatCurrency(row.creation_prime_amount)}</div>
                              <div className="text-[10px] text-slate-400">{row.creation_rate_pct ?? 0}% • {row.creation_qualified?'Q✓':'Q✗'}</div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-xs">
                              <div className={`font-bold ${Number(row.revenue_prime_amount||0)>0?'text-emerald-700':'text-slate-400'}`}>{formatCurrency(row.revenue_prime_amount)}</div>
                              <div className="text-[10px] text-slate-400">{row.revenue_rate_pct ?? 0}% • {row.revenue_qualified?'R✓':'R✗'}</div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums bg-slate-50 text-slate-900">{formatCurrency(row.total_prime_amount)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {!hasRows ? <p className="p-6 text-center text-sm text-slate-400">Aucune donnée.</p> : orderKeys.map((gk) => {
            const gRows = groups[gk];
            if (!gRows.length) return null;
            return (
              <div key={gk} className="">
                <div className={`px-4 py-2 text-xs font-extrabold ${groupConfig[gk].color} border-l-4`}>{groupConfig[gk].title} — {gRows.length}</div>
                {gRows.map((row) => {
                  const qtyPct = row.creation_achievement_pct ?? 0;
                  const revPct = row.revenue_achievement_pct ?? 0;
                  const badge = statusBadge(row);
                  return (
                    <div key={row.dsm_id} onClick={() => onDsmClick && onDsmClick(row.dsm_id)} className={`p-4 ${onDsmClick ? 'cursor-pointer active:bg-indigo-50' : ''} border-b border-slate-50`}>
                      <div className="flex items-start justify-between gap-2">
                        <div><p className="font-bold text-slate-900">{row.dsm_name || `DSM #${row.dsm_id}`}</p><p className="text-xs text-slate-400">2 POS • 500k FCFA — création {row.creation_rate_pct ?? 0}% / revenus {row.revenue_rate_pct ?? 0}%</p></div>
                        <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-slate-50 p-2"><p className="text-[10px] uppercase tracking-wide text-slate-500">POS</p><p className="font-bold">{formatInt(row.creation_realized)} / {formatInt(row.creation_objective ?? 2)} <span className="font-semibold text-slate-500">{formatPct(qtyPct)}</span></p><p className="text-[10px] text-slate-400">{row.creation_tier ?? tierLabel(qtyPct)} • Q{row.creation_qualified?'✓':'✗'}</p></div>
                        <div className="rounded-lg bg-slate-50 p-2"><p className="text-[10px] uppercase tracking-wide text-slate-500">Revenus</p><p className="font-bold">{formatCurrency(row.revenue_realized)} <span className="font-semibold text-slate-500">{formatPct(revPct)}</span></p><p className="text-[10px] text-slate-400">{row.revenue_tier ?? tierLabel(revPct)} • R{row.revenue_qualified?'✓':'✗'}</p></div>
                      </div>
                      <div className="mt-2 rounded-lg bg-indigo-50/50 p-2 text-xs">
                        <div className="flex justify-between"><span className="text-slate-500">Prime création</span><span className="font-bold text-indigo-700">{formatCurrency(row.creation_prime_amount)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Prime revenus</span><span className="font-bold text-emerald-700">{formatCurrency(row.revenue_prime_amount)}</span></div>
                        <div className="flex justify-between border-t border-indigo-100 pt-1 mt-1"><span className="font-semibold">Prime totale</span><span className="font-extrabold text-slate-900">{formatCurrency(row.total_prime_amount)}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Grille 75 / 85 / 95 % → 5 / 6 / 7 % • Primes création et revenus calculées indépendamment</div>
      </div>
    </div>
  );
};

export default DSMPrimesTable;
