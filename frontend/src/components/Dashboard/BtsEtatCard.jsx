import React, { useState } from 'react';

const STATS = [
  { key: 'Normal', label: 'Normal', valueColor: 'text-emerald-600', dot: 'bg-emerald-500' },
  { key: 'Presque saturé', label: 'Presque saturé', valueColor: 'text-amber-600', dot: 'bg-amber-500' },
  { key: 'Saturé', label: 'Saturé', valueColor: 'text-red-600', dot: 'bg-red-500' },
];

const formatPct = (t) => t === null || t === undefined ? '—' : `${Number(t).toFixed(1)} %`;

const BtsEtatCard = ({ loading, btsEtat }) => {
  const [showDetail, setShowDetail] = useState(false);
  const rows = Array.isArray(btsEtat) ? btsEtat : [];
  const counts = STATS.map((s) => ({ ...s, count: rows.filter((b) => b.etat === s.key).length }));

  return (
    <div className="card overflow-hidden border-l-[3px] border-l-sky-500">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0d9dd1]">État des BTS</p>
          <span className="text-[11px] text-slate-400">{loading ? '…' : `${rows.length} BTS`}</span>
        </div>
        {loading ? (
          <div className="flex h-24 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
        ) : rows.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Aucun BTS enregistré.</p>
        : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {counts.map((c) => (
                <div key={c.key} className="rounded-lg bg-slate-50 p-2 text-center">
                  <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} />
                  <p className={`mt-1 text-lg font-bold ${c.valueColor}`}>{c.count}</p>
                  <p className="text-[11px] text-slate-500">{c.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Seuils: &lt;70% Normal — ≥70% Presque saturé — ≥80% Saturé (backend)</p>
            <button type="button" onClick={() => setShowDetail((v) => !v)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              {showDetail ? 'Masquer le détail' : 'Voir le détail des BTS'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${showDetail ? 'rotate-180' : ''} transition-transform`}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {showDetail ? (
              <div className="mt-3 overflow-x-auto max-h-[320px] overflow-y-auto rounded-lg border border-slate-100">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="py-1.5 px-3">Code BTS</th>
                      <th className="py-1.5 pr-3">Taux</th>
                      <th className="py-1.5">État</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {rows.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-sm font-medium text-slate-700">{b.code_bts}</td>
                        <td className="py-2 pr-3 text-sm text-slate-500">{formatPct(b.taux_saturation)}</td>
                        <td className="py-2 text-sm text-slate-600">{b.etat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default BtsEtatCard;
