import { TrendingUp, Wallet, Clock, AlertTriangle, ReceiptText, PiggyBank } from 'lucide-react';
import KPICard from './KPICard.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import './OverviewGrid.css';

function FinancialOverview({ data }) {
  return (
    <div className="overview-grid overview-grid--financial">
      <KPICard icon={TrendingUp} label="Total Sales" value={formatCurrency(data.totalSales)} tone="default" />
      <KPICard icon={Wallet} label="Payments Received" value={formatCurrency(data.paymentsReceived)} tone="success" />
      <KPICard icon={Clock} label="Outstanding" value={formatCurrency(data.outstanding)} tone="warning" />
      <KPICard icon={AlertTriangle} label="Overdue" value={formatCurrency(data.overdue)} tone="danger" />
      <KPICard icon={ReceiptText} label="Expenses" value={formatCurrency(data.expenses)} tone="default" />
      <KPICard icon={PiggyBank} label="Net Revenue" value={formatCurrency(data.netRevenue)} tone="success" />
    </div>
  );
}

export default FinancialOverview;
