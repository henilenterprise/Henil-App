import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Grid2x2, RotateCcw, Trash2 } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import SearchBar from '../components/ui/SearchBar.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Alert from '../components/ui/Alert.jsx';
import Dropdown from '../components/ui/Dropdown.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { listNestingJobs, deleteNestingJob } from '../services/nestingService.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import { formatDate } from '../utils/formatDate.js';
import './NestingJobs.css';

const PAGE_SIZE = 12;

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function NestingJobs() {
  const navigate = useNavigate();
  const toast = useToast();

  const [jobs, setJobs] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, count: total } = await listNestingJobs({ search: debouncedSearch, page, pageSize: PAGE_SIZE });
      setJobs(data);
      setCount(total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteNestingJob(deleteTarget.id);
      toast.success('Nesting job deleted', `${deleteTarget.job_code} was removed.`);
      setDeleteTarget(null);
      fetchJobs();
    } catch (err) {
      toast.error("Couldn't delete nesting job", getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Nesting Jobs"
        description="Sheet cutting layouts — saved calculations you can reopen any time."
        actions={
          <Button icon={Plus} onClick={() => navigate('/artwork-vault/nesting/new')}>
            New Nesting Job
          </Button>
        }
      />

      <Card padding="none">
        <div className="nesting-jobs-toolbar">
          <SearchBar value={search} onChange={setSearch} onClear={() => setSearch('')} placeholder="Search by job name or code…" />
        </div>

        <div className="nesting-jobs-body">
          {error && (
            <div className="nesting-jobs-body__pad">
              <Alert tone="danger" title="Couldn't load nesting jobs">
                {error}
              </Alert>
              <div className="nesting-jobs-retry">
                <Button variant="outline" icon={RotateCcw} onClick={fetchJobs}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!error && loading && <Spinner size="lg" label="Loading nesting jobs…" />}

          {!error && !loading && jobs.length === 0 && (
            <EmptyState
              icon={Grid2x2}
              title="No nesting jobs yet"
              description="Set up a sheet and parts list to calculate your first cutting layout."
              action={
                <Button icon={Plus} onClick={() => navigate('/artwork-vault/nesting/new')}>
                  New Nesting Job
                </Button>
              }
            />
          )}

          {!error && !loading && jobs.length > 0 && (
            <div className="nesting-jobs-grid">
              {jobs.map((job) => (
                <div key={job.id} className="nesting-job-card">
                  <button type="button" className="nesting-job-card__main" onClick={() => navigate(`/artwork-vault/nesting/${job.id}`)}>
                    <p className="nesting-job-card__code">{job.job_code}</p>
                    <p className="nesting-job-card__name">{job.job_name}</p>
                    <p className="nesting-job-card__meta">
                      {job.sheet_width} × {job.sheet_height} mm {job.material ? `· ${job.material}` : ''}
                    </p>
                    {job.client && <Badge tone="neutral">{job.client.company_name}</Badge>}
                    {job.result_computed_at && (
                      <Badge tone="success">
                        {job.result_sheets_required} sheet{job.result_sheets_required === 1 ? '' : 's'} · {Number(job.result_utilization_pct).toFixed(1)}%
                      </Badge>
                    )}
                    <p className="nesting-job-card__date">{formatDate(job.created_at)}</p>
                  </button>
                  <Dropdown
                    align="right"
                    trigger={
                      <button type="button" className="icon-trigger nesting-job-card__menu" aria-label="More actions">
                        <Trash2 size={16} />
                      </button>
                    }
                    items={[{ label: 'Delete', icon: Trash2, tone: 'danger', onClick: () => setDeleteTarget(job) }]}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {!error && !loading && count > PAGE_SIZE && (
          <div className="nesting-jobs-pagination">
            <p className="nesting-jobs-pagination__count">
              {count} job{count === 1 ? '' : 's'} total
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
        title="Delete this nesting job?"
        description={deleteTarget ? `This will permanently remove ${deleteTarget.job_code} and its saved layout. This action cannot be undone.` : ''}
        confirmLabel="Delete"
      />
    </>
  );
}

export default NestingJobs;
