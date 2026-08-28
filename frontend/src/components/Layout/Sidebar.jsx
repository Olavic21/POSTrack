import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import useAuth from '../../hooks/useAuth';
import usePartner from '../../hooks/usePartner';
import useNavigationLevel from '../../hooks/useNavigationLevel';
import { NAV_ITEMS, NAV_LEVELS } from '../../utils/constants';
import { filterNavByRole } from '../../utils/roles';

/**
 * Sidebar de navigation - style Salesforce : actif = bordure gauche + fond colore leger.
 */
const Sidebar = ({ open = false, onClose }) => {
  const { user } = useAuth();
  const { partner, clearPartner } = usePartner();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { level, isPartner, isDsm, isPos, setLevel } = useNavigationLevel();

  const items = useMemo(() => {
    const levelItems = NAV_ITEMS.filter((item) => item.level === level);
    return filterNavByRole(levelItems, user);
  }, [user, level]);

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

  // Salesforce-style active colors per level
  const activeClasses = isDsm
    ? 'bg-purple-50 border-l-purple-600 text-purple-900 font-semibold'
    : isPos
      ? 'bg-emerald-50 border-l-emerald-600 text-emerald-900 font-semibold'
      : 'bg-blue-50 border-l-blue-600 text-blue-900 font-semibold';

  const levelLabel = isDsm ? 'DSM' : isPos ? 'POS' : 'Partenaire';
  const levelColor = isDsm ? 'text-purple-500' : isPos ? 'text-emerald-500' : 'text-blue-500';

  return (
    <>
      {/* Overlay mobile */}
      <div
        className={`fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] transition-all md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-[#e5e5e5] bg-white pt-[60px] transition-transform duration-200 ease-out md:translate-x-0 ${
          open ? 'translate-x-0 shadow-lg' : '-translate-x-full'
        }`}
        aria-label="Navigation principale"
      >
        {/* Level indicator */}
        <div className="border-b border-[#e5e5e5] px-4 py-2.5">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${levelColor}`}>
            {levelLabel}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-[#181818]">Navigation</p>
        </div>

        <nav className="flex-1 space-y-px overflow-y-auto px-0 py-2">
          {/* Back to partner level */}
          {!isPartner && (
            <button
              type="button"
              onClick={handleBackToPartner}
              className="mb-2 flex w-full items-center gap-2 border-l-2 border-transparent px-4 py-2 text-left text-[13px] font-medium text-[#0176d3] transition-colors hover:bg-blue-50/50 hover:text-[#014486]"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Retour Partenaire</span>
            </button>
          )}

          {/* Active partner context */}
          {partner && (
            <button
              type="button"
              className="mb-2 mx-3 w-[calc(100%-24px)] rounded border border-[#e5e5e5] bg-[#fafaf9] px-3 py-2 text-left transition-colors hover:bg-[#f3f2f2]"
              onClick={handleClearContext}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0176d3]">Contexte</span>
              <p className="mt-0.5 truncate text-[13px] font-semibold text-[#181818]">
                {partner.nom || partner.code_partenaire || `Partenaire #${partner.id}`}
              </p>
            </button>
          )}

          {/* Navigation items */}
          {items.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.end}
              onClick={() => {
                if (item.enterLevel && setLevel) {
                  setLevel(item.enterLevel);
                }
                onClose?.();
              }}
              className={({ isActive }) =>
                `flex items-center border-l-[3px] px-4 py-[7px] text-[13px] transition-colors duration-100 ${
                  isActive
                    ? `${activeClasses} border-l-current`
                    : 'border-l-transparent text-[#444746] hover:bg-[#f3f2f2] hover:text-[#181818]'
                }`
              }
            >
              <span>{item.label}</span>
            </NavLink>
          ))}

          {items.length === 0 && (
            <div className="mx-4 rounded border border-[#e5e5e5] bg-[#fafaf9] px-4 py-5 text-center">
              <p className="text-[13px] text-[#706e6b]">Aucune navigation disponible</p>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-[#e5e5e5] px-4 py-3">
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[#939393]">
            POSTrack v3.1
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-transparent px-3 py-1.5 text-[13px] font-medium text-[#706e6b] transition-colors hover:border-[#e5e5e5] hover:bg-[#f3f2f2] hover:text-[#ea001e]"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
