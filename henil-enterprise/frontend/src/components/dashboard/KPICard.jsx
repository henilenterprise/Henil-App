import { Circle } from 'lucide-react';
import Card from '../ui/Card.jsx';
import './KPICard.css';

/*
  tone: 'default' | 'success' | 'warning' | 'danger'
  Controls the icon badge color only — keeps the dashboard from
  looking like a traffic-light chart while still flagging attention
  items (e.g. Overdue, Low Stock) at a glance.

  `icon` defaults to a plain circle: callers with a fixed, known set
  of metrics (Dashboard, Finance, Inventory) should still pass a
  meaningful icon, but callers rendering a dynamic list of metrics
  they don't control ahead of time (Reports) can safely omit it
  instead of crashing.
*/
function KPICard({ icon: Icon = Circle, label, value, hint, tone = 'default' }) {
  return (
    <Card className="kpi-card" padding="sm">
      <div className={`kpi-card__icon kpi-card__icon--${tone}`}>
        <Icon size={17} strokeWidth={1.75} />
      </div>
      <p className="kpi-card__label">{label}</p>
      <p className="kpi-card__value">{value}</p>
      {hint && <p className="kpi-card__hint">{hint}</p>}
    </Card>
  );
}

export default KPICard;
