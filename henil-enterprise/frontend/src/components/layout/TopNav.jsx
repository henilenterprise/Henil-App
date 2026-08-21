import { useState } from 'react';
import { Menu } from 'lucide-react';
import SearchBar from '../ui/SearchBar.jsx';
import NotificationMenu from './NotificationMenu.jsx';
import UserMenu from './UserMenu.jsx';
import './TopNav.css';

function TopNav({ onMenuClick }) {
  const [search, setSearch] = useState('');

  return (
    <header className="topnav">
      <button
        type="button"
        className="topnav__menu-btn"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      <div className="topnav__search">
        <SearchBar
          placeholder="Search clients, products, invoices…"
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
        />
      </div>

      <div className="topnav__actions">
        <NotificationMenu />
        <span className="topnav__divider" aria-hidden="true" />
        <UserMenu />
      </div>
    </header>
  );
}

export default TopNav;
