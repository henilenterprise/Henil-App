import { useCallback, useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ArrowLeft, History, RotateCcw } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import SearchBar from '../components/ui/SearchBar.jsx';
import Select from '../components/ui/Select.jsx';
import DatePicker from '../components/ui/DatePicker.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Alert from '../components/ui/Alert.jsx';
import { listInventoryTransactions } from '../services/inventoryService.js';
import { formatDate } from '../utils/formatDate.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './InventoryHistory.css';

const PAGE_SIZE = 15;

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'USAGE', label: 'Usage' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'RETURN', label: 'Return' },
];

const TYPE_TONE = {
  PURCHASE: 'success',
  RETURN: 'success',
  USAGE: 'warning',
  DAMAGE: 'danger',
  ADJUSTMENT: 'info',
};

const INCREASES = new Set(['PURCHASE', 'RETURN']);
const DECREASES = new Set(['USAGE', 'DAMAGE']);

function signedQuantityLabel(row) {
  const qty = Number(row.quantity);
  if (row.transaction_type === 'ADJUSTMENT') {
    return qty > 0 ? `+${qty}` : `${qty}`;
  }
  if (INCREASES.has(row.transaction_type)) return `+${qty}`;
  if (DECREASES.has(row.transaction_type)) return `\u2212${qty}`;
  return `${qty}`;
}

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

function InventoryHistory() {
  const location = useLocation();

  const [transactions, setTransactions] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const productIdFilter = location.state?.productId || '';

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count: total } = await listInventoryTransactions({
        search: debouncedSearch,
        productId: productIdFilter,
        transactionType: typeFilter,
        from: dateFrom,
        to: dateTo,
        page,
        pageSize: PAGE_SIZE,
      });
      setTransactions(data);
      setCount(total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, productIdFilter, typeFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, dateFrom, dateTo]);

  const hasActiveFilters = Boolean(debouncedSearch || typeFilter || dateFrom || dateTo);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <>
      <Link to="/inventory" className="inventory-history__back">
        <ArrowLeft size={14} />
        Back to inventory
      </Link>

      <PageHeader
        title="Transaction history"
        description={
          productIdFilter
            ? 'Stock movements for this product.'
            : 'Every stock movement across all products \u2014 an append-only ledger, never edited.'
        }
      />

      <Card padding="none">
        <div className="inventory-history-toolbar">
          <div className="inventory-history-toolbar__search">
            <SearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search by product, reference, notes…"
            />
          </div>
          <div className="inventory-history-toolbar__filters">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={TYPE_OPTIONS}
              aria-label="Filter by transaction type"
            />
          </div>
        </div>

        <div className="inventory-history-toolbar inventory-history-toolbar--dates">
          <DatePicker label="From" value={parseIsoDate(dateFrom)} onChange={(d) => setDateFrom(d ? isoDate(d) : '')} />
          <DatePicker label="To" value={parseIsoDate(dateTo)} onChange={(d) => setDateTo(d ? isoDate(d) : '')} />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
              Clear dates
            </Button>
          )}
        </div>

        <div className="inventory-history-body">
          {error && (
            <div className="inventory-history-body__pad">
              <Alert tone="danger" title="Couldn't load transaction history">
                {error}
              </Alert>
              <div className="inventory-history-retry">
                <Button variant="outline" icon={RotateCcw} onClick={fetchTransactions}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!error && loading && <Spinner size="lg" label="Loading transactions…" />}

          {!error && !loading && transactions.length === 0 && (
            <EmptyState
              icon={History}
              title={hasActiveFilters ? 'No transactions match your search' : 'No stock transactions yet'}
              description={
                hasActiveFilters
                  ? 'Try a different search term or clear the filters.'
                  : 'Add, remove, or adjust stock from the Inventory page to see history here.'
              }
            />
          )}

          {!error && !loading && transactions.length > 0 && (
            <Table
              columns={[
                { key: 'created_at', header: 'Date', render: (row) => formatDate(row.created_at) },
                {
                  key: 'product',
                  header: 'Product',
                  render: (row) => (row.product ? `${row.product.name} (${row.product.sku})` : '\u2014'),
                },
                {
                  key: 'transaction_type',
                  header: 'Type',
                  render: (row) => <Badge tone={TYPE_TONE[row.transaction_type] || 'neutral'}>{row.transaction_type}</Badge>,
                },
                {
                  key: 'quantity',
                  header: 'Quantity',
                  align: 'right',
                  render: (row) => signedQuantityLabel(row),
                },
                { key: 'reference', header: 'Reference', render: (row) => row.reference || '\u2014' },
                { key: 'notes', header: 'Notes', render: (row) => row.notes || '\u2014' },
              ]}
              rows={transactions}
            />
          )}
        </div>

        {!error && !loading && count > PAGE_SIZE && (
          <div className="inventory-history-pagination">
            <p className="inventory-history-pagination__count">
              {count} transaction{count === 1 ? '' : 's'} total
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </>
  );
}

export default InventoryHistory;
