import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import PartnerSelectorBar from './PartnerSelectorBar';

/**
 * Layout principal - style Salesforce : fond gris clair, sidebar blanche, header propre.
 */
const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f3f3f3]">
      <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <div className="pt-[60px]">
        <PartnerSelectorBar />
        <div className="relative flex">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="min-h-[calc(100vh-60px)] flex-1 p-4 md:ml-60 md:p-5 lg:p-6">
            <div className="mx-auto max-w-[1400px] animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
