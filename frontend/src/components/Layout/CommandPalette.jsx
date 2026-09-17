import React, { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '../../utils/constants';
import { useI18n } from '../../i18n';
import usePartner from '../../hooks/usePartner';

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { partner } = usePartner();
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) setQ('');
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = NAV_ITEMS.filter(i => i.level === 'partner');
    if (!needle) return pool.slice(0, 7);
    return pool.filter(i => i.label.toLowerCase().includes(needle)).slice(0, 8);
  }, [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh] px-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-fade-in-scale">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('header_search')}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"
          />
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">ESC</button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">{t('common_no_data')}</p> : results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { navigate(item.to); onClose?.(); }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-slate-50"
            >
              <span className="text-sm font-medium text-slate-800">{item.label}</span>
              <span className="text-xs text-slate-400">{item.to}</span>
            </button>
          ))}
        </div>
        {partner ? <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-500">{t('common_partner')} : <span className="font-semibold text-slate-700">{partner.nom || partner.code_partenaire}</span></div> : null}
      </div>
    </div>
  );
}
