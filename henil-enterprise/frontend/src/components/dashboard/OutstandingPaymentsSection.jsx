import { Link } from 'react-router-dom';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import './OutstandingPaymentsSection.css';

function severityTone(daysOverdue) {
  if (daysOverdue <= 0) return 'info';
  if (daysOverdue <= 15) return 'warning';
  return 'danger';
}

function severityLabel(daysOverdue) {
  if (daysOverdue <= 0) return 'Not yet due';
  return `${daysOverdue} days overdue`;
}

function OutstandingPaymentsSection({ items }) {
  return (
    <Card
      title="Outstanding payments"
      subtitle="Invoices awaiting full payment"
      actions={<Link to="/payments" className="dashboard-card-link">View all</Link>}
    >
      <ul className="outstanding-list">
        {items.map((item) => (
          <li key={item.id} className="outstanding-item">
            <div className="outstanding-item__info">
              <p className="outstanding-item__client">{item.client}</p>
              <p className="outstanding-item__invoice">{item.invoiceNumber}</p>
            </div>
            <p className="outstanding-item__amount">{formatCurrency(item.amount)}</p>
            <Badge tone={severityTone(item.daysOverdue)}>{severityLabel(item.daysOverdue)}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default OutstandingPaymentsSection;
