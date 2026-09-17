import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bars3Icon } from '@heroicons/react/24/outline';
import useAuth from '../../hooks/useAuth';
import usePartner from '../../hooks/usePartner';
import { getRoleLabel } from '../../utils/roles';
import { useI18n } from '../../i18n';
import Logo from '../../assets/logos/LOGO.jpeg';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';
import CommandPalette from './CommandPalette';

const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { partner } = usePartner();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);
  const displayName = user?.nom_complet || user?.full_name || user?.email || 'Utilisateur';
  const initials = displayName.slice(0, 2).toUpperCase();
  const roleLabel = getRoleLabel(user?.role);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-[64px] items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-xl lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 md:hidden"
            onClick={onToggleSidebar}
            aria-label="Open menu"
          >
            <Bars3Icon className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link to="/" className="flex items-center gap-3">
            <img src={Logo} alt="POSTrack" className="h-9 w-9 rounded-xl object-cover shadow-sm ring-1 ring-slate-200" />
            <div className="hidden sm:block">
              <p className="text-[15px] font-extrabold leading-none tracking-tight text-slate-900">POSTrack</p>
              <p className="text-[11px] font-semibold tracking-wide text-slate-500">{t('header_performance')}</p>
            </div>
            <span className="sm:hidden text-[15px] font-extrabold tracking-tight text-slate-900">POSTrack</span>
          </Link>
          {partner ? (
            <div className="hidden lg:flex items-center gap-2 ml-3 pl-3 border-l border-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[160px]">{partner.nom || partner.code_partenaire}</span>
              <span className="hidden xl:inline rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">{t('header_partner')}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="hidden md:flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 hover:bg-white transition"
            aria-label={t('header_search')}
          >
            <span className="text-xs text-slate-500">{t('header_search')}</span>
            <span className="ml-2 hidden lg:inline rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">⌘K</span>
          </button>
          <LanguageSwitcher />
          <NotificationBell />
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-3 pl-1">
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-bold leading-none text-slate-900">{displayName}</p>
              <p className="text-[11px] font-medium text-slate-500">{roleLabel}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xs font-extrabold text-white shadow-sm ring-1 ring-indigo-200">
              {initials}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              {t('header_logout')}
            </button>
          </div>
        </div>
      </header>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
};

export default Header;
