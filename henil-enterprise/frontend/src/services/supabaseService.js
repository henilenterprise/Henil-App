import { supabase, isSupabaseConfigured, getMissingSupabaseEnvVars } from './supabaseClient.js';

/*
  Supabase service layer (frontend).

  Business-data functions (clients, products, quotations, etc.) will
  be added here in later phases, once those modules are built. For
  now this only contains a connection/health check, used to prove the
  wiring works end to end before any real feature is built on top of it.
*/

/**
 * Lightweight connectivity check against Supabase.
 *
 * Queries `company_settings` (expected to have zero rows — nothing is
 * seeded yet) with `head: true` so no row data is transferred, just a
 * count. A *successful* response with 0 rows is the expected, correct
 * outcome: it proves the URL and anon key are valid and the schema
 * from database/migrations has been deployed. Row Level Security
 * additionally guarantees an anonymous request never sees real data
 * even if some existed.
 *
 * @returns {Promise<{status: 'not_configured'|'connected'|'error', message: string, missing?: string[], details?: string}>}
 */
export async function checkSupabaseConnection() {
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
      return {
        status: 'error',
        message: 'Supabase responded, but the request failed.',
        details: error.message,
      };
    }

    return {
      status: 'connected',
      message: `Connected to Supabase. company_settings has ${count ?? 0} row(s).`,
    };
  } catch (err) {
    return {
      status: 'error',
      message: 'Could not reach Supabase. Check the URL and your network connection.',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}
