import React from 'react';

export default function SectionHeader({ title, subtitle, actions, icon, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="flex gap-3 min-w-0">
        {icon ? <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{icon}</div> : null}
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm leading-relaxed text-slate-500 max-w-2xl">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
