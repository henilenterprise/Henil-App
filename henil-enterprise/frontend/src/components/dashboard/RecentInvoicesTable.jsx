import { Link } from 'react-router-dom';
import Card from '../ui/Card.jsx';
import Table from '../ui/Table.jsx';
import Badge from '../ui/Badge.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { formatDate } from '../../utils/formatDate.js';
import { INVOICE_STATUS_TONE } from './statusTones.js';

function RecentInvoicesTable({ invoices }) {
  return (
    <Card
      title="Recent invoices"
      subtitle="Latest invoices issued to clients"
      actions={<Link to="/invoices" className="dashboard-card-link">View all</Link>}
      padding="none"
    >
      <Table
        columns={[
          { key: 'invoiceNumber', header: 'Invoice #' },
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
            render: (row) => <Badge tone={INVOICE_STATUS_TONE[row.status]} dot>{row.status}</Badge>,
          },
          {
            key: 'dueDate',
            header: 'Due date',
            render: (row) => formatDate(row.dueDate),
          },
        ]}
        rows={invoices}
      />
    </Card>
  );
}

export default RecentInvoicesTable;
