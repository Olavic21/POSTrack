import React from 'react';

const formatGb = (v) => v === null || v === undefined ? '—' : `${Number(v).toLocaleString('fr-FR')} Go`;

const BtsProductionCard = ({ loading, production }) => (
  <div className="card p-5">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold text-slate-900">Production BTS</h3>
      <span className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">{loading ? '…' : `${production?.nombre_bts ?? 0} BTS`}</span>
    </div>
    {loading ? (
      <div className="flex h-20 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>
    ) : !production ? (
      <p className="py-8 text-center text-sm text-slate-400">Aucune donnée de production disponible.</p>
    ) : (
      <div className="mt-4 space-y-3">
        <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Production totale</span>
          <span className="text-xl font-extrabold text-indigo-700">{formatGb(production.production_totale)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Trafic</span>
            <span className="mt-1 text-sm font-bold text-slate-900">{formatGb(production.production_traffic_gb)}</span>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Capacité</span>
            <span className="mt-1 text-sm font-bold text-slate-900">{formatGb(production.production_capacite)}</span>
          </div>
        </div>
      </div>
    )}
  </div>
);

export default BtsProductionCard;
