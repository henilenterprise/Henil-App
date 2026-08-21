import { useCallback, useEffect, useState } from 'react';
import { Plus, MoreVertical, Pencil, Trash2, Paperclip, TrendingDown, RotateCcw } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import SearchBar from '../components/ui/SearchBar.jsx';
import Select from '../components/ui/Select.jsx';
import DatePicker from '../components/ui/DatePicker.jsx';
import Dropdown from '../components/ui/Dropdown.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Alert from '../components/ui/Alert.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import ExpenseFormModal from '../components/expenses/ExpenseFormModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { listExpenses, listExpenseCategories, listExpenseIdsWithAttachment, deleteExpense } from '../services/expensesService.js';
import { PAYMENT_METHODS } from '../services/paymentsService.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { formatDate } from '../utils/formatDate.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './Expenses.css';

const PAGE_SIZE = 10;

const METHOD_FILTER_OPTIONS = [
  { value: '', label: 'All methods' },
  ...PAYMENT_METHODS.map((m) => ({ value: m, label: m })),
];

const SORT_OPTIONS = [
  { value: 'date:false', label: 'Newest first' },
  { value: 'date:true', label: 'Oldest first' },
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

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseIsoDate(v) {
  return v ? new Date(`${v}T00:00:00`) : null;
}

function Expenses() {
  const toast = useToast();

  const [expenses, setExpenses] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [methodFilter, setMethodFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortValue, setSortValue] = useState('date:false');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [sortBy, ascendingStr] = sortValue.split(':');
  const ascending = ascendingStr === 'true';

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count: total } = await listExpenses({
        search: debouncedSearch,
        category: categoryFilter,
        paymentMethod: methodFilter,
        from: dateFrom,
        to: dateTo,
        sortBy,
        ascending,
        page,
        pageSize: PAGE_SIZE,
      });
      const withAttachment = await listExpenseIdsWithAttachment(data.map((e) => e.id));
      setExpenses(data.map((e) => ({ ...e, has_attachment: withAttachment.has(e.id) })));
      setCount(total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, categoryFilter, methodFilter, dateFrom, dateTo, sortBy, ascending, page]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  function refreshCategoryOptions() {
    listExpenseCategories().then(setCategoryOptions).catch(() => setCategoryOptions([]));
  }
  useEffect(() => {
    refreshCategoryOptions();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, methodFilter, dateFrom, dateTo, sortValue]);

  const hasActiveFilters = Boolean(debouncedSearch || categoryFilter || methodFilter || dateFrom || dateTo);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  function openAddModal() {
    setEditingExpense(null);
    setFormOpen(true);
  }
  function openEditModal(expense) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  async function handleFormSubmitted() {
    toast.success(editingExpense ? 'Expense updated' : 'Expense added', 'The expense record was saved successfully.');
    fetchExpenses();
    refreshCategoryOptions();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id);
      toast.success('Expense deleted', `${deleteTarget.description} was removed.`);
      setDeleteTarget(null);
      if (expenses.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchExpenses();
      }
    } catch (err) {
      toast.error('Couldn’t delete expense', getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setCategoryFilter('');
    setMethodFilter('');
    setDateFrom('');
    setDateTo('');
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Track business expenses and operating costs."
        actions={
          <Button icon={Plus} onClick={openAddModal}>
            Add expense
          </Button>
        }
      />

      <Card padding="none">
        <div className="expenses-toolbar">
          <div className="expenses-toolbar__search">
            <SearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search by description, vendor, category…"
            />
          </div>
          <div className="expenses-toolbar__filters">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[{ value: '', label: 'All categories' }, ...categoryOptions.map((c) => ({ value: c, label: c }))]}
              aria-label="Filter by category"
            />
            <Select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              options={METHOD_FILTER_OPTIONS}
              aria-label="Filter by payment method"
            />
            <Select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value)}
              options={SORT_OPTIONS}
              aria-label="Sort expenses"
            />
          </div>
        </div>

        <div className="expenses-toolbar expenses-toolbar--dates">
          <DatePicker
            label="From"
            value={parseIsoDate(dateFrom)}
            onChange={(d) => setDateFrom(d ? isoDate(d) : '')}
          />
          <DatePicker
            label="To"
            value={parseIsoDate(dateTo)}
            onChange={(d) => setDateTo(d ? isoDate(d) : '')}
          />
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
            >
              Clear dates
            </Button>
          )}
        </div>

        <div className="expenses-body">
          {error && (
            <div className="expenses-body__pad">
              <Alert tone="danger" title="Couldn't load expenses">
                {error}
              </Alert>
              <div className="expenses-retry">
                <Button variant="outline" icon={RotateCcw} onClick={fetchExpenses}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!error && loading && <Spinner size="lg" label="Loading expenses…" />}

          {!error && !loading && expenses.length === 0 && !hasActiveFilters && (
            <EmptyState
              icon={TrendingDown}
              title="No expenses yet"
              description="Add your first expense to start tracking operating costs."
              action={
                <Button icon={Plus} onClick={openAddModal}>
                  Add expense
                </Button>
              }
            />
          )}

          {!error && !loading && expenses.length === 0 && hasActiveFilters && (
            <EmptyState
              icon={TrendingDown}
              title="No expenses match your search"
              description="Try a different search term or clear the filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {!error && !loading && expenses.length > 0 && (
            <Table
              columns={[
                { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
                { key: 'category', header: 'Category', render: (row) => <Badge tone="neutral">{row.category}</Badge> },
                {
                  key: 'description',
                  header: 'Description',
                  render: (row) => (
                    <span className="expenses-table__description">
                      {row.description}
                      {row.has_attachment && <Paperclip size={13} className="expenses-table__attachment-icon" />}
                    </span>
                  ),
                },
                { key: 'vendor', header: 'Vendor', render: (row) => row.vendor || '—' },
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
                        { label: 'Edit', icon: Pencil, onClick: () => openEditModal(row) },
                        { divider: true },
                        {
                          label: 'Delete',
                          icon: Trash2,
                          tone: 'danger',
                          onClick: () => setDeleteTarget(row),
                        },
                      ]}
                    />
                  ),
                },
              ]}
              rows={expenses}
            />
          )}
        </div>

        {!error && !loading && count > PAGE_SIZE && (
          <div className="expenses-pagination">
            <p className="expenses-pagination__count">
              {count} expense{count === 1 ? '' : 's'} total
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <ExpenseFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        expense={editingExpense}
        onSubmit={handleFormSubmitted}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        tone="danger"
        title="Delete this expense?"
        description={
          deleteTarget
            ? `This will permanently remove "${deleteTarget.description}" (${formatCurrency(deleteTarget.amount)}). This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
      />
    </>
  );
}

export default Expenses;
