import { Link } from 'react-router-dom';
import Card from '../ui/Card.jsx';
import Table from '../ui/Table.jsx';
import Badge from '../ui/Badge.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDate } from '../../utils/formatDate.js';

function RecentPaymentsTable({ payments }) {
  return (
    <Card
      title="Recent payments"
      subtitle="Latest payments received from clients"
      actions={<Link to="/payments" className="dashboard-card-link">View all</Link>}
      padding="none"
    >
      <Table
        columns={[
          { key: 'client', header: 'Client' },
          { key: 'invoiceNumber', header: 'Against invoice' },
          {
            key: 'amount',
            header: 'Amount',
            align: 'right',
            render: (row) => formatCurrency(row.amount),
          },
          {
            key: 'method',
            header: 'Method',
            render: (row) => <Badge tone="neutral">{row.method}</Badge>,
          },
          {
            key: 'date',
            header: 'Date',
            render: (row) => formatDate(row.date),
          },
        ]}
        rows={payments}
      />
    </Card>
  );
}

export default RecentPaymentsTable;
