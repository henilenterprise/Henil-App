import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, Pencil, Trash2, Users, RotateCcw } from 'lucide-react';
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
import ClientFormModal from '../components/clients/ClientFormModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  listClients,
  listClientStates,
  createClient,
  updateClient,
  deleteClient,
} from '../services/clientsService.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import { useCompany } from '../hooks/useCompany.js';
import './Clients.css';

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

function Clients() {
  const navigate = useNavigate();
  const toast = useToast();
  const { company } = useCompany();

  const [clients, setClients] = useState([]);
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
  const [editingClient, setEditingClient] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [sortBy, ascendingStr] = sortValue.split(':');
  const ascending = ascendingStr === 'true';

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count: total } = await listClients({
        search: debouncedSearch,
        state: stateFilter,
        sortBy,
        ascending,
        page,
        pageSize: PAGE_SIZE,
      });
      setClients(data);
      setCount(total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, stateFilter, sortBy, ascending, page]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    listClientStates()
      .then(setStateOptions)
      .catch(() => setStateOptions([]));
  }, []);

  // Reset to page 1 whenever the search/filter/sort changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stateFilter, sortValue]);

  const hasActiveFilters = Boolean(debouncedSearch || stateFilter);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  function openAddModal() {
    setEditingClient(null);
    setFormOpen(true);
  }

  function openEditModal(client) {
    setEditingClient(client);
    setFormOpen(true);
  }

  async function handleFormSubmit(payload) {
    if (editingClient) {
      await updateClient(editingClient.id, payload);
      toast.success('Client updated', `${payload.company_name} was updated successfully.`);
    } else {
      await createClient(payload);
      toast.success('Client added', `${payload.company_name} was added successfully.`);
    }
    fetchClients();
    listClientStates().then(setStateOptions).catch(() => {});
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClient(deleteTarget.id);
      toast.success('Client deleted', `${deleteTarget.company_name} was removed.`);
      setDeleteTarget(null);
      if (clients.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchClients();
      }
    } catch (err) {
      toast.error('Couldn’t delete client', getErrorMessage(err));
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
        title="Clients"
        description={`Manage client companies and contacts for ${company?.company_name || 'Henil Enterprise'}.`}
        actions={
          <Button icon={Plus} onClick={openAddModal}>
            Add client
          </Button>
        }
      />

      <Card padding="none">
        <div className="clients-toolbar">
          <div className="clients-toolbar__search">
            <SearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search by company, contact, email, phone, GST…"
            />
          </div>
          <div className="clients-toolbar__filters">
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
              placeholder="Sort by"
              options={SORT_OPTIONS}
              aria-label="Sort clients"
            />
          </div>
        </div>

        <div className="clients-body">
          {error && (
            <div className="clients-body__pad">
              <Alert tone="danger" title="Couldn't load clients">
                {error}
              </Alert>
              <div className="clients-retry">
                <Button variant="outline" icon={RotateCcw} onClick={fetchClients}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!error && loading && <Spinner size="lg" label="Loading clients…" />}

          {!error && !loading && clients.length === 0 && !hasActiveFilters && (
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Add your first client to start creating quotations and invoices for them."
              action={
                <Button icon={Plus} onClick={openAddModal}>
                  Add client
                </Button>
              }
            />
          )}

          {!error && !loading && clients.length === 0 && hasActiveFilters && (
            <EmptyState
              icon={Users}
              title="No clients match your search"
              description="Try a different search term or clear the filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {!error && !loading && clients.length > 0 && (
            <Table
              columns={[
                {
                  key: 'company_name',
                  header: 'Company',
                  render: (row) => (
                    <button
                      type="button"
                      className="clients-table__link"
                      onClick={() => navigate(`/clients/${row.id}`)}
                    >
                      {row.company_name}
                    </button>
                  ),
                },
                { key: 'contact_person', header: 'Contact', render: (row) => row.contact_person || '—' },
                { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
                { key: 'email', header: 'Email', render: (row) => row.email || '—' },
                {
                  key: 'location',
                  header: 'Location',
                  render: (row) =>
                    row.city || row.state ? (
                      <Badge tone="neutral">{[row.city, row.state].filter(Boolean).join(', ')}</Badge>
                    ) : (
                      '—'
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
                        { label: 'View details', icon: Users, onClick: () => navigate(`/clients/${row.id}`) },
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
              rows={clients}
            />
          )}
        </div>

        {!error && !loading && count > PAGE_SIZE && (
          <div className="clients-pagination">
            <p className="clients-pagination__count">
              {count} client{count === 1 ? '' : 's'} total
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <ClientFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        client={editingClient}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        tone="danger"
        title="Delete this client?"
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

export default Clients;
