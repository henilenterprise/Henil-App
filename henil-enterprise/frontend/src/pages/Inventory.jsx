import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Minus,
  Settings2,
  History,
  MoreVertical,
  Boxes,
  PackageX,
  IndianRupee,
  PackagePlus,
  RotateCcw,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import SearchBar from '../components/ui/SearchBar.jsx';
import Select from '../components/ui/Select.jsx';
import Dropdown from '../components/ui/Dropdown.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Alert from '../components/ui/Alert.jsx';
import KPICard from '../components/dashboard/KPICard.jsx';
import StockTransactionModal from '../components/inventory/StockTransactionModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getInventoryOverview } from '../services/inventoryService.js';
import { listProductCategories } from '../services/productsService.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './Inventory.css';

const SORT_OPTIONS = [
  { value: 'name:true', label: 'Name (A–Z)' },
  { value: 'quantity:true', label: 'Stock (low to high)' },
  { value: 'quantity:false', label: 'Stock (high to low)' },
];

function Inventory() {
  const navigate = useNavigate();
  const toast = useToast();

  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortValue, setSortValue] = useState('name:true');

  const [modalMode, setModalMode] = useState(null);
  const [modalTarget, setModalTarget] = useState(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInventoryOverview();
      setOverview(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    listProductCategories().then(setCategoryOptions).catch(() => setCategoryOptions([]));
  }, []);

  const filtered = useMemo(() => {
    let rows = overview;
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (r) =>
          r.product.name.toLowerCase().includes(term) ||
          r.product.sku.toLowerCase().includes(term) ||
          (r.product.category || '').toLowerCase().includes(term)
      );
    }
    if (categoryFilter) {
      rows = rows.filter((r) => r.product.category === categoryFilter);
    }
    if (lowStockOnly) {
      rows = rows.filter((r) => r.isLowStock);
    }
    const [sortBy, ascStr] = sortValue.split(':');
    const asc = ascStr === 'true';
    rows = [...rows].sort((a, b) => {
      let av;
      let bv;
      if (sortBy === 'quantity') {
        av = a.quantity;
        bv = b.quantity;
      } else {
        av = a.product.name.toLowerCase();
        bv = b.product.name.toLowerCase();
      }
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    return rows;
  }, [overview, search, categoryFilter, lowStockOnly, sortValue]);

  const lowStockCount = overview.filter((r) => r.isLowStock).length;
  const trackedCount = overview.filter((r) => r.tracked).length;
  const totalStockValue = overview.reduce((sum, r) => sum + r.quantity * Number(r.product.default_rate || 0), 0);

  function openModal(mode, row) {
    setModalMode(mode);
    setModalTarget(row);
  }
  function closeModal() {
    setModalMode(null);
    setModalTarget(null);
  }

  function handleRecorded() {
    toast.success('Stock updated', 'The transaction was recorded and stock levels updated.');
    fetchOverview();
  }

  function clearFilters() {
    setSearch('');
    setCategoryFilter('');
    setLowStockOnly(false);
  }

  const hasActiveFilters = Boolean(search || categoryFilter || lowStockOnly);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Monitor raw material and stock levels."
        actions={
          <Button variant="outline" icon={History} onClick={() => navigate('/inventory/history')}>
            Transaction history
          </Button>
        }
      />

      {!error && (
        <div className="inventory-kpis">
          <KPICard icon={Boxes} label="Tracked products" value={trackedCount} tone="default" />
          <KPICard icon={PackageX} label="Low stock items" value={lowStockCount} tone={lowStockCount > 0 ? 'danger' : 'success'} />
          <KPICard icon={IndianRupee} label="Total stock value" value={formatCurrency(totalStockValue)} tone="success" />
        </div>
      )}

      <Card padding="none">
        <div className="inventory-toolbar">
          <div className="inventory-toolbar__search">
            <SearchBar value={search} onChange={setSearch} onClear={() => setSearch('')} placeholder="Search by name, SKU, category…" />
          </div>
          <div className="inventory-toolbar__filters">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[{ value: '', label: 'All categories' }, ...categoryOptions.map((c) => ({ value: c, label: c }))]}
              aria-label="Filter by category"
            />
            <Button
              variant={lowStockOnly ? 'secondary' : 'outline'}
              size="md"
              onClick={() => setLowStockOnly((v) => !v)}
            >
              Low stock only
            </Button>
            <Select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value)}
              options={SORT_OPTIONS}
              aria-label="Sort inventory"
            />
          </div>
        </div>

        <div className="inventory-body">
          {error && (
            <div className="inventory-body__pad">
              <Alert tone="danger" title="Couldn't load inventory">
                {error}
              </Alert>
              <div className="inventory-retry">
                <Button variant="outline" icon={RotateCcw} onClick={fetchOverview}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!error && loading && <Spinner size="lg" label="Loading inventory…" />}

          {!error && !loading && overview.length === 0 && (
            <EmptyState
              icon={Boxes}
              title="No active products yet"
              description="Add products first, then track their stock here."
            />
          )}

          {!error && !loading && overview.length > 0 && filtered.length === 0 && (
            <EmptyState
              icon={Boxes}
              title="No products match your search"
              description="Try a different search term or clear the filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {!error && !loading && filtered.length > 0 && (
            <Table
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  render: (row) => (
                    <div>
                      <p className="inventory-table__name">{row.product.name}</p>
                      <p className="inventory-table__sku">{row.product.sku}</p>
                    </div>
                  ),
                },
                { key: 'category', header: 'Category', render: (row) => row.product.category || '—' },
                {
                  key: 'quantity',
                  header: 'Stock',
                  align: 'right',
                  render: (row) => (row.tracked ? `${row.quantity} ${row.product.unit}` : '—'),
                },
                {
                  key: 'minimumStock',
                  header: 'Reorder at',
                  align: 'right',
                  render: (row) => (row.tracked ? row.minimumStock : '—'),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) =>
                    !row.tracked ? (
                      <Badge tone="neutral">Not tracked</Badge>
                    ) : row.isLowStock ? (
                      <Badge tone="danger" dot>Low stock</Badge>
                    ) : (
                      <Badge tone="success" dot>In stock</Badge>
                    ),
                },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  render: (row) =>
                    !row.tracked ? (
                      <Button size="sm" icon={PackagePlus} onClick={() => openModal('opening', row)}>
                        Set opening stock
                      </Button>
                    ) : (
                      <Dropdown
                        align="right"
                        trigger={
                          <button type="button" className="icon-trigger" aria-label="More actions">
                            <MoreVertical size={16} />
                          </button>
                        }
                        items={[
                          { label: 'Add stock', icon: Plus, onClick: () => openModal('add', row) },
                          { label: 'Remove stock', icon: Minus, onClick: () => openModal('remove', row) },
                          { label: 'Adjust stock', icon: Settings2, onClick: () => openModal('adjust', row) },
                          { divider: true },
                          {
                            label: 'View history',
                            icon: History,
                            onClick: () => navigate('/inventory/history', { state: { productId: row.product.id } }),
                          },
                        ]}
                      />
                    ),
                },
              ]}
              rows={filtered.map((r) => ({ ...r, id: r.product.id }))}
            />
          )}
        </div>
      </Card>

      <StockTransactionModal
        isOpen={Boolean(modalMode)}
        onClose={closeModal}
        product={modalTarget?.product}
        currentQuantity={modalTarget?.quantity ?? 0}
        mode={modalMode}
        onRecorded={handleRecorded}
      />
    </>
  );
}

export default Inventory;
