import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import './NotFound.css';

function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found__icon">
        <Compass size={26} strokeWidth={1.5} />
      </div>
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="text-muted">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/dashboard">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  );
}

export default NotFound;
