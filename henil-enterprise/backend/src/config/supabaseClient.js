import { createClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from './env.js';

/*
  Supabase client (backend / server-side only).

  SECURITY: this uses the "service_role" key, which bypasses Row
  Level Security entirely. It must NEVER be sent to, imported by, or
  otherwise reachable from frontend/ code. Only backend/.env should
  ever contain SUPABASE_SERVICE_ROLE_KEY.

  Exported as `null` when not configured so the rest of the backend
  can boot and serve a health check without crashing — callers must
  check `isSupabaseConfigured` (re-exported below) before using it.
*/

export const supabase = isSupabaseConfigured
  ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    })
  : null;

export { isSupabaseConfigured };
