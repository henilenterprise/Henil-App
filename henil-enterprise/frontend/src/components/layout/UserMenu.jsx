import { ChevronDown, User, Building2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Dropdown from '../ui/Dropdown.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import './UserMenu.css';

function getInitials(email) {
  if (!email) return '?';
  return email.slice(0, 2).toUpperCase();
}

function UserMenu() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const email = user?.email || 'Signed in';

  async function handleLogout() {
    await signOut();
    toast.info('Signed out', 'You have been signed out.');
    navigate('/login');
  }

  return (
    <Dropdown
      align="right"
      trigger={
        <button type="button" className="user-menu-trigger">
          <span className="user-menu-avatar">{getInitials(email)}</span>
          <span className="user-menu-name">{email}</span>
          <ChevronDown size={14} className="user-menu-chevron" />
        </button>
      }
      items={[
        { label: 'Profile', icon: User, onClick: () => toast.info('Profile', 'Coming in a later phase.') },
        { label: 'Company settings', icon: Building2, onClick: () => navigate('/settings') },
        { divider: true },
        { label: 'Log out', icon: LogOut, tone: 'danger', onClick: handleLogout },
      ]}
    />
  );
}

export default UserMenu;
