import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getNavItemByPath } from '../../layouts/navConfig.js';
import './Breadcrumbs.css';

function Breadcrumbs() {
  const location = useLocation();
  const currentItem = getNavItemByPath(location.pathname);

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to="/dashboard">Home</Link>
        </li>
        {currentItem && (
          <li>
            <ChevronRight size={13} className="breadcrumbs__sep" aria-hidden="true" />
            <span aria-current="page">{currentItem.label}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
