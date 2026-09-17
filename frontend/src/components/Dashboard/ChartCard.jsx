import React from 'react';

/**
 * Conteneur uniforme pour les graphiques du dashboard.
 * Gère le titre, le sous-titre et le skeleton de chargement.
 */
const ChartCard = ({ title, subtitle, loading = false, children, className = '', actions = null }) => {
  if (loading) {
    return (
      <div className={`card overflow-hidden ${className}`}>
        <div className="card-header">
          <div className="skeleton h-5 w-40 rounded" />
          <div className="skeleton h-3 w-56 rounded mt-1" />
        </div>
        <div className="card-body flex items-center justify-center" style={{ minHeight: 280 }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="p-5 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="px-2 pb-4" style={{ minHeight: 280 }}>
        {children}
      </div>
    </div>
  );
};

export default ChartCard;
