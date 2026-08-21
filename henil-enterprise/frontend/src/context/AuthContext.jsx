import { createContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient.js';
import { isSupabaseConfigured, getMissingSupabaseEnvVars } from '../config/env.js';

/*
  Authentication context, backed entirely by Supabase Auth.

  IMPORTANT: no passwords are ever stored in our own database.
  Sign-in goes straight to Supabase Auth (email/password) — the only
  place credentials are held. Our public.users table (see
  database/migrations) only stores profile/role metadata; it has no
  password column and never will.

  Session persistence: the Supabase browser client persists the
  session in localStorage by default and rehydrates it automatically
  on load, so a browser refresh does not log the user out. This
  context just mirrors that state into React via
  supabase.auth.getSession() (initial load) and
  supabase.auth.onAuthStateChange() (every subsequent change,
  including the rehydration itself, sign-in, sign-out, and token
  refresh).

  Profile/role: once signed in, this also fetches the matching
  public.users row (full_name, role) so components can gate UI on
  role — e.g. only manager/admin can see a "Delete" action, matching
  the RLS policies that actually enforce it server-side. This is a
  UX nicety (a clear absent button beats a cryptic permission-denied
  error), not the real access control — RLS is.
*/

/*
  Module permission matrix — MUST mirror role_has_module() in
  database/migrations/20260815100700_role_based_access_control.sql
  exactly. This copy exists for frontend UX only (hiding nav items,
  redirecting away from a page with a clear message instead of
  rendering it and letting every request inside it fail one by one):
  it is NOT the enforcement. RLS in Postgres is — a request that
  bypasses this check entirely (a raw call to the Supabase API) is
  still governed by the database function, independent of anything
  here.
*/
const ROLE_MODULES = {
  admin: null, // null = every module
  manager: ['clients', 'products', 'quotations', 'invoices', 'inventory', 'reports', 'artwork'],
  sales: ['clients', 'products', 'quotations'],
  accounts: ['invoices', 'payments', 'finance', 'expenses', 'reports'],
  staff: ['inventory'],
};

function roleHasModule(role, assignedModules, module) {
  if (!role) return false;
  const roleModules = ROLE_MODULES[role];
  if (roleModules === null) return true; // admin
  if (roleModules && roleModules.includes(module)) return true;
  return Array.isArray(assignedModules) && assignedModules.includes(module);
}

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const { data, error: profileError } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      if (profileError) throw profileError;
      setProfile(data ?? null);
    } catch {
      // Non-fatal: role-gated UI just falls back to "not authorized"
      // rather than blocking sign-in over a profile-fetch hiccup.
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError(`Supabase is not configured. Missing: ${getMissingSupabaseEnvVars().join(', ')}.`);
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!isMounted) return;
      if (sessionError) setError(sessionError.message);
      const nextUser = data?.session?.user ?? null;
      setSession(data?.session ?? null);
      setUser(nextUser);
      setLoading(false);
      if (nextUser) fetchProfile(nextUser.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      const nextUser = newSession?.user ?? null;
      setSession(newSession);
      setUser(nextUser);
      setLoading(false);
      if (nextUser) fetchProfile(nextUser.id);
      else setProfile(null);
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      const message = `Supabase is not configured. Missing: ${getMissingSupabaseEnvVars().join(', ')}.`;
      setError(message);
      return { error: message };
    }

    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      return { error: signInError.message };
    }

    setSession(data.session);
    setUser(data.user);
    if (data.user) fetchProfile(data.user.id);
    return { error: null };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSession(null);
      setUser(null);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const role = profile?.role ?? null;
  const isManagerOrAdmin = role === 'admin' || role === 'manager';
  const hasModuleAccess = useCallback(
    (module) => roleHasModule(role, profile?.assigned_modules, module),
    [role, profile]
  );

  const value = {
    user,
    session,
    profile,
    role,
    isManagerOrAdmin,
    hasModuleAccess,
    loading,
    error,
    isSupabaseConfigured,
    signIn,
    signOut,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
