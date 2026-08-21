import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Layers, RotateCcw, Grid3x3, Grid2x2 } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import SearchBar from '../components/ui/SearchBar.jsx';
import Select from '../components/ui/Select.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Alert from '../components/ui/Alert.jsx';
import ArtworkFormModal from '../components/artwork/ArtworkFormModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { listArtworks, listArtworkMaterials, listArtworkThicknesses, createArtwork } from '../services/artworkService.js';
import { listClients } from '../services/clientsService.js';
import { listActiveProductsForPicker } from '../services/productsService.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './ArtworkVault.css';

const PAGE_SIZE = 12;

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function ArtworkVault() {
  const navigate = useNavigate();
  const toast = useToast();

  const [artworks, setArtworks] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [clientFilter, setClientFilter] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [thicknessFilter, setThicknessFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [page, setPage] = useState(1);

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [thicknesses, setThicknesses] = useState([]);

  const [formOpen, setFormOpen] = useState(false);

  const fetchArtworks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count: total } = await listArtworks({
        search: debouncedSearch,
        clientId: clientFilter,
        material: materialFilter,
        thickness: thicknessFilter,
        status: statusFilter,
        page,
        pageSize: PAGE_SIZE,
      });
      setArtworks(data);
      setCount(total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, clientFilter, materialFilter, thicknessFilter, statusFilter, page]);

  useEffect(() => {
    fetchArtworks();
  }, [fetchArtworks]);

  useEffect(() => {
    listClients({ pageSize: 500, sortBy: 'company_name', ascending: true }).then((res) => setClients(res.data)).catch(() => setClients([]));
    listActiveProductsForPicker().then(setProducts).catch(() => setProducts([]));
    listArtworkMaterials().then(setMaterials).catch(() => setMaterials([]));
    listArtworkThicknesses().then(setThicknesses).catch(() => setThicknesses([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, clientFilter, materialFilter, thicknessFilter, statusFilter]);

  const hasActiveFilters = Boolean(debouncedSearch || clientFilter || materialFilter || thicknessFilter);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  async function handleCreate(payload) {
    const created = await createArtwork(payload);
    toast.success('Artwork added', `${created.artwork_code} was created successfully.`);
    fetchArtworks();
    listArtworkMaterials().then(setMaterials).catch(() => {});
    listArtworkThicknesses().then(setThicknesses).catch(() => {});
  }

  function clearFilters() {
    setSearch('');
    setClientFilter('');
    setMaterialFilter('');
    setThicknessFilter('');
  }

  return (
    <>
      <PageHeader
        title="Artwork Vault"
        description="Your manufacturing design archive — search, version, and reuse artwork across jobs."
        actions={
          <>
            <Button variant="outline" icon={Grid2x2} onClick={() => navigate('/artwork-vault/nesting')}>
              Nesting Optimizer
            </Button>
            <Button icon={Plus} onClick={() => setFormOpen(true)}>
              Add Artwork
            </Button>
          </>
        }
      />

      <Card padding="none">
        <div className="artwork-vault-toolbar">
          <div className="artwork-vault-toolbar__search">
            <SearchBar value={search} onChange={setSearch} onClear={() => setSearch('')} placeholder="Search by name, code, or tag…" />
          </div>
          <div className="artwork-vault-toolbar__filters">
            <Select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              options={[{ value: '', label: 'All clients' }, ...clients.map((c) => ({ value: c.id, label: c.company_name }))]}
              aria-label="Filter by client"
            />
            <Select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              options={[{ value: '', label: 'All materials' }, ...materials.map((m) => ({ value: m, label: m }))]}
              aria-label="Filter by material"
            />
            <Select
              value={thicknessFilter}
              onChange={(e) => setThicknessFilter(e.target.value)}
              options={[{ value: '', label: 'All thicknesses' }, ...thicknesses.map((t) => ({ value: t, label: t }))]}
              aria-label="Filter by thickness"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'ARCHIVED', label: 'Archived' },
              ]}
              aria-label="Filter by status"
            />
          </div>
        </div>

        <div className="artwork-vault-body">
          {error && (
            <div className="artwork-vault-body__pad">
              <Alert tone="danger" title="Couldn't load artwork">
                {error}
              </Alert>
              <div className="artwork-vault-retry">
                <Button variant="outline" icon={RotateCcw} onClick={fetchArtworks}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!error && loading && <Spinner size="lg" label="Loading artwork…" />}

          {!error && !loading && artworks.length === 0 && !hasActiveFilters && (
            <EmptyState
              icon={Layers}
              title="No artwork yet"
              description="Add your first artwork to start building your design archive."
              action={
                <Button icon={Plus} onClick={() => setFormOpen(true)}>
                  Add Artwork
                </Button>
              }
            />
          )}

          {!error && !loading && artworks.length === 0 && hasActiveFilters && (
            <EmptyState
              icon={Layers}
              title="No artwork matches your search"
              description="Try a different search term or clear the filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}

          {!error && !loading && artworks.length > 0 && (
            <div className="artwork-grid">
              {artworks.map((art) => (
                <button key={art.id} type="button" className="artwork-card" onClick={() => navigate(`/artwork-vault/${art.id}`)}>
                  <div className="artwork-card__icon">
                    <Grid3x3 size={20} />
                  </div>
                  <p className="artwork-card__code">{art.artwork_code}</p>
                  <p className="artwork-card__name">{art.artwork_name}</p>
                  <p className="artwork-card__meta">
                    {[art.material, art.thickness].filter(Boolean).join(' \u00b7 ') || '\u2014'}
                  </p>
                  {art.client && <Badge tone="neutral">{art.client.company_name}</Badge>}
                  {art.status === 'ARCHIVED' && (
                    <Badge tone="neutral" className="artwork-card__archived-badge">
                      Archived
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {!error && !loading && count > PAGE_SIZE && (
          <div className="artwork-vault-pagination">
            <p className="artwork-vault-pagination__count">
              {count} artwork{count === 1 ? '' : 's'} total
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <ArtworkFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        artwork={null}
        clients={clients}
        products={products}
        onSubmit={handleCreate}
      />
    </>
  );
}

export default ArtworkVault;
