import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import Button from '../ui/Button.jsx';
import './AccessDenied.css';

const MODULE_LABELS = {
  clients: 'Clients',
  products: 'Products',
  quotations: 'Quotations',
  invoices: 'Invoices',
  payments: 'Payments',
  finance: 'Finance',
  expenses: 'Expenses',
  inventory: 'Inventory',
  suppliers: 'Suppliers',
  reports: 'Reports',
  settings: 'Settings',
};

function AccessDenied({ module }) {
  const navigate = useNavigate();
  const label = MODULE_LABELS[module] || 'this section';

  return (
    <div className="access-denied">
      <div className="access-denied__icon">
        <ShieldAlert size={28} />
      </div>
      <h1 className="access-denied__title">You don&rsquo;t have access to {label}</h1>
      <p className="access-denied__body">
        Your account role doesn&rsquo;t include {label.toLowerCase()}. If you need access, ask an administrator to
        grant it.
      </p>
      <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
    </div>
  );
}

export default AccessDenied;
