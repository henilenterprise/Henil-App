import { createClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured, getMissingSupabaseEnvVars } from '../config/env.js';

/*
  Supabase client (browser).

  SECURITY: this file must only ever use the "anon" / "public" key.
  That key is safe to ship to the browser by design — real data
  protection comes from the Row Level Security policies defined in
  database/migrations, not from keeping this key secret. The
  "service_role" key that bypasses RLS must never appear here or
  anywhere under frontend/ — it belongs only in backend/.env
  (see backend/src/config/supabaseClient.js).
*/

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    `[supabaseClient] Supabase is not configured. Missing: ${getMissingSupabaseEnvVars().join(', ')}. ` +
      'Copy frontend/.env.example to frontend/.env and fill in your Supabase project values ' +
      '(Supabase Dashboard -> Project Settings -> API).'
  );
}

// Created even when not configured (with empty strings) so importing
// this module never throws; callers should check isSupabaseConfigured
// (re-exported below) before relying on real responses.
export const supabase = createClient(
  config.supabaseUrl || 'https://placeholder.invalid',
  config.supabaseAnonKey || 'placeholder-anon-key'
);

export { isSupabaseConfigured, getMissingSupabaseEnvVars };
