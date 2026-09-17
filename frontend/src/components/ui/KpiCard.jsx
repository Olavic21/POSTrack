import React from 'react';

const toneMap = {
  default: { label: 'text-slate-500', value: 'text-slate-900', accent: 'border-slate-200', iconBg: 'bg-slate-100 text-slate-600' },
  brand:   { label: 'text-indigo-600', value: 'text-slate-900', accent: 'border-indigo-200', iconBg: 'bg-indigo-50 text-indigo-600' },
  success: { label: 'text-emerald-600', value: 'text-emerald-900', accent: 'border-emerald-200', iconBg: 'bg-emerald-50 text-emerald-600' },
  warning: { label: 'text-amber-600', value: 'text-amber-900', accent: 'border-amber-200', iconBg: 'bg-amber-50 text-amber-600' },
  danger:  { label: 'text-red-600', value: 'text-red-900', accent: 'border-red-200', iconBg: 'bg-red-50 text-red-600' },
  info:    { label: 'text-sky-600', value: 'text-sky-900', accent: 'border-sky-200', iconBg: 'bg-sky-50 text-sky-600' },
};

export default function KpiCard({ label, value, sublabel, icon, tone = 'default', trend = null, progress = null, loading = false, className = '', children = null }) {
  const t = toneMap[tone] ?? toneMap.default;
  if (loading) {
    return (
      <div className={`card p-5 ${className}`}>
        <div className="skeleton h-3 w-24 mb-3" />
        <div className="skeleton h-8 w-20 mb-2" />
        <div className="skeleton h-2 w-full" />
      </div>
    );
  }
  return (
    <div className={`card card-hover p-5 flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`kpi-label ${t.label}`}>{label}</p>
          <p className={`kpi-value mt-2 ${t.value}`}>{value ?? '—'}</p>
          {sublabel ? <p className="kpi-sub mt-1">{sublabel}</p> : null}
          {children}
        </div>
        {icon ? (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.iconBg}`}>
            <span className="text-lg leading-none">{icon}</span>
          </div>
        ) : null}
      </div>
      {typeof progress === 'number' ? (
        <div className="mt-4">
          <div className="progress-track"><div className="progress-fill bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>
          <p className="mt-1.5 text-xs font-semibold text-slate-500">{progress.toFixed(0)}% de l’objectif</p>
        </div>
      ) : null}
      {trend ? <p className={`mt-2 text-xs font-semibold ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>{trend.value}</p> : null}
    </div>
  );
}
