import { Inbox } from 'lucide-react';
import './EmptyState.css';

function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  action,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Icon size={24} strokeWidth={1.5} />
      </div>
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export default EmptyState;
