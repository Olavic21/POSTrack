import React, { useState } from 'react';

const STATS = [
  { key: 'Normal', label: 'Normal', valueColor: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  { key: 'Presque saturé', label: 'Presque saturé', valueColor: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  { key: 'Saturé', label: 'Saturé', valueColor: 'text-red-600', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
];

const formatPct = (t) => t === null || t === undefined ? '—' : `${Number(t).toFixed(1)}%`;

const BtsEtatCard = ({ loading, btsEtat }) => {
  const [showDetail, setShowDetail] = useState(false);
  const rows = Array.isArray(btsEtat) ? btsEtat : [];
  const counts = STATS.map((s) => ({ ...s, count: rows.filter((b) => b.etat === s.key).length }));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">État des BTS</h3>
        <span className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">{loading ? '…' : `${rows.length} BTS`}</span>
      </div>
      {loading ? (
        <div className="flex h-24 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>
      ) : rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Aucune BTS enregistrée pour ce partenaire.</p>
      : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {counts.map((c) => (
              <div key={c.key} className={`rounded-2xl border p-4 text-center ${c.bg}`}>
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.dot}`} />
                <p className={`mt-1 text-2xl font-extrabold ${c.valueColor}`}>{c.count}</p>
                <p className="text-[11px] font-semibold text-slate-600">{c.label}</p>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setShowDetail((v) => !v)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
            {showDetail ? 'Masquer le détail' : 'Voir le détail'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${showDetail ? 'rotate-180' : ''} transition-transform`}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {showDetail ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 max-h-[320px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="py-2 px-4">Code BTS</th>
                    <th className="py-2 px-4">Taux</th>
                    <th className="py-2 px-4">État</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 text-sm font-semibold text-slate-700">{b.code_bts}</td>
                      <td className="py-2.5 px-4 text-sm text-slate-600">{formatPct(b.taux_saturation)}</td>
                      <td className="py-2.5 px-4"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${b.etat==='Normal'?'bg-emerald-50 text-emerald-700 border border-emerald-200': b.etat==='Saturé'?'bg-red-50 text-red-700 border border-red-200':'bg-amber-50 text-amber-700 border border-amber-200'}`}>{b.etat}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default BtsEtatCard;
