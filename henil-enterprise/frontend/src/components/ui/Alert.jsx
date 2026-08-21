import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import './Alert.css';

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
};

/*
  tone: 'success' | 'warning' | 'danger' | 'info'
*/
function Alert({ tone = 'info', title, children, onDismiss }) {
  const Icon = ICONS[tone] || Info;
  return (
    <div className={`alert alert--${tone}`} role="alert">
      <Icon size={18} className="alert__icon" aria-hidden="true" />
      <div className="alert__content">
        {title && <p className="alert__title">{title}</p>}
        {children && <div className="alert__body">{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" className="alert__dismiss" onClick={onDismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default Alert;
