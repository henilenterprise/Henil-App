/*
  Central configuration for the frontend.

  Every place in the app that needs an environment value should
  import from here rather than reading import.meta.env directly, so
  there is exactly one place that knows the variable names and
  defaults.
*/

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const config = {
  supabaseUrl,
  supabaseAnonKey,
  apiBaseUrl,
};

// True only when both Supabase values are present. Every consumer
// (supabaseClient, health checks, UI) should check this before
// assuming Supabase is actually reachable.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Human-readable list of exactly which env vars are missing, so the
// UI and console warnings can tell the developer precisely what to
// set instead of a generic "not configured" message.
export function getMissingSupabaseEnvVars() {
  const missing = [];
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  return missing;
}
