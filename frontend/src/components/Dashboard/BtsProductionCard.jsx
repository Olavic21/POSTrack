import React from 'react';

/**
 * Carte « Production BTS total ».
 * Source exclusive : GET /api/partners/{id}/analytics/bts-production
 * La formule (production = sum(traffic) sinon sum(capacite)) est calculée
 * par le backend — le frontend n'affiche que les valeurs renvoyées.
 */
const formatGb = (v) =>
  v === null || v === undefined ? '—' : `${Number(v).toLocaleString('fr-FR')} Go`;

const BtsProductionCard = ({ loading, production }) => (
  <div className="card overflow-hidden border-l-[3px] border-l-indigo-500">
    <div className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0176d3]">Production BTS total</p>
        <span className="text-[11px] text-slate-400">{loading ? '…' : `${production?.nombre_bts ?? 0} BTS`}</span>
      </div>

      {loading ? (
        <div className="flex h-20 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : !production ? (
        <p className="py-4 text-center text-sm text-slate-400">Aucune donnée de production disponible.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Production totale</span>
            <span className="text-lg font-bold text-slate-900">{formatGb(production.production_totale)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Trafic cumulé</span>
            <span className="text-sm font-semibold text-slate-700">{formatGb(production.production_traffic_gb)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Capacité cumulée</span>
            <span className="text-sm font-semibold text-slate-700">{formatGb(production.production_capacite)}</span>
          </div>
        </div>
      )}
    </div>
  </div>
);

export default BtsProductionCard;
