import React, { useMemo } from 'react';

/**
 * Carte « Objectifs KPI » — affiche les objectifs fixés pour le mois
 * (sell-out, loading, création POS, reconduction POS, revenus).
 * Les valeurs proviennent exclusivement de
 * GET /api/partners/{partner_id}/analytics/kpi/objectives
 * (aucun seuil ni valeur codée en dur côté frontend).
 */
const LABELS = [
  ['sell_out', 'Objectif Sell-out'],
  ['loading', 'Objectif Loading'],
  ['creation_pos', 'Objectif création POS'],
  ['reconduction_pos', 'Objectif reconduction POS'],
  ['revenus', 'Objectif revenus'],
];

const formatValue = (v) => {
  if (v === null || v === undefined) return 'Non défini';
  return `${Number(v).toLocaleString('fr-FR')}`;
};

const KpiObjectivesCard = ({ loading, objectifs, month }) => {
  const rows = useMemo(
    () => LABELS.map(([key, label]) => ({ key, label, value: objectifs?.[key] })),
    [objectifs]
  );

  return (
    <div className="card overflow-hidden border-l-[3px] border-l-brand-500">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">Objectifs KPI</p>
          {month ? <span className="text-[11px] text-slate-400">{month}</span> : null}
        </div>
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.key} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{r.label}</span>
                <span className="text-sm font-bold text-slate-900">{formatValue(r.value)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default KpiObjectivesCard;
