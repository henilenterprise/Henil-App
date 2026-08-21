import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Copy, Trash2, RotateCcw, FileCheck } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Select from '../components/ui/Select.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Alert from '../components/ui/Alert.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import FilesPanel from '../components/files/FilesPanel.jsx';
import PdfActions from '../components/pdf/PdfActions.jsx';
import { generateQuotationPdf } from '../utils/pdf/generateQuotationPdf.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  getQuotationWithItems,
  updateQuotationStatus,
  deleteQuotation,
  duplicateQuotation,
} from '../services/quotationsService.js';
import { QUOTATION_STATUS_TONE } from '../components/dashboard/statusTones.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { formatDate } from '../utils/formatDate.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './QuotationView.css';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'VIEWED', label: 'Viewed' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
];

function QuotationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchQuotation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuotationWithItems(id);
      setQuotation(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchQuotation();
  }, [fetchQuotation]);

  async function handleStatusChange(e) {
    const nextStatus = e.target.value;
    setStatusSaving(true);
    try {
      const updated = await updateQuotationStatus(id, nextStatus);
      setQuotation((q) => ({ ...q, status: updated.status }));
      toast.success('Status updated', `Quotation is now ${nextStatus}.`);
    } catch (err) {
      toast.error('Couldn’t update status', getErrorMessage(err));
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const created = await duplicateQuotation(id);
      toast.success('Quotation duplicated', `${created.quotation_number} was created.`);
      navigate(`/quotations/${created.id}`);
    } catch (err) {
      toast.error('Couldn’t duplicate quotation', getErrorMessage(err));
    } finally {
      setDuplicating(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await deleteQuotation(id);
      toast.success('Draft deleted', `${quotation.quotation_number} was removed.`);
      navigate('/quotations');
    } catch (err) {
      toast.error('Couldn’t delete quotation', getErrorMessage(err));
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return <Spinner size="lg" label="Loading quotation…" />;
  }

  if (error) {
    return (
      <>
        <Link to="/quotations" className="quotation-view__back">
          <ArrowLeft size={14} />
          Back to quotations
        </Link>
        <Alert tone="danger" title="Couldn't load this quotation">
          {error}
        </Alert>
        <div className="quotation-view__retry">
          <Button variant="outline" icon={RotateCcw} onClick={fetchQuotation}>
            Try again
          </Button>
        </div>
      </>
    );
  }

  if (!quotation) return null;

  const client = quotation.client;

  return (
    <>
      <Link to="/quotations" className="quotation-view__back">
        <ArrowLeft size={14} />
        Back to quotations
      </Link>

      <PageHeader
        title={quotation.quotation_number}
        description={`${client?.company_name ?? 'Unknown client'} · ${formatDate(quotation.quotation_date)}`}
        actions={
          <>
            {quotation.status === 'ACCEPTED' && (
              <Button
                icon={FileCheck}
                onClick={() => navigate('/invoices/new', { state: { fromQuotationId: id } })}
              >
                Create invoice
              </Button>
            )}
            <Button variant="outline" icon={Pencil} onClick={() => navigate(`/quotations/${id}/edit`)}>
              Edit
            </Button>
            <Button variant="outline" icon={Copy} loading={duplicating} onClick={handleDuplicate}>
              Duplicate
            </Button>
            {quotation.status === 'DRAFT' && (
              <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            )}
          </>
        }
      />

      <Card title="Document" className="quotation-view__section">
        <PdfActions
          label="Quotation"
          fileName={quotation.quotation_number}
          generatePdf={() => generateQuotationPdf(quotation)}
        />
      </Card>

      <div className="quotation-view__grid">
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
            rows={quotation.items.map((item, i) => ({ ...item, id: item.id || i }))}
          />

          <div className="quotation-view__totals">
            <div className="quotation-view__totals-row">
              <span>Subtotal</span>
              <span>{formatCurrency(quotation.subtotal)}</span>
            </div>
            <div className="quotation-view__totals-row">
              <span>Discount</span>
              <span>{formatCurrency(quotation.discount)}</span>
            </div>
            <div className="quotation-view__totals-row">
              <span>GST</span>
              <span>{formatCurrency(quotation.gst)}</span>
            </div>
            <div className="quotation-view__totals-row quotation-view__totals-row--total">
              <span>Total</span>
              <span>{formatCurrency(quotation.total)}</span>
            </div>
          </div>

          {quotation.notes && (
            <div className="quotation-view__notes">
              <p className="quotation-view__notes-label">Notes</p>
              <p className="quotation-view__notes-body">{quotation.notes}</p>
            </div>
          )}
        </Card>

        <div className="quotation-view__side">
          <Card title="Status">
            <div className="quotation-view__status-row">
              <Badge tone={QUOTATION_STATUS_TONE[quotation.status]} dot>{quotation.status}</Badge>
            </div>
            <Select
              label="Change status"
              options={STATUS_OPTIONS}
              value={quotation.status}
              onChange={handleStatusChange}
              disabled={statusSaving}
            />
          </Card>

          <Card title="Client">
            <p className="quotation-view__client-name">{client?.company_name || '—'}</p>
            {client?.email && <p className="quotation-view__client-detail">{client.email}</p>}
            {client?.phone && <p className="quotation-view__client-detail">{client.phone}</p>}
            {client?.gst_number && <p className="quotation-view__client-detail">GST: {client.gst_number}</p>}
            {(client?.city || client?.state) && (
              <p className="quotation-view__client-detail">
                {[client.city, client.state].filter(Boolean).join(', ')}
              </p>
            )}
          </Card>

          {quotation.valid_until && (
            <Card title="Validity">
              <p className="quotation-view__client-detail">Valid until {formatDate(quotation.valid_until)}</p>
            </Card>
          )}
        </div>
      </div>

      <FilesPanel quotationId={quotation.id} title="Files" />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        tone="danger"
        title="Delete this draft?"
        description={`This will permanently remove draft ${quotation.quotation_number}. This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </>
  );
}

export default QuotationView;
