import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import FullScreenLoader from '../components/layout/FullScreenLoader.jsx';

/*
  Wraps a group of routes so they're only reachable when signed in.
  While the initial session check is in flight, shows a full-screen
  loader rather than flashing the login page or the protected content.
  Remembers where the user was trying to go (location state) so Login
  can send them back after a successful sign-in.
*/
function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader label="Checking your session…" />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
