import React, { useMemo } from 'react';

/**
 * Carte « Réalisation KPI » — réalisations + taux vs objectifs.
 * Données exclusivement issues de
 * GET /api/partners/{partner_id}/analytics/kpi/realisations
 * (les taux sont calculés par le backend, jamais réinventés ici).
 */
const ROWS = [
  ['sell_out', 'Sell-out'],
  ['loading', 'Loading'],
  ['creation_pos', 'Création POS'],
  ['reconduction_pos', 'Déploiement / reconduction POS'],
  ['revenus', 'Revenus'],
];

const tauxColor = (t) => {
  if (t === null || t === undefined) return 'bg-slate-200';
  if (t >= 100) return 'bg-emerald-500';
  if (t >= 75) return 'bg-sky-500';
  return 'bg-amber-500';
};

const RealisationRow = ({ label, real, taux, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-sm font-semibold text-slate-400">…</span>
      </div>
    );
  }
  return (
    <div className="py-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-sm font-bold text-slate-900">
          {Number(real ?? 0).toLocaleString('fr-FR')}
          <span className="ml-2 text-xs font-medium text-slate-500">
            {taux === null || taux === undefined ? '—' : `${taux.toFixed(1)} %`}
          </span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${tauxColor(taux)}`}
          style={{ width: `${Math.min(100, Math.max(0, taux ?? 0))}%` }}
        />
      </div>
    </div>
  );
};

const KpiRealisationsCard = ({ loading, realisations, taux, month }) => (
  <div className="card overflow-hidden border-l-[3px] border-l-emerald-500">
    <div className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2e844a]">Réalisation KPI</p>
        {month ? <span className="text-[11px] text-slate-400">{month}</span> : null}
      </div>
      <div className="mt-2 divide-y divide-slate-50">
        {ROWS.map(([key, label]) => (
          <RealisationRow
            key={key}
            label={label}
            real={realisations?.[key]}
            taux={taux?.[key]}
            loading={loading}
          />
        ))}
      </div>
    </div>
  </div>
);

export default KpiRealisationsCard;
