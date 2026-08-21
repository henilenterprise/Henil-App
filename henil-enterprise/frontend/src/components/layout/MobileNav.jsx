import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Factory, X } from 'lucide-react';
import { NAV_ITEMS } from '../../layouts/navConfig.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useCompany } from '../../hooks/useCompany.js';
import './MobileNav.css';

function MobileNav({ isOpen, onClose }) {
  const { hasModuleAccess } = useAuth();
  const { company } = useCompany();
  const visibleItems = NAV_ITEMS.filter((item) => item.module === null || hasModuleAccess(item.module));

  useEffect(() => {
    if (!isOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
      <div
        className={`mobile-nav-overlay ${isOpen ? 'mobile-nav-overlay--open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`mobile-nav ${isOpen ? 'mobile-nav--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <div className="mobile-nav__header">
          <div className="mobile-nav__brand">
            <div className="mobile-nav__brand-mark">
              <Factory size={16} strokeWidth={1.5} />
            </div>
            <p>{company?.company_name || 'Henil Enterprise'}</p>
          </div>
          <button
            type="button"
            className="mobile-nav__close"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mobile-nav__nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `mobile-nav__link ${isActive ? 'mobile-nav__link--active' : ''}`
              }
            >
              <item.icon size={18} strokeWidth={1.75} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}

export default MobileNav;
