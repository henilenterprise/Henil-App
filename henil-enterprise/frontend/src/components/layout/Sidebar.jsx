import { NavLink } from 'react-router-dom';
import { Factory } from 'lucide-react';
import { NAV_ITEMS } from '../../layouts/navConfig.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useCompany } from '../../hooks/useCompany.js';
import './Sidebar.css';

function Sidebar() {
  const { hasModuleAccess } = useAuth();
  const { company } = useCompany();
  const visibleItems = NAV_ITEMS.filter((item) => item.module === null || hasModuleAccess(item.module));

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark">
          <Factory size={18} strokeWidth={1.5} />
        </div>
        <div>
          <p className="sidebar__brand-name">{company?.company_name || 'Henil Enterprise'}</p>
          <p className="sidebar__brand-sub">Business Management</p>
        </div>
      </div>

      <nav className="sidebar__nav">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
          >
            <item.icon size={17} strokeWidth={1.75} className="sidebar__link-icon" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <p>Acrylic &amp; Polycarbonate</p>
        <p>Manufacturing &amp; Fabrication</p>
      </div>
    </aside>
  );
}

export default Sidebar;
