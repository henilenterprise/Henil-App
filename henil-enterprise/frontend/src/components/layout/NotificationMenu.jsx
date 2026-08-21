import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import './NotificationMenu.css';

function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="notification-menu" ref={rootRef}>
      <button
        type="button"
        className="notification-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell size={18} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="notification-menu__panel" role="dialog" aria-label="Notifications">
          <div className="notification-menu__header">
            <p>Notifications</p>
          </div>
          <div className="notification-menu__empty">
            <BellOff size={20} strokeWidth={1.5} />
            <p className="notification-menu__empty-title">You&apos;re all caught up</p>
            <p className="notification-menu__empty-desc">
              There are no notifications right now.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationMenu;
