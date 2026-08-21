import { FileText, CheckCircle2, Receipt, PackageX } from 'lucide-react';
import KPICard from './KPICard.jsx';
import './OverviewGrid.css';

function BusinessOverview({ data }) {
  return (
    <div className="overview-grid overview-grid--business">
      <KPICard icon={FileText} label="Open Quotations" value={data.openQuotations} tone="default" />
      <KPICard icon={CheckCircle2} label="Accepted Quotations" value={data.acceptedQuotations} tone="success" />
      <KPICard icon={Receipt} label="Pending Invoices" value={data.pendingInvoices} tone="warning" />
      <KPICard icon={PackageX} label="Low Stock" value={data.lowStock} tone="danger" />
    </div>
  );
}

export default BusinessOverview;
