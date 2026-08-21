import { useEffect, useRef, useState } from 'react';
import './Dropdown.css';

/*
  items: [{ label, icon: LucideIcon, onClick, tone: 'default' | 'danger', divider?: bool }]
  align: 'left' | 'right'
*/
function Dropdown({ trigger, items = [], align = 'left' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
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
    <div className="dropdown" ref={rootRef}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div className={`dropdown__menu dropdown__menu--${align}`} role="menu">
          {items.map((item, i) =>
            item.divider ? (
              <div className="dropdown__divider" key={`divider-${i}`} />
            ) : (
              <button
                type="button"
                key={item.label}
                role="menuitem"
                className={`dropdown__item ${item.tone === 'danger' ? 'dropdown__item--danger' : ''}`}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
              >
                {item.icon && <item.icon size={15} className="dropdown__item-icon" />}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default Dropdown;
