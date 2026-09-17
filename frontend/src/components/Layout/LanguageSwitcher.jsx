import React, { useEffect, useRef, useState } from 'react';
import { LanguageIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../../i18n';

export default function LanguageSwitcher() {
  const { lang, changeLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
        aria-label={t('lang_switch')}
        aria-expanded={open}
      >
        <LanguageIcon className="h-4 w-4 text-slate-500" />
        <span>{lang === 'fr' ? 'FR' : 'EN'}</span>
        <ChevronDownIcon className={`h-3 w-3 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-50 py-1">
          <button
            type="button"
            onClick={() => { changeLang('fr'); setOpen(false); }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${lang==='fr' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            <span>🇫🇷</span> {t('lang_fr')} {lang==='fr' ? <span className="ml-auto text-indigo-600">✓</span> : null}
          </button>
          <button
            type="button"
            onClick={() => { changeLang('en'); setOpen(false); }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${lang==='en' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            <span>🇬🇧</span> {t('lang_en')} {lang==='en' ? <span className="ml-auto text-indigo-600">✓</span> : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}
