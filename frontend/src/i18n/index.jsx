import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import fr from './fr.js';
import en from './en.js';

const dicts = { fr, en };
const STORAGE_KEY = 'postrack_lang';

export const I18nContext = createContext(null);

export function getInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('en')) return 'en';
    return 'fr';
  } catch { return 'fr'; }
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be inside I18nProvider');
  return ctx;
}

export function tFactory(lang) {
  const d = dicts[lang] || dicts.fr;
  return (key) => d[key] ?? key;
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang);
  const t = useCallback((key) => {
    const d = dicts[lang] || dicts.fr;
    return d[key] ?? key;
  }, [lang]);

  const changeLang = useCallback((next) => {
    const v = next === 'en' ? 'en' : 'fr';
    setLang(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch {}
    try { document.documentElement.lang = v; } catch {}
  }, []);

  useEffect(() => {
    try { document.documentElement.lang = lang; } catch {}
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, t, changeLang }}>
      {children}
    </I18nContext.Provider>
  );
}

// Hook for non-context usage (persisted lang read)
export function useLang() { return useI18n(); }
