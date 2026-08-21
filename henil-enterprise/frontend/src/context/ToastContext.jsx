import { createContext, useCallback, useContext, useRef, useState } from 'react';
import ToastViewport from '../components/ui/Toast.jsx';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const showToast = useCallback(
    ({ tone = 'info', title, description, duration = 4000 }) => {
      const id = `toast-${(idCounter += 1)}`;
      setToasts((prev) => [...prev, { id, tone, title, description }]);
      if (duration > 0) {
        timers.current[id] = setTimeout(() => dismissToast(id), duration);
      }
      return id;
    },
    [dismissToast]
  );

  const toast = {
    show: showToast,
    success: (title, description, opts) => showToast({ tone: 'success', title, description, ...opts }),
    error: (title, description, opts) => showToast({ tone: 'danger', title, description, ...opts }),
    warning: (title, description, opts) => showToast({ tone: 'warning', title, description, ...opts }),
    info: (title, description, opts) => showToast({ tone: 'info', title, description, ...opts }),
    dismiss: dismissToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
