/*
  Central configuration for the backend.

  Every place in the app that needs an environment value should
  import from here rather than reading process.env directly, so
  there is exactly one place that knows the variable names, defaults,
  and what's required vs optional.

  Must be imported after 'dotenv/config' has run (see server.js).
*/

const port = process.env.PORT || 5000;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const config = {
  port,
  corsOrigin,
  supabaseUrl,
  supabaseServiceRoleKey,
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

export function getMissingSupabaseEnvVars() {
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return missing;
}

export function logConfigWarnings() {
  if (!isSupabaseConfigured) {
    // eslint-disable-next-line no-console
    console.warn(
      `[config] Supabase is not configured. Missing: ${getMissingSupabaseEnvVars().join(', ')}. ` +
        'Copy backend/.env.example to backend/.env and fill in your Supabase project values ' +
        '(Supabase Dashboard -> Project Settings -> API -> service_role key).'
    );
  }
}
