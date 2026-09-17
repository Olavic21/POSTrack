import React, { useEffect, useRef, useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../../i18n';

export default function NotificationBell() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-sm"
        aria-label={t('header_notifications')}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <BellIcon className="h-5 w-5" />
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden z-50 animate-fade-in-scale">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{t('notifications_title')}</h3>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">{t('common_close')}</button>
          </div>
          <div className="px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200">
              <BellIcon className="h-6 w-6 text-slate-400" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-900">{t('notifications_empty')}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('notifications_empty_desc')}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
