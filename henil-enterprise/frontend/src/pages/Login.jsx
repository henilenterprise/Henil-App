import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Factory, Mail, Lock } from 'lucide-react';
import Input from '../components/ui/Input.jsx';
import Button from '../components/ui/Button.jsx';
import Alert from '../components/ui/Alert.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useCompany } from '../hooks/useCompany.js';
import './Login.css';

function Login() {
  const { user, loading, signIn, isSupabaseConfigured } = useAuth();
  const { company } = useCompany();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Already signed in — send them straight to where they were headed
  // (or the dashboard), rather than showing the login form again.
  if (!loading && user) {
    const redirectTo = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (!email.trim() || !password) {
      setFormError('Enter both your email and password.');
      return;
    }

    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);

    if (error) {
      setFormError(error);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__mark">
          <Factory size={20} strokeWidth={1.5} />
        </div>
        <p className="login-card__eyebrow">{company?.company_name || 'Henil Enterprise'}</p>
        <h1>Sign in</h1>
        <p className="login-card__sub">Acrylic &amp; Polycarbonate Manufacturing and Fabrication</p>

        <div className="login-card__alerts">
          {!isSupabaseConfigured && (
            <Alert tone="warning" title="Supabase is not configured">
              Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
              <code>frontend/.env</code>, then restart the dev server.
            </Alert>
          )}
          {formError && (
            <Alert tone="danger" title="Sign-in failed">
              {formError}
            </Alert>
          )}
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Email"
            type="email"
            icon={Mail}
            placeholder="you@henilenterprise.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={submitting}
            required
          />
          <Input
            label="Password"
            type="password"
            icon={Lock}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={submitting}
            required
          />
          <Button type="submit" fullWidth loading={submitting} disabled={!isSupabaseConfigured}>
            Sign in
          </Button>
        </form>

        <p className="login-card__footer">
          Access is limited to authorized {company?.company_name || 'Henil Enterprise'} personnel.
        </p>
      </div>
    </div>
  );
}

export default Login;
