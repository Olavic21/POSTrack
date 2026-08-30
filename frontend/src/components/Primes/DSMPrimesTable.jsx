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
  if (pct >= 95) return 'text-emerald-700 bg-emerald-50';
  if (pct >= 75) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
};

const DSMPrimesTable = ({ data, loading = false }) => {
  const rows = data?.by_dsm || [];

  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="skeleton h-4 w-48 rounded" />
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-10 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <h3 className="text-lg font-bold text-slate-900">Détail par DSM</h3>
        <p className="text-xs text-slate-500">Performance et primes individuelles de chaque DSM.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">DSM</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Obj. Création</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Réalisé</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">%</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Prime Création</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Obj. Revenus</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Réalisé</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">%</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Prime Revenus</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-100">Prime TOTALE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-400">
                  Aucune donnée de prime disponible. Calculez les primes pour cette période.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.dsm_id} className="table-row-hover transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                    {row.dsm_name || `DSM #${row.dsm_id}`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatInt(row.creation_objective)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatInt(row.creation_realized)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${achievementColor(row.creation_achievement_pct)}`}>
                      {formatPct(row.creation_achievement_pct)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.creation_prime_amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(row.revenue_objective)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCurrency(row.revenue_realized)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${achievementColor(row.revenue_achievement_pct)}`}>
                      {formatPct(row.revenue_achievement_pct)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.revenue_prime_amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums bg-slate-50 text-brand-700">
                    {formatCurrency(row.total_prime_amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DSMPrimesTable;
