import { Factory } from 'lucide-react';
import Spinner from '../ui/Spinner.jsx';
import './FullScreenLoader.css';

function FullScreenLoader({ label = 'Loading…' }) {
  return (
    <div className="full-screen-loader">
      <div className="full-screen-loader__mark">
        <Factory size={18} strokeWidth={1.5} />
      </div>
      <Spinner size="md" />
      <p>{label}</p>
    </div>
  );
}

export default FullScreenLoader;
