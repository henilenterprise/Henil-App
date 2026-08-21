import { Link } from 'react-router-dom';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import './LowStockSection.css';

function LowStockSection({ items }) {
  return (
    <Card
      title="Low stock"
      subtitle="Items at or below their reorder level"
      actions={<Link to="/inventory" className="dashboard-card-link">View all</Link>}
    >
      <ul className="low-stock-list">
        {items.map((item) => {
          const ratio = Math.max(0, Math.min(1, item.stockLeft / item.reorderLevel));
          const critical = item.stockLeft <= item.reorderLevel / 2;
          return (
            <li key={item.id} className="low-stock-item">
              <div className="low-stock-item__info">
                <p className="low-stock-item__name">{item.name}</p>
                <p className="low-stock-item__sku">{item.sku}</p>
              </div>
              <div className="low-stock-item__meter">
                <div className="low-stock-item__bar">
                  <div
                    className={`low-stock-item__bar-fill ${critical ? 'low-stock-item__bar-fill--critical' : ''}`}
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
                <p className="low-stock-item__count">
                  {item.stockLeft} / {item.reorderLevel} {item.unit}
                </p>
              </div>
              <Badge tone={critical ? 'danger' : 'warning'} dot>
                {critical ? 'Critical' : 'Low'}
              </Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default LowStockSection;
