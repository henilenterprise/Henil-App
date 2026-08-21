import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, Eye, Pencil, Copy, Trash2, FileText, RotateCcw } from 'lucide-react';
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
import { listQuotations, deleteQuotation, duplicateQuotation } from '../services/quotationsService.js';
import { QUOTATION_STATUS_TONE } from '../components/dashboard/statusTones.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { formatDate } from '../utils/formatDate.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './Quotations.css';

const PAGE_SIZE = 10;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'VIEWED', label: 'Viewed' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
];

const SORT_OPTIONS = [
  { value: 'quotation_date:false', label: 'Newest first' },
  { value: 'quotation_date:true', label: 'Oldest first' },
  { value: 'total:false', label: 'Total (high to low)' },
  { value: 'total:true', label: 'Total (low to high)' },
  { value: 'quotation_number:true', label: 'Quotation # (A–Z)' },
];

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function Quotations() {
  const navigate = useNavigate();
  const toast = useToast();

  const [quotations, setQuotations] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortValue, setSortValue] = useState('quotation_date:false');
  const [page, setPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState(null);

  const [sortBy, ascendingStr] = sortValue.split(':');
  const ascending = ascendingStr === 'true';

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count: total } = await listQuotations({
        search: debouncedSearch,
        status: statusFilter,
        sortBy,
        ascending,
        page,
        pageSize: PAGE_SIZE,
      });
      setQuotations(data);
      setCount(total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, sortBy, ascending, page]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, sortValue]);

  const hasActiveFilters = Boolean(debouncedSearch || statusFilter);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  async function handleDuplicate(quotation) {
    setDuplicatingId(quotation.id);
    try {
      const created = await duplicateQuotation(quotation.id);
      toast.success('Quotation duplicated', `${created.quotation_number} was created from ${quotation.quotation_number}.`);
      fetchQuotations();
    } catch (err) {
      toast.error('Couldn’t duplicate quotation', getErrorMessage(err));
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQuotation(deleteTarget.id);
      toast.success('Draft deleted', `${deleteTarget.quotation_number} was removed.`);
      setDeleteTarget(null);
      if (quotations.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchQuotations();
      }
    } catch (err) {
      toast.error('Couldn’t delete quotation', getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
  }

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Create and track quotations sent to clients."
        actions={
          <Button icon={Plus} onClick={() => navigate('/quotations/new')}>
            New quotation
          </Button>
        }
      />

      <Card padding="none">
        <div className="quotations-toolbar">
          <div className="quotations-toolbar__search">
            <SearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search by quotation # or client…"
            />
          </div>
          <div className="quotations-toolbar__filters">
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
              aria-label="Sort quotations"
            />
          </div>
        </div>

        <div className="quotations-body">
          {error && (
            <div className="quotations-body__pad">
              <Alert tone="danger" title="Couldn't load quotations">
                {error}
              </Alert>
              <div className="quotations-retry">
                <Button variant="outline" icon={RotateCcw} onClick={fetchQuotations}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!error && loading && <Spinner size="lg" label="Loading quotations…" />}

          {!error && !loading && quotations.length === 0 && !hasActiveFilters && (
            <EmptyState
              icon={FileText}
              title="No quotations yet"
              description="Create your first quotation to send to a client."
              action={
                <Button icon={Plus} onClick={() => navigate('/quotations/new')}>
                  New quotation
                </Button>
              }
            />
          )}

          {!error && !loading && quotations.length === 0 && hasActiveFilters && (
            <EmptyState
              icon={FileText}
              title="No quotations match your search"
              description="Try a different search term or clear the filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {!error && !loading && quotations.length > 0 && (
            <Table
              columns={[
                {
                  key: 'quotation_number',
                  header: 'Quote #',
                  render: (row) => (
                    <button
                      type="button"
                      className="quotations-table__link"
                      onClick={() => navigate(`/quotations/${row.id}`)}
                    >
                      {row.quotation_number}
                    </button>
                  ),
                },
                { key: 'client', header: 'Client', render: (row) => row.client?.company_name || '—' },
                { key: 'quotation_date', header: 'Date', render: (row) => formatDate(row.quotation_date) },
                {
                  key: 'total',
                  header: 'Total',
                  align: 'right',
                  render: (row) => formatCurrency(row.total),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => <Badge tone={QUOTATION_STATUS_TONE[row.status]} dot>{row.status}</Badge>,
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
                        { label: 'View', icon: Eye, onClick: () => navigate(`/quotations/${row.id}`) },
                        { label: 'Edit', icon: Pencil, onClick: () => navigate(`/quotations/${row.id}/edit`) },
                        {
                          label: duplicatingId === row.id ? 'Duplicating…' : 'Duplicate',
                          icon: Copy,
                          onClick: () => handleDuplicate(row),
                        },
                        ...(row.status === 'DRAFT'
                          ? [
                              { divider: true },
                              {
                                label: 'Delete draft',
                                icon: Trash2,
                                tone: 'danger',
                                onClick: () => setDeleteTarget(row),
                              },
                            ]
                          : []),
                      ]}
                    />
                  ),
                },
              ]}
              rows={quotations}
            />
          )}
        </div>

        {!error && !loading && count > PAGE_SIZE && (
          <div className="quotations-pagination">
            <p className="quotations-pagination__count">
              {count} quotation{count === 1 ? '' : 's'} total
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        tone="danger"
        title="Delete this draft?"
        description={
          deleteTarget
            ? `This will permanently remove draft ${deleteTarget.quotation_number}. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
      />
    </>
  );
}

export default Quotations;
