import React, { useState } from 'react'

export default function CollapsibleCard({ title, subtitle, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          {subtitle ? <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p> : null}
        </div>
        <span className="flex items-center gap-2">
          {badge ? <span className="text-xs font-semibold text-slate-500">{badge}</span> : null}
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
          </span>
          <span className="hidden sm:inline text-xs font-semibold text-brand-600">{open ? 'Masquer' : 'Voir le détail'}</span>
        </span>
      </button>
      {open ? <div className="border-t border-slate-100 p-4">{children}</div> : null}
    </div>
  )
}
