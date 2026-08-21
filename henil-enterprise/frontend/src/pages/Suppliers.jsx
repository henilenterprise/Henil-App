import { useCallback, useEffect, useState } from 'react';
import { Plus, MoreVertical, Pencil, Trash2, Truck, RotateCcw } from 'lucide-react';
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
import SupplierFormModal from '../components/suppliers/SupplierFormModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  listSuppliers,
  listSupplierStates,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../services/suppliersService.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './Suppliers.css';

/*
  Suppliers has no detail page and no "view details" row action,
  unlike Clients — no other table in the schema references suppliers
  (no supplier_id foreign key anywhere), so there are no related
  quotations/invoices/files to show on a per-supplier page. Everything
  a user needs is editable right from this list.
*/

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { value: 'company_name:true', label: 'Company name (A–Z)' },
  { value: 'company_name:false', label: 'Company name (Z–A)' },
  { value: 'city:true', label: 'City (A–Z)' },
  { value: 'created_at:false', label: 'Recently added' },
  { value: 'created_at:true', label: 'Oldest first' },
];

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function Suppliers() {
  const toast = useToast();

  const [suppliers, setSuppliers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [stateFilter, setStateFilter] = useState('');
  const [stateOptions, setStateOptions] = useState([]);
  const [sortValue, setSortValue] = useState('company_name:true');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [sortBy, ascendingStr] = sortValue.split(':');
  const ascending = ascendingStr === 'true';

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count: total } = await listSuppliers({
        search: debouncedSearch,
        state: stateFilter,
        sortBy,
        ascending,
        page,
        pageSize: PAGE_SIZE,
      });
      setSuppliers(data);
      setCount(total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, stateFilter, sortBy, ascending, page]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    listSupplierStates()
      .then(setStateOptions)
      .catch(() => setStateOptions([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stateFilter, sortValue]);

  const hasActiveFilters = Boolean(debouncedSearch || stateFilter);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  function openAddModal() {
    setEditingSupplier(null);
    setFormOpen(true);
  }

  function openEditModal(supplier) {
    setEditingSupplier(supplier);
    setFormOpen(true);
  }

  async function handleFormSubmit(payload) {
    if (editingSupplier) {
      await updateSupplier(editingSupplier.id, payload);
      toast.success('Supplier updated', `${payload.company_name} was updated successfully.`);
    } else {
      await createSupplier(payload);
      toast.success('Supplier added', `${payload.company_name} was added successfully.`);
    }
    fetchSuppliers();
    listSupplierStates().then(setStateOptions).catch(() => {});
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSupplier(deleteTarget.id);
      toast.success('Supplier deleted', `${deleteTarget.company_name} was removed.`);
      setDeleteTarget(null);
      if (suppliers.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchSuppliers();
      }
    } catch (err) {
      toast.error('Couldn\u2019t delete supplier', getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setStateFilter('');
  }

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Manage raw material and component supplier relationships."
        actions={
          <Button icon={Plus} onClick={openAddModal}>
            Add supplier
          </Button>
        }
      />

      <Card padding="none">
        <div className="suppliers-toolbar">
          <div className="suppliers-toolbar__search">
            <SearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search by company, contact, email, phone, GST…"
            />
          </div>
          <div className="suppliers-toolbar__filters">
            <Select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              options={[
                { value: '', label: 'All states' },
                ...stateOptions.map((s) => ({ value: s, label: s })),
              ]}
              aria-label="Filter by state"
            />
            <Select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value)}
              options={SORT_OPTIONS}
              aria-label="Sort suppliers"
            />
          </div>
        </div>

        <div className="suppliers-body">
          {error && (
            <div className="suppliers-body__pad">
              <Alert tone="danger" title="Couldn't load suppliers">
                {error}
              </Alert>
              <div className="suppliers-retry">
                <Button variant="outline" icon={RotateCcw} onClick={fetchSuppliers}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!error && loading && <Spinner size="lg" label="Loading suppliers…" />}

          {!error && !loading && suppliers.length === 0 && !hasActiveFilters && (
            <EmptyState
              icon={Truck}
              title="No suppliers yet"
              description="Add your first supplier to start tracking who you buy raw materials from."
              action={
                <Button icon={Plus} onClick={openAddModal}>
                  Add supplier
                </Button>
              }
            />
          )}

          {!error && !loading && suppliers.length === 0 && hasActiveFilters && (
            <EmptyState
              icon={Truck}
              title="No suppliers match your search"
              description="Try a different search term or clear the filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {!error && !loading && suppliers.length > 0 && (
            <Table
              columns={[
                { key: 'company_name', header: 'Company', render: (row) => row.company_name },
                { key: 'contact_person', header: 'Contact', render: (row) => row.contact_person || '\u2014' },
                { key: 'phone', header: 'Phone', render: (row) => row.phone || '\u2014' },
                { key: 'email', header: 'Email', render: (row) => row.email || '\u2014' },
                {
                  key: 'location',
                  header: 'Location',
                  render: (row) =>
                    row.city || row.state ? (
                      <Badge tone="neutral">{[row.city, row.state].filter(Boolean).join(', ')}</Badge>
                    ) : (
                      '\u2014'
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
              rows={suppliers}
            />
          )}
        </div>

        {!error && !loading && count > PAGE_SIZE && (
          <div className="suppliers-pagination">
            <p className="suppliers-pagination__count">
              {count} supplier{count === 1 ? '' : 's'} total
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <SupplierFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        supplier={editingSupplier}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        tone="danger"
        title="Delete this supplier?"
        description={
          deleteTarget
            ? `This will permanently remove ${deleteTarget.company_name}. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
      />
    </>
  );
}

export default Suppliers;
