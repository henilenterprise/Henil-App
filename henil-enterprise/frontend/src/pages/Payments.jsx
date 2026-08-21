import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, MoreVertical, CreditCard, RotateCcw } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import SearchBar from '../components/ui/SearchBar.jsx';
import Select from '../components/ui/Select.jsx';
import Dropdown from '../components/ui/Dropdown.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Alert from '../components/ui/Alert.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import RecordPaymentModal from '../components/payments/RecordPaymentModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { listPayments, deletePayment, PAYMENT_METHODS } from '../services/paymentsService.js';
import { listInvoicesForPaymentPicker } from '../services/invoicesService.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { formatDate } from '../utils/formatDate.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './Payments.css';

const PAGE_SIZE = 10;

const METHOD_FILTER_OPTIONS = [
  { value: '', label: 'All methods' },
  ...PAYMENT_METHODS.map((m) => ({ value: m, label: m })),
];

const SORT_OPTIONS = [
  { value: 'payment_date:false', label: 'Newest first' },
  { value: 'payment_date:true', label: 'Oldest first' },
  { value: 'amount:false', label: 'Amount (high to low)' },
  { value: 'amount:true', label: 'Amount (low to high)' },
];

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function Payments() {
  const toast = useToast();

  const [payments, setPayments] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [methodFilter, setMethodFilter] = useState('');
  const [sortValue, setSortValue] = useState('payment_date:false');
  const [page, setPage] = useState(1);

  const [invoiceOptions, setInvoiceOptions] = useState([]);
  const [recordOpen, setRecordOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [sortBy, ascendingStr] = sortValue.split(':');
  const ascending = ascendingStr === 'true';

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count: total } = await listPayments({
        search: debouncedSearch,
        method: methodFilter,
        sortBy,
        ascending,
        page,
        pageSize: PAGE_SIZE,
      });
      setPayments(data);
      setCount(total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, methodFilter, sortBy, ascending, page]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, methodFilter, sortValue]);

  function refreshInvoiceOptions() {
    listInvoicesForPaymentPicker()
      .then(setInvoiceOptions)
      .catch(() => setInvoiceOptions([]));
  }
  useEffect(() => {
    refreshInvoiceOptions();
  }, []);

  const hasActiveFilters = Boolean(debouncedSearch || methodFilter);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePayment(deleteTarget.id, deleteTarget.invoice_id);
      toast.success(
        'Payment removed',
        `The ${formatCurrency(deleteTarget.amount)} payment was removed and the invoice status was updated.`
      );
      setDeleteTarget(null);
      fetchPayments();
      refreshInvoiceOptions();
    } catch (err) {
      toast.error('Couldn’t remove payment', getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  function handleRecorded() {
    toast.success('Payment recorded', 'The invoice balance and status were updated.');
    fetchPayments();
    refreshInvoiceOptions();
  }

  function clearFilters() {
    setSearch('');
    setMethodFilter('');
  }

  return (
    <>
      <PageHeader
        title="Payments"
        description="Record and track payments received from clients."
        actions={
          <Button icon={Plus} onClick={() => setRecordOpen(true)}>
            Record payment
          </Button>
        }
      />

      <Card padding="none">
        <div className="payments-toolbar">
          <div className="payments-toolbar__search">
            <SearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search by invoice # or reference…"
            />
          </div>
          <div className="payments-toolbar__filters">
            <Select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              options={METHOD_FILTER_OPTIONS}
              aria-label="Filter by method"
            />
            <Select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value)}
              options={SORT_OPTIONS}
              aria-label="Sort payments"
            />
          </div>
        </div>

        <div className="payments-body">
          {error && (
            <div className="payments-body__pad">
              <Alert tone="danger" title="Couldn't load payments">
                {error}
              </Alert>
              <div className="payments-retry">
                <Button variant="outline" icon={RotateCcw} onClick={fetchPayments}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!error && loading && <Spinner size="lg" label="Loading payments…" />}

          {!error && !loading && payments.length === 0 && !hasActiveFilters && (
            <EmptyState
              icon={CreditCard}
              title="No payments yet"
              description="Record a payment against an invoice to see it here."
              action={
                <Button icon={Plus} onClick={() => setRecordOpen(true)}>
                  Record payment
                </Button>
              }
            />
          )}

          {!error && !loading && payments.length === 0 && hasActiveFilters && (
            <EmptyState
              icon={CreditCard}
              title="No payments match your search"
              description="Try a different search term or clear the filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {!error && !loading && payments.length > 0 && (
            <Table
              columns={[
                { key: 'payment_date', header: 'Date', render: (row) => formatDate(row.payment_date) },
                { key: 'invoice', header: 'Invoice', render: (row) => row.invoice?.invoice_number || '—' },
                { key: 'client', header: 'Client', render: (row) => row.invoice?.client?.company_name || '—' },
                {
                  key: 'amount',
                  header: 'Amount',
                  align: 'right',
                  render: (row) => formatCurrency(row.amount),
                },
                {
                  key: 'payment_method',
                  header: 'Method',
                  render: (row) => <Badge tone="neutral">{row.payment_method}</Badge>,
                },
                { key: 'reference_number', header: 'Reference', render: (row) => row.reference_number || '—' },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  render: (row) => (
                    <Dropdown
                      align="right"
                      trigger={
                        <button type="button" className="icon-trigger" aria-label="More actions">
                          <MoreVertical size={16} />
                        </button>
                      }
                      items={[
                        {
                          label: 'Remove payment',
                          icon: Trash2,
                          tone: 'danger',
                          onClick: () => setDeleteTarget(row),
                        },
                      ]}
                    />
                  ),
                },
              ]}
              rows={payments}
            />
          )}
        </div>

        {!error && !loading && count > PAGE_SIZE && (
          <div className="payments-pagination">
            <p className="payments-pagination__count">
              {count} payment{count === 1 ? '' : 's'} total
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <RecordPaymentModal
        isOpen={recordOpen}
        onClose={() => setRecordOpen(false)}
        invoiceOptions={invoiceOptions}
        onRecorded={handleRecorded}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        tone="danger"
        title="Remove this payment?"
        description={
          deleteTarget
            ? `This will remove the ${formatCurrency(deleteTarget.amount)} payment and update the invoice's status accordingly.`
            : ''
        }
        confirmLabel="Remove"
      />
    </>
  );
}

export default Payments;
