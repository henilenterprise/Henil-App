import { supabase, isSupabaseConfigured } from '../config/supabaseClient.js';
import { getMissingSupabaseEnvVars } from '../config/env.js';

/*
  Supabase service layer (backend).

  Business-data functions will be added here in later phases, once
  those modules are built. For now this only contains a database
  connection/health check, run with the service_role key so it
  bypasses RLS and gives an authoritative answer (unlike the
  frontend's anon-key check, which is inherently row-filtered).

  SECURITY: /api/health/db has no auth middleware (this backend has
  no session-checking layer of its own — auth is Supabase Auth,
  enforced client-side and via RLS), so it's reachable by anyone who
  can reach the server at all, not just signed-in dashboard users.
  Raw upstream error text (which can include table/column names or
  other schema details) must therefore never be returned in the HTTP
  response — only logged server-side for whoever has log access.
*/

/**
 * @returns {Promise<{status: 'not_configured'|'connected'|'error', message: string, missing?: string[], details?: string}>}
 */
export async function checkDatabaseHealth() {
  if (!isSupabaseConfigured) {
    return {
      status: 'not_configured',
      message: 'Supabase environment variables are not set.',
      missing: getMissingSupabaseEnvVars(),
    };
  }

  try {
    const { error, count } = await supabase
      .from('company_settings')
      .select('id', { count: 'exact', head: true });

    if (error) {
      // A "relation does not exist" error here usually means the
      // migrations in database/migrations haven't been run yet.
      // eslint-disable-next-line no-console
      console.error('[databaseHealthService] Supabase query failed:', error);
      return {
        status: 'error',
        message: 'Supabase responded, but the request failed. Check server logs for details.',
      };
    }

    return {
      status: 'connected',
      message: `Connected to Supabase with the service_role key. company_settings has ${count ?? 0} row(s).`,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[databaseHealthService] Could not reach Supabase:', err);
    return {
      status: 'error',
      message: 'Could not reach Supabase. Check server logs for details.',
    };
  }
}
