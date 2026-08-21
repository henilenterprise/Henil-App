import { Link } from 'react-router-dom';
import Card from '../ui/Card.jsx';
import Table from '../ui/Table.jsx';
import Badge from '../ui/Badge.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDate } from '../../utils/formatDate.js';
import { QUOTATION_STATUS_TONE } from './statusTones.js';

function RecentQuotationsTable({ quotations }) {
  return (
    <Card
      title="Recent quotations"
      subtitle="Latest quotations sent to clients"
      actions={<Link to="/quotations" className="dashboard-card-link">View all</Link>}
      padding="none"
    >
      <Table
        columns={[
          { key: 'quoteNumber', header: 'Quote #' },
          { key: 'client', header: 'Client' },
          {
            key: 'amount',
            header: 'Amount',
            align: 'right',
            render: (row) => formatCurrency(row.amount),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <Badge tone={QUOTATION_STATUS_TONE[row.status]} dot>{row.status}</Badge>,
          },
          {
            key: 'date',
            header: 'Date',
            render: (row) => formatDate(row.date),
          },
        ]}
        rows={quotations}
      />
    </Card>
  );
}

export default RecentQuotationsTable;
