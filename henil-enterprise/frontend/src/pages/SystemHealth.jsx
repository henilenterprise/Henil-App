import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import { checkSupabaseConnection } from '../services/supabaseService.js';
import { getBackendHealth, getBackendDatabaseHealth } from '../services/api.js';
import './SystemHealth.css';

const STATUS_META = {
  connected: { tone: 'success', icon: CheckCircle2, label: 'Connected' },
  ok: { tone: 'success', icon: CheckCircle2, label: 'Connected' },
  not_configured: { tone: 'warning', icon: AlertTriangle, label: 'Not configured' },
  error: { tone: 'danger', icon: XCircle, label: 'Error' },
  unreachable: { tone: 'danger', icon: XCircle, label: 'Unreachable' },
};

function StatusRow({ title, result, loading }) {
  const meta = STATUS_META[result?.status] || STATUS_META.unreachable;
  const Icon = meta.icon;

  return (
    <div className="health-row">
      <div className="health-row__header">
        <p className="health-row__title">{title}</p>
        {loading ? (
          <Badge tone="neutral">Checking…</Badge>
        ) : (
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
        )}
      </div>
      {!loading && result && (
        <div className="health-row__body">
          <div className="health-row__message">
            <Icon size={15} className={`health-row__icon health-row__icon--${meta.tone}`} />
            <span>{result.message}</span>
          </div>
          {result.missing && result.missing.length > 0 && (
            <p className="health-row__detail">
              Missing env var{result.missing.length > 1 ? 's' : ''}:{' '}
              <code>{result.missing.join(', ')}</code>
            </p>
          )}
          {result.details && <p className="health-row__detail">{result.details}</p>}
        </div>
      )}
    </div>
  );
}

function SystemHealth() {
  const [frontendSupabase, setFrontendSupabase] = useState(null);
  const [backend, setBackend] = useState(null);
  const [backendDb, setBackendDb] = useState(null);
  const [loading, setLoading] = useState(true);

  async function runChecks() {
    setLoading(true);
    setFrontendSupabase(null);
    setBackend(null);
    setBackendDb(null);

    const [supabaseResult, backendResult, backendDbResult] = await Promise.all([
      checkSupabaseConnection(),
      getBackendHealth()
        .then((r) => ({ status: r.status === 'ok' ? 'ok' : 'error', message: `Backend service is ${r.status}.` }))
        .catch((err) => ({ status: 'unreachable', message: 'Could not reach the backend.', details: err.message })),
      getBackendDatabaseHealth()
        .then((r) => r.database)
        .catch((err) => ({ status: 'unreachable', message: 'Could not reach the backend.', details: err.message })),
    ]);

    setFrontendSupabase(supabaseResult);
    setBackend(backendResult);
    setBackendDb(backendDbResult);
    setLoading(false);
  }

  useEffect(() => {
    runChecks();
  }, []);

  return (
    <div className="system-health">
      <div className="container system-health__inner">
        <Link to="/" className="system-health__back">
          <ArrowLeft size={14} />
          Back
        </Link>

        <div className="system-health__heading">
          <div>
            <p className="eyebrow">Henil Enterprise</p>
            <h1>System health</h1>
            <p className="text-muted">
              Checks that environment variables, the backend, and the Supabase connection are all
              wired up correctly. No business data is read or written here.
            </p>
          </div>
          <Button icon={RefreshCw} variant="outline" onClick={runChecks} loading={loading}>
            Re-run checks
          </Button>
        </div>

        <div className="system-health__grid">
          <Card title="Frontend → Supabase" subtitle="Direct browser connection using the anon key">
            <StatusRow title="Supabase (anon key)" result={frontendSupabase} loading={loading} />
          </Card>

          <Card title="Frontend → Backend" subtitle="Express server reachability">
            <StatusRow title="Backend service" result={backend} loading={loading} />
          </Card>

          <Card title="Backend → Supabase" subtitle="Server connection using the service_role key">
            <StatusRow title="Supabase (service_role key)" result={backendDb} loading={loading} />
          </Card>
        </div>

        <Card title="Don't have credentials yet?" className="system-health__help">
          <p>To connect a real Supabase project, you'll need three values from your Supabase Dashboard under <strong>Project Settings → API</strong>:</p>
          <ul className="system-health__list">
            <li><strong>Project URL</strong> — goes in <code>VITE_SUPABASE_URL</code> and <code>SUPABASE_URL</code></li>
            <li><strong>anon / public key</strong> — goes in <code>VITE_SUPABASE_ANON_KEY</code> (frontend only)</li>
            <li><strong>service_role key</strong> — goes in <code>SUPABASE_SERVICE_ROLE_KEY</code> (backend only, click &quot;Reveal&quot;)</li>
          </ul>
          <p>
            Copy <code>frontend/.env.example</code> to <code>frontend/.env</code> and{' '}
            <code>backend/.env.example</code> to <code>backend/.env</code>, fill in the values above, then
            restart both <code>npm run dev</code> processes and re-run these checks.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default SystemHealth;
