import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Factory, CheckCircle2, XCircle, Loader2, Palette, LayoutDashboard, Activity } from 'lucide-react';
import { getBackendHealth } from '../services/api.js';
import { useCompany } from '../hooks/useCompany.js';
import './Home.css';

/*
  Foundation-stage placeholder page.
  Confirms: Vite + React render correctly, react-router-dom is wired
  up, lucide-react icons render, and (optionally) the backend is
  reachable. This page will be replaced once real pages are built.
*/
function Home() {
  const { company } = useCompany();
  const [backendStatus, setBackendStatus] = useState('checking'); // checking | online | offline

  useEffect(() => {
    getBackendHealth()
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  return (
    <div className="home-screen">
      <div className="home-card">
        <div className="home-icon">
          <Factory size={28} strokeWidth={1.5} />
        </div>
        <p className="home-eyebrow">{company?.company_name || 'Henil Enterprise'}</p>
        <h1>Frontend is running</h1>
        <p className="home-sub">
          Acrylic &amp; Polycarbonate Manufacturing and Fabrication
        </p>
        <div className="home-divider" />

        <div className="home-status">
          {backendStatus === 'checking' && (
            <>
              <Loader2 size={16} className="spin" />
              <span>Checking backend connection…</span>
            </>
          )}
          {backendStatus === 'online' && (
            <>
              <CheckCircle2 size={16} color="#2e7d4f" />
              <span>Backend connected (http://localhost:5000)</span>
            </>
          )}
          {backendStatus === 'offline' && (
            <>
              <XCircle size={16} color="#a12f2f" />
              <span>Backend not reachable — start it separately</span>
            </>
          )}
        </div>

        <div className="home-links">
          <Link to="/dashboard" className="home-uikit-link">
            <LayoutDashboard size={15} />
            Enter application
          </Link>
          <Link to="/ui-kit" className="home-uikit-link">
            <Palette size={15} />
            View design system &amp; UI kit
          </Link>
          <Link to="/system-health" className="home-uikit-link">
            <Activity size={15} />
            System health check
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
