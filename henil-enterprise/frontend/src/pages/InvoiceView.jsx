import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Ban, RotateCcw, CreditCard } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Select from '../components/ui/Select.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Alert from '../components/ui/Alert.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import RecordPaymentModal from '../components/payments/RecordPaymentModal.jsx';
import FilesPanel from '../components/files/FilesPanel.jsx';
import PdfActions from '../components/pdf/PdfActions.jsx';
import { generateInvoicePdf } from '../utils/pdf/generateInvoicePdf.js';
import { useToast } from '../context/ToastContext.jsx';
import { getInvoiceWithItems, updateInvoiceStatus, cancelInvoice } from '../services/invoicesService.js';
import { INVOICE_STATUS_TONE } from '../components/dashboard/statusTones.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { formatDate } from '../utils/formatDate.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './InvoiceView.css';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIALLY_PAID', label: 'Partially paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoiceWithItems(id);
      setInvoice(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  async function handleStatusChange(e) {
    const nextStatus = e.target.value;
    setStatusSaving(true);
    try {
      const updated = await updateInvoiceStatus(id, nextStatus);
      setInvoice((inv) => ({ ...inv, status: updated.status }));
      toast.success('Status updated', `Invoice is now ${nextStatus}.`);
    } catch (err) {
      toast.error('Couldn’t update status', getErrorMessage(err));
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleConfirmCancel() {
    setCancelling(true);
    try {
      await cancelInvoice(id);
      setInvoice((inv) => ({ ...inv, status: 'CANCELLED' }));
      toast.success('Invoice cancelled', `${invoice.invoice_number} was cancelled.`);
      setCancelOpen(false);
    } catch (err) {
      toast.error('Couldn’t cancel invoice', getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <Spinner size="lg" label="Loading invoice…" />;
  }

  if (error) {
    return (
      <>
        <Link to="/invoices" className="invoice-view__back">
          <ArrowLeft size={14} />
          Back to invoices
        </Link>
        <Alert tone="danger" title="Couldn't load this invoice">
          {error}
        </Alert>
        <div className="invoice-view__retry">
          <Button variant="outline" icon={RotateCcw} onClick={fetchInvoice}>
            Try again
          </Button>
        </div>
      </>
    );
  }

  if (!invoice) return null;

  const client = invoice.client;
  const isCancelled = invoice.status === 'CANCELLED';
  const canRecordPayment = !isCancelled && invoice.remaining > 0;

  return (
    <>
      <Link to="/invoices" className="invoice-view__back">
        <ArrowLeft size={14} />
        Back to invoices
      </Link>

      <PageHeader
        title={invoice.invoice_number}
        description={`${client?.company_name ?? 'Unknown client'} · Due ${formatDate(invoice.due_date)}`}
        actions={
          !isCancelled && (
            <>
              {canRecordPayment && (
                <Button icon={CreditCard} onClick={() => setPaymentModalOpen(true)}>
                  Record payment
                </Button>
              )}
              <Button variant="outline" icon={Pencil} onClick={() => navigate(`/invoices/${id}/edit`)}>
                Edit
              </Button>
              <Button variant="danger" icon={Ban} onClick={() => setCancelOpen(true)}>
                Cancel invoice
              </Button>
            </>
          )
        }
      />

      {invoice.quotation && (
        <Alert tone="info" title="Converted from a quotation">
          This invoice was created from quotation{' '}
          <Link to={`/quotations/${invoice.quotation.id}`} className="invoice-view__quotation-link">
            {invoice.quotation.quotation_number}
          </Link>
          .
        </Alert>
      )}

      <Card title="Document" className="invoice-view__section">
        <PdfActions
          label="Invoice"
          fileName={invoice.invoice_number}
          generatePdf={() => generateInvoicePdf(invoice)}
        />
      </Card>

      <div className="invoice-view__grid">
        <Card title="Items">
          <Table
            columns={[
              { key: 'description', header: 'Description' },
              { key: 'quantity', header: 'Qty', align: 'right' },
              { key: 'unit', header: 'Unit' },
              { key: 'rate', header: 'Rate', align: 'right', render: (row) => formatCurrency(row.rate) },
              { key: 'gst_percentage', header: 'GST', align: 'right', render: (row) => `${row.gst_percentage}%` },
              { key: 'amount', header: 'Amount', align: 'right', render: (row) => formatCurrency(row.amount) },
            ]}
            rows={invoice.items.map((item, i) => ({ ...item, id: item.id || i }))}
          />

          <div className="invoice-view__totals">
            <div className="invoice-view__totals-row">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="invoice-view__totals-row">
              <span>Discount</span>
              <span>{formatCurrency(invoice.discount)}</span>
            </div>
            <div className="invoice-view__totals-row">
              <span>GST</span>
              <span>{formatCurrency(invoice.gst)}</span>
            </div>
            <div className="invoice-view__totals-row invoice-view__totals-row--total">
              <span>Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            <div className="invoice-view__totals-row invoice-view__totals-row--paid">
              <span>Paid</span>
              <span>{formatCurrency(invoice.paid)}</span>
            </div>
            <div className="invoice-view__totals-row invoice-view__totals-row--remaining">
              <span>Remaining</span>
              <span>{formatCurrency(invoice.remaining)}</span>
            </div>
          </div>
        </Card>

        <div className="invoice-view__side">
          <Card title="Status">
            <div className="invoice-view__status-row">
              <Badge tone={INVOICE_STATUS_TONE[invoice.status]} dot>{invoice.status}</Badge>
            </div>
            <Select
              label="Change status"
              options={STATUS_OPTIONS}
              value={invoice.status}
              onChange={handleStatusChange}
              disabled={statusSaving}
            />
          </Card>

          <Card title="Client">
            <p className="invoice-view__client-name">{client?.company_name || '—'}</p>
            {client?.email && <p className="invoice-view__client-detail">{client.email}</p>}
            {client?.phone && <p className="invoice-view__client-detail">{client.phone}</p>}
            {client?.gst_number && <p className="invoice-view__client-detail">GST: {client.gst_number}</p>}
            {(client?.city || client?.state) && (
              <p className="invoice-view__client-detail">
                {[client.city, client.state].filter(Boolean).join(', ')}
              </p>
            )}
          </Card>

          <Card title="Dates">
            <p className="invoice-view__client-detail">Invoice date: {formatDate(invoice.invoice_date)}</p>
            <p className="invoice-view__client-detail">Due date: {formatDate(invoice.due_date)}</p>
          </Card>
        </div>
      </div>

      <FilesPanel invoiceId={invoice.id} title="Files" />

      <ConfirmDialog
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleConfirmCancel}
        loading={cancelling}
        tone="danger"
        title="Cancel this invoice?"
        description={`${invoice.invoice_number} will be marked as cancelled. This does not delete it — you can still view its history.`}
        confirmLabel="Cancel invoice"
      />

      <RecordPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        invoice={{ id: invoice.id, invoice_number: invoice.invoice_number, remaining: invoice.remaining }}
        onRecorded={() => {
          toast.success('Payment recorded', 'The invoice balance and status were updated.');
          fetchInvoice();
        }}
      />
    </>
  );
}

export default InvoiceView;
