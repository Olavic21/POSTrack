import React from 'react';

const PageHeader = ({ title = '', subtitle = '', actions = null, breadcrumbs = [], eyebrow = null }) => {
  return (
    <div className="mb-6">
      {breadcrumbs?.length ? (
        <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500" aria-label="Fil d'Ariane">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 ? <span className="text-slate-300">/</span> : null}
              <span className={index === breadcrumbs.length - 1 ? 'font-semibold text-slate-700' : ''}>{crumb}</span>
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">{eyebrow}</p> : null}
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 leading-none">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
};

export default PageHeader;
