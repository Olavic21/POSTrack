import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bars3Icon } from '@heroicons/react/24/outline';
import useAuth from '../../hooks/useAuth';
import { getRoleLabel } from '../../utils/roles';
import Button from '../Common/Button/Button';
import HierarchyNavDropdown from './HierarchyNavDropdown';
import Logo from '../../assets/logos/LOGO.jpeg';

/**
 * Header applicatif - style Salesforce : propre, minimal, bordure fine.
 */
const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName =
    user?.nom_complet || user?.full_name || user?.email || 'Utilisateur';
  const roleLabel = getRoleLabel(user?.role);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[60px] items-center justify-between border-b border-[#e5e5e5] bg-white px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded text-[#444746] transition-colors hover:bg-[#f3f2f2] md:hidden"
          onClick={onToggleSidebar}
          aria-label="Ouvrir le menu"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <img src={Logo} alt="POSTrack" className="h-8 w-8 rounded object-cover" />
          <span className="text-[15px] font-bold tracking-tight text-[#032d60]">POSTrack</span>
        </Link>
        <div className="hidden h-4 w-px bg-[#dddbda] sm:block" />
        <HierarchyNavDropdown />
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-[13px] font-semibold text-[#181818]">{displayName}</p>
          <p className="text-[11px] text-[#706e6b]">{roleLabel}</p>
        </div>

        <Button type="button" variant="gray" className="text-[13px]" onClick={handleLogout}>
          Déconnexion
        </Button>
      </div>
    </header>
  );
};

export default Header;
