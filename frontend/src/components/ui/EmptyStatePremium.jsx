import React from 'react';

export default function EmptyStatePremium({ title = 'Aucune donnée disponible', description = null, icon = '📊', action = null, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 ${compact ? 'px-6 py-8' : 'px-8 py-12'}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm text-xl mb-4">{icon}</div>
      <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      {description ? <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
