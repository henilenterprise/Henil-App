import { useCallback, useEffect, useState } from 'react';
import { Plus, MoreVertical, Pencil, PackageX, PackageCheck, Package, RotateCcw } from 'lucide-react';
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
import ProductFormModal from '../components/products/ProductFormModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  listProducts,
  listProductCategories,
  createProduct,
  updateProduct,
  setProductActive,
} from '../services/productsService.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './Products.css';

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { value: 'name:true', label: 'Name (A–Z)' },
  { value: 'name:false', label: 'Name (Z–A)' },
  { value: 'default_rate:true', label: 'Rate (low to high)' },
  { value: 'default_rate:false', label: 'Rate (high to low)' },
  { value: 'created_at:false', label: 'Recently added' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active only' },
  { value: 'inactive', label: 'Inactive only' },
  { value: 'all', label: 'All statuses' },
];

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function Products() {
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortValue, setSortValue] = useState('name:true');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const [sortBy, ascendingStr] = sortValue.split(':');
  const ascending = ascendingStr === 'true';

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count: total } = await listProducts({
        search: debouncedSearch,
        category: categoryFilter,
        status: statusFilter,
        sortBy,
        ascending,
        page,
        pageSize: PAGE_SIZE,
      });
      setProducts(data);
      setCount(total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, categoryFilter, statusFilter, sortBy, ascending, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    listProductCategories()
      .then(setCategoryOptions)
      .catch(() => setCategoryOptions([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, statusFilter, sortValue]);

  const hasActiveFilters = Boolean(debouncedSearch || categoryFilter || statusFilter !== 'active');
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  function openAddModal() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function openEditModal(product) {
    setEditingProduct(product);
    setFormOpen(true);
  }

  async function handleFormSubmit(payload) {
    if (editingProduct) {
      await updateProduct(editingProduct.id, payload);
      toast.success('Product updated', `${payload.name} was updated successfully.`);
    } else {
      await createProduct(payload);
      toast.success('Product added', `${payload.name} was added successfully.`);
    }
    fetchProducts();
    listProductCategories().then(setCategoryOptions).catch(() => {});
  }

  async function handleReactivate(product) {
    try {
      await setProductActive(product.id, true);
      toast.success('Product activated', `${product.name} is now active.`);
      fetchProducts();
    } catch (err) {
      toast.error('Couldn’t activate product', getErrorMessage(err));
    }
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget) return;
    setSavingStatus(true);
    try {
      await setProductActive(deactivateTarget.id, false);
      toast.success('Product deactivated', `${deactivateTarget.name} is now inactive and hidden from new quotations.`);
      setDeactivateTarget(null);
      fetchProducts();
    } catch (err) {
      toast.error('Couldn’t deactivate product', getErrorMessage(err));
    } finally {
      setSavingStatus(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setCategoryFilter('');
    setStatusFilter('all');
  }

  return (
    <>
      <PageHeader
        title="Products"
        description="Browse and manage acrylic and polycarbonate products."
        actions={
          <Button icon={Plus} onClick={openAddModal}>
            Add product
          </Button>
        }
      />

      <Card padding="none">
        <div className="products-toolbar">
          <div className="products-toolbar__search">
            <SearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search by name, SKU, category, material…"
            />
          </div>
          <div className="products-toolbar__filters">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: '', label: 'All categories' },
                ...categoryOptions.map((c) => ({ value: c, label: c })),
              ]}
              aria-label="Filter by category"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
              aria-label="Filter by status"
            />
            <Select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value)}
              placeholder="Sort by"
              options={SORT_OPTIONS}
              aria-label="Sort products"
            />
          </div>
        </div>

        <div className="products-body">
          {error && (
            <div className="products-body__pad">
              <Alert tone="danger" title="Couldn't load products">
                {error}
              </Alert>
              <div className="products-retry">
                <Button variant="outline" icon={RotateCcw} onClick={fetchProducts}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!error && loading && <Spinner size="lg" label="Loading products…" />}

          {!error && !loading && products.length === 0 && !hasActiveFilters && (
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Add your first product so it can be used in quotations and invoices."
              action={
                <Button icon={Plus} onClick={openAddModal}>
                  Add product
                </Button>
              }
            />
          )}

          {!error && !loading && products.length === 0 && hasActiveFilters && (
            <EmptyState
              icon={Package}
              title="No products match your search"
              description="Try a different search term or clear the filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {!error && !loading && products.length > 0 && (
            <Table
              columns={[
                {
                  key: 'name',
                  header: 'Product',
                  render: (row) => (
                    <div>
                      <p className="products-table__name">{row.name}</p>
                      <p className="products-table__sku">{row.sku}</p>
                    </div>
                  ),
                },
                { key: 'category', header: 'Category', render: (row) => row.category || '—' },
                {
                  key: 'material',
                  header: 'Material / Thickness',
                  render: (row) => [row.material, row.thickness].filter(Boolean).join(' · ') || '—',
                },
                {
                  key: 'default_rate',
                  header: 'Rate',
                  align: 'right',
                  render: (row) => `${formatCurrency(row.default_rate)} / ${row.unit}`,
                },
                {
                  key: 'gst_percentage',
                  header: 'GST',
                  align: 'right',
                  render: (row) => `${row.gst_percentage}%`,
                },
                {
                  key: 'is_active',
                  header: 'Status',
                  render: (row) =>
                    row.is_active ? (
                      <Badge tone="success" dot>Active</Badge>
                    ) : (
                      <Badge tone="neutral" dot>Inactive</Badge>
                    ),
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
                      items={
                        row.is_active
                          ? [
                              { label: 'Edit', icon: Pencil, onClick: () => openEditModal(row) },
                              { divider: true },
                              {
                                label: 'Deactivate',
                                icon: PackageX,
                                tone: 'danger',
                                onClick: () => setDeactivateTarget(row),
                              },
                            ]
                          : [
                              { label: 'Edit', icon: Pencil, onClick: () => openEditModal(row) },
                              { divider: true },
                              {
                                label: 'Activate',
                                icon: PackageCheck,
                                onClick: () => handleReactivate(row),
                              },
                            ]
                      }
                    />
                  ),
                },
              ]}
              rows={products}
            />
          )}
        </div>

        {!error && !loading && count > PAGE_SIZE && (
          <div className="products-pagination">
            <p className="products-pagination__count">
              {count} product{count === 1 ? '' : 's'} total
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <ProductFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        product={editingProduct}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleConfirmDeactivate}
        loading={savingStatus}
        tone="danger"
        title="Deactivate this product?"
        description={
          deactivateTarget
            ? `${deactivateTarget.name} will be hidden from new quotations until reactivated. Existing quotations and invoices are not affected.`
            : ''
        }
        confirmLabel="Deactivate"
      />
    </>
  );
}

export default Products;
