import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import PartnerSelectorBar from './PartnerSelectorBar';

/**
 * Layout principal — Premium SaaS : fond slate-50, sidebar fixe, contenu aéré.
 */
const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <div className="pt-[64px]">
        <div className="relative flex">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="min-h-[calc(100vh-64px)] flex-1 p-4 md:ml-[260px] md:p-6 lg:p-8">
            <div className="mx-auto max-w-[1440px] animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
