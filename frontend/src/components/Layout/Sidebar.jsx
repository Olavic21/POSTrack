import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Squares2X2Icon,
  MapPinIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
  SignalIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  FlagIcon,
  HomeIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ArrowUpTrayIcon,
  TrophyIcon,
  ClipboardDocumentCheckIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import useAuth from '../../hooks/useAuth';
import usePartner from '../../hooks/usePartner';
import useNavigationLevel from '../../hooks/useNavigationLevel';
import { NAV_ITEMS, NAV_LEVELS } from '../../utils/constants';
import { filterNavByRole } from '../../utils/roles';
import { useI18n } from '../../i18n';

const ICON_MAP = {
  dashboard: Squares2X2Icon,
  geolocalisation: MapPinIcon,
  dsm: UserGroupIcon,
  pos: BuildingStorefrontIcon,
  bts: SignalIcon,
  ventes: ChartBarIcon,
  'suivi-quotidien': CalendarDaysIcon,
  requetes: ClipboardDocumentListIcon,
  primes: BanknotesIcon,
  'primes-objectives': FlagIcon,
  'accueil-partenaire': HomeIcon,
  partenaires: BuildingOfficeIcon,
  utilisateurs: UsersIcon,
  'import-export': ArrowUpTrayIcon,
  'sales-targets': TrophyIcon,
  audit: ClipboardDocumentCheckIcon,
  'dsm-dashboard': Squares2X2Icon,
  'dsm-pos': BuildingStorefrontIcon,
  'dsm-bts': SignalIcon,
  'dsm-ventes': ChartBarIcon,
  'dsm-suivi-quotidien': CalendarDaysIcon,
  'dsm-requetes': ClipboardDocumentListIcon,
  'pos-list': BuildingStorefrontIcon,
  'pos-bts': SignalIcon,
  'pos-ventes': ChartBarIcon,
  'pos-suivi-quotidien': CalendarDaysIcon,
  'pos-requetes': ClipboardDocumentListIcon,
};

const SECTION_LABELS_FR = {
  overview: 'nav_overview',
  operations: 'nav_operations',
  gestion: 'nav_partner_mgmt',
  admin: 'nav_admin',
};

const NAV_LABEL_KEY = {
  dashboard: 'nav_dashboard',
  geolocalisation: 'nav_geolocation',
  dsm: 'nav_dsm',
  pos: 'nav_pos',
  bts: 'nav_bts',
  ventes: 'nav_sales',
  'suivi-quotidien': 'nav_daily',
  requetes: 'nav_requests',
  primes: 'nav_primes',
  'primes-objectives': 'nav_objectives',
  'accueil-partenaire': 'nav_partner_home',
  partenaires: 'nav_partners',
  utilisateurs: 'nav_users',
  'import-export': 'nav_import',
  'sales-targets': 'nav_kpi_objectives',
  audit: 'nav_audit',
};

function groupItems(items) {
  const overview = items.filter((i) => ['dashboard', 'geolocalisation'].includes(i.id));
  const operations = items.filter((i) => ['dsm', 'pos', 'bts', 'ventes', 'suivi-quotidien', 'requetes'].includes(i.id));
  const gestion = items.filter((i) => ['primes', 'primes-objectives', 'accueil-partenaire'].includes(i.id));
  const admin = items.filter((i) => ['partenaires', 'utilisateurs', 'import-export', 'sales-targets', 'audit'].includes(i.id));
  // DSM / POS levels don't have grouping, just flat
  return { overview, operations, gestion, admin };
}

const Sidebar = ({ open = false, onClose }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const { partner, clearPartner } = usePartner();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { level, isPartner, isDsm, isPos, setLevel } = useNavigationLevel();

  const items = useMemo(() => {
    const levelItems = NAV_ITEMS.filter((item) => item.level === level);
    return filterNavByRole(levelItems, user);
  }, [user, level]);

  const grouped = useMemo(() => (isPartner ? groupItems(items) : null), [items, isPartner]);

  const handleLogout = async () => {
    await logout();
    onClose?.();
    navigate('/login', { replace: true });
  };
  const handleClearContext = () => {
    setLevel?.(NAV_LEVELS.PARTNER);
    clearPartner();
    navigate('/');
    onClose?.();
  };
  const handleBackToPartner = () => {
    setLevel?.(NAV_LEVELS.PARTNER);
    navigate('/dashboard');
    onClose?.();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm transition-all md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-slate-200 bg-white pt-[64px] transition-transform duration-200 ease-out md:translate-x-0 ${open ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`}
        aria-label="Navigation principale"
      >
        <div className="flex-1 overflow-y-auto">
          {/* Partner context card */}
          {partner ? (
            <div className="m-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">{t('nav_active_context')}</p>
              <p className="mt-1 truncate text-[13px] font-extrabold text-slate-900">{partner.nom || partner.code_partenaire || `Partenaire #${partner.id}`}</p>
              <p className="text-[11px] text-indigo-600/70 truncate">{partner.ville || partner.region || 'Partenaire sélectionné'}</p>
              <button type="button" onClick={handleClearContext} className="mt-2 w-full rounded-xl bg-white border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">{t('nav_change')}</button>
            </div>
          ) : null}

          {!isPartner ? (
            <button
              type="button"
              onClick={handleBackToPartner}
              className="mx-3 mb-3 flex w-[calc(100%-24px)] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
            >
              <ArrowLeftIcon className="h-4 w-4" /> {t('nav_back_partner')}
            </button>
          ) : null}

          <nav className="px-2 pb-4">
            {isPartner && grouped ? (
              <div className="space-y-5">
                {[
                  { key: 'overview', items: grouped.overview },
                  { key: 'operations', items: grouped.operations },
                  { key: 'gestion', items: grouped.gestion },
                  { key: 'admin', items: grouped.admin },
                ].map((section) =>
                  section.items.length === 0 ? null : (
                    <div key={section.key}>
                      <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t(SECTION_LABELS_FR[section.key])}</p>
                      <div className="space-y-0.5">
                        {section.items.map((item) => {
                          const Icon = ICON_MAP[item.id] || Squares2X2Icon;
                          return (
                            <NavLink
                              key={item.id}
                              to={item.to}
                              end={item.end}
                              onClick={() => {
                                if (item.enterLevel && setLevel) setLevel(item.enterLevel);
                                onClose?.();
                              }}
                              className={({ isActive }) =>
                                `group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition ${isActive ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`
                              }
                            >
                              <Icon className="h-[18px] w-[18px] shrink-0 opacity-80 group-[.bg-indigo-50]:opacity-100" />
                              <span className="truncate">{t(NAV_LABEL_KEY[item.id] || item.label)}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = ICON_MAP[item.id] || Squares2X2Icon;
                  return (
                    <NavLink
                      key={item.id}
                      to={item.to}
                      end={item.end}
                      onClick={() => {
                        if (item.enterLevel && setLevel) setLevel(item.enterLevel);
                        onClose?.();
                      }}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition ${isActive ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`
                      }
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span>{t(NAV_LABEL_KEY[item.id] || item.label)}</span>
                    </NavLink>
                  );
                })}
                {items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">{t('nav_no_nav')}</div>
                )}
              </div>
            )}
          </nav>
        </div>

        <div className="border-t border-slate-200 p-3">
          <div className="rounded-xl bg-slate-900 px-3 py-3 text-white">
            <p className="text-xs font-bold">POSTrack Premium</p>
            <p className="text-[11px] text-slate-300">Plateforme de pilotage commercial</p>
            <p className="mt-2 text-[10px] font-mono text-slate-400">v4.0 • {isDsm ? 'DSM' : isPos ? 'POS' : 'Partenaire'}</p>
          </div>
          <button type="button" onClick={handleLogout} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-red-600">
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
