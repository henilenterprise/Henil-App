import { useAuth } from '../hooks/useAuth.js';
import FullScreenLoader from '../components/layout/FullScreenLoader.jsx';
import AccessDenied from '../components/layout/AccessDenied.jsx';

/*
  Wraps one route's element with a module permission check. This is
  deliberately separate from ProtectedRoute (which only checks "is
  signed in") since different routes need different modules —
  ProtectedRoute already guarantees a signed-in user by the time this
  runs.

  IMPORTANT: this blocks *rendering the page*, not just a button
  inside it — someone who pastes a forbidden URL directly, or a role
  that used to have access and no longer does, gets AccessDenied
  instead of the page attempting to load and every request inside it
  failing one at a time. The real enforcement is still RLS in
  Postgres (see database/migrations/20260815100700_role_based_access_control.sql)
  — this is the UI-level counterpart so a blocked user gets a clear
  message instead of a broken page.
*/
function ModuleProtectedRoute({ module, children }) {
  const { hasModuleAccess, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader label="Checking your session…" />;
  }

  if (!hasModuleAccess(module)) {
    return <AccessDenied module={module} />;
  }

  return children;
}

export default ModuleProtectedRoute;
