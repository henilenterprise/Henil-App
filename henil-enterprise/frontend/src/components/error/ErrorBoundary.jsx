import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import Button from '../ui/Button.jsx';
import './ErrorBoundary.css';

/*
  Production-readiness fix: without a top-level error boundary, any
  uncaught error thrown while rendering ANYWHERE in the tree unmounts
  the entire React app — the user gets a blank white screen with no
  way to recover except knowing to hit refresh. React error boundaries
  can only be class components (there is no hook equivalent as of
  React 18), which is why this one file breaks from the rest of the
  codebase's function-component convention.

  This is intentionally the outermost thing rendered (see main.jsx) —
  above the router and every context provider — so it can catch
  errors thrown during their initialization too, not just errors from
  page content.

  SECURITY: the raw error message/stack is only shown when running in
  Vite dev mode (import.meta.env.DEV). In production it's logged to
  the console for whoever has access to it, but never rendered to the
  screen — matching the same "don't leak internals to the user"
  principle already applied to backend error responses.
*/
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="error-boundary">
        <div className="error-boundary__card">
          <div className="error-boundary__icon">
            <AlertTriangle size={26} strokeWidth={1.5} />
          </div>
          <h1 className="error-boundary__title">Something went wrong</h1>
          <p className="error-boundary__description">
            An unexpected error occurred. Reloading the page usually fixes it — your data is safe;
            nothing is saved until you submit a form.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="error-boundary__details">{String(this.state.error?.stack || this.state.error)}</pre>
          )}
          <Button icon={RotateCcw} onClick={this.handleReload}>
            Reload page
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
