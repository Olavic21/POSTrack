import React from 'react';

export default function ProgressBar({ value = 0, tone = 'brand', className = '' }) {
  const toneCls = {
    brand: 'bg-indigo-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-sky-500',
  }[tone] ?? 'bg-indigo-500';
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={`progress-track ${className}`}>
      <div className={`progress-fill ${toneCls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
