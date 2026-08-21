import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, Eye, Pencil, Ban, Receipt, RotateCcw } from 'lucide-react';
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
import { useToast } from '../context/ToastContext.jsx';
import { listInvoices, cancelInvoice } from '../services/invoicesService.js';
import { INVOICE_STATUS_TONE } from '../components/dashboard/statusTones.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { formatDate } from '../utils/formatDate.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './Invoices.css';

const PAGE_SIZE = 10;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIALLY_PAID', label: 'Partially paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const SORT_OPTIONS = [
  { value: 'invoice_date:false', label: 'Newest first' },
  { value: 'invoice_date:true', label: 'Oldest first' },
  { value: 'due_date:true', label: 'Due date (soonest)' },
  { value: 'total:false', label: 'Total (high to low)' },
  { value: 'invoice_number:true', label: 'Invoice # (A–Z)' },
];

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function Invoices() {
  const navigate = useNavigate();
  const toast = useToast();

  const [invoices, setInvoices] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortValue, setSortValue] = useState('invoice_date:false');
  const [page, setPage] = useState(1);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const [sortBy, ascendingStr] = sortValue.split(':');
  const ascending = ascendingStr === 'true';

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count: total } = await listInvoices({
        search: debouncedSearch,
        status: statusFilter,
        sortBy,
        ascending,
        page,
        pageSize: PAGE_SIZE,
      });
      setInvoices(data);
      setCount(total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, sortBy, ascending, page]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, sortValue]);

  const hasActiveFilters = Boolean(debouncedSearch || statusFilter);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelInvoice(cancelTarget.id);
      toast.success('Invoice cancelled', `${cancelTarget.invoice_number} was cancelled.`);
      setCancelTarget(null);
      fetchInvoices();
    } catch (err) {
      toast.error('Couldn’t cancel invoice', getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
  }

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Issue and manage invoices for completed work."
        actions={
          <Button icon={Plus} onClick={() => navigate('/invoices/new')}>
            New invoice
          </Button>
        }
      />

      <Card padding="none">
        <div className="invoices-toolbar">
          <div className="invoices-toolbar__search">
            <SearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search by invoice # or client…"
            />
          </div>
          <div className="invoices-toolbar__filters">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_FILTER_OPTIONS}
              aria-label="Filter by status"
            />
            <Select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value)}
              options={SORT_OPTIONS}
              aria-label="Sort invoices"
            />
          </div>
        </div>

        <div className="invoices-body">
          {error && (
            <div className="invoices-body__pad">
              <Alert tone="danger" title="Couldn't load invoices">
                {error}
              </Alert>
              <div className="invoices-retry">
                <Button variant="outline" icon={RotateCcw} onClick={fetchInvoices}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!error && loading && <Spinner size="lg" label="Loading invoices…" />}

          {!error && !loading && invoices.length === 0 && !hasActiveFilters && (
            <EmptyState
              icon={Receipt}
              title="No invoices yet"
              description="Create an invoice directly, or convert an accepted quotation into one."
              action={
                <Button icon={Plus} onClick={() => navigate('/invoices/new')}>
                  New invoice
                </Button>
              }
            />
          )}

          {!error && !loading && invoices.length === 0 && hasActiveFilters && (
            <EmptyState
              icon={Receipt}
              title="No invoices match your search"
              description="Try a different search term or clear the filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {!error && !loading && invoices.length > 0 && (
            <Table
              columns={[
                {
                  key: 'invoice_number',
                  header: 'Invoice #',
                  render: (row) => (
                    <button
                      type="button"
                      className="invoices-table__link"
                      onClick={() => navigate(`/invoices/${row.id}`)}
                    >
                      {row.invoice_number}
                    </button>
                  ),
                },
                { key: 'client', header: 'Client', render: (row) => row.client?.company_name || '—' },
                { key: 'due_date', header: 'Due date', render: (row) => formatDate(row.due_date) },
                {
                  key: 'total',
                  header: 'Total',
                  align: 'right',
                  render: (row) => formatCurrency(row.total),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => <Badge tone={INVOICE_STATUS_TONE[row.status]} dot>{row.status}</Badge>,
                },
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
                        { label: 'View', icon: Eye, onClick: () => navigate(`/invoices/${row.id}`) },
                        ...(row.status !== 'CANCELLED'
                          ? [{ label: 'Edit', icon: Pencil, onClick: () => navigate(`/invoices/${row.id}/edit`) }]
                          : []),
                        ...(row.status !== 'CANCELLED'
                          ? [
                              { divider: true },
                              {
                                label: 'Cancel invoice',
                                icon: Ban,
                                tone: 'danger',
                                onClick: () => setCancelTarget(row),
                              },
                            ]
                          : []),
                      ]}
                    />
                  ),
                },
              ]}
              rows={invoices}
            />
          )}
        </div>

        {!error && !loading && count > PAGE_SIZE && (
          <div className="invoices-pagination">
            <p className="invoices-pagination__count">
              {count} invoice{count === 1 ? '' : 's'} total
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        loading={cancelling}
        tone="danger"
        title="Cancel this invoice?"
        description={
          cancelTarget
            ? `${cancelTarget.invoice_number} will be marked as cancelled. This does not delete it — you can still view its history.`
            : ''
        }
        confirmLabel="Cancel invoice"
      />
    </>
  );
}

export default Invoices;
