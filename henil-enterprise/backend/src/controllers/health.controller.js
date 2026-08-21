import { checkDatabaseHealth } from '../services/databaseHealthService.js';

// GET /api/health — confirms the backend process itself is up.
export function getHealth(req, res) {
  res.json({
    status: 'ok',
    service: 'henil-enterprise-backend',
    timestamp: new Date().toISOString(),
  });
}

// GET /api/health/db — confirms the backend can reach Supabase.
// Always responds 200; the body's `status` field distinguishes
// not_configured / connected / error so callers can render the
// specific reason rather than just a generic failure.
export async function getDatabaseHealth(req, res) {
  const result = await checkDatabaseHealth();
  res.json({
    service: 'henil-enterprise-backend',
    timestamp: new Date().toISOString(),
    database: result,
  });
}
