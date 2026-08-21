import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar.jsx';
import MobileNav from '../components/layout/MobileNav.jsx';
import TopNav from '../components/layout/TopNav.jsx';
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx';
import './AppLayout.css';

function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar />
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="app-shell__main">
        <TopNav onMenuClick={() => setMobileNavOpen(true)} />
        <main className="app-shell__content">
          <div className="container">
            <Breadcrumbs />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
