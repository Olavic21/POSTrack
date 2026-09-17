import React from 'react';

export default function FilterBar({ children, actions, className = '' }) {
  return (
    <div className={`card p-4 flex flex-wrap items-end gap-3 ${className}`}>
      <div className="flex flex-1 flex-wrap items-end gap-3 min-w-0">
        {children}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function FilterField({ label, children }) {
  return (
    <div className="min-w-[180px] flex-1">
      {label ? <label className="label">{label}</label> : null}
      {children}
    </div>
  );
}
