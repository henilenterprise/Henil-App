import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, Wallet, Clock, AlertTriangle, ReceiptText, PiggyBank, RotateCcw, CheckCircle2, Hourglass, CircleDashed } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Select from '../components/ui/Select.jsx';
import DatePicker from '../components/ui/DatePicker.jsx';
import Button from '../components/ui/Button.jsx';
import Alert from '../components/ui/Alert.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import KPICard from '../components/dashboard/KPICard.jsx';
import { getFinanceSummary } from '../services/financeService.js';
import { listClients } from '../services/clientsService.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './Finance.css';

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function getPresetRange(preset) {
  const now = new Date();
  if (preset === 'this_month') {
    return { from: isoDate(startOfMonth(now)), to: isoDate(endOfMonth(now)) };
  }
  if (preset === 'last_month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from: isoDate(startOfMonth(lastMonth)), to: isoDate(endOfMonth(lastMonth)) };
  }
  if (preset === 'this_year') {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  }
  return { from: '', to: '' }; // all_time
}

const PRESET_OPTIONS = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'all_time', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

function parseIsoDate(v) {
  return v ? new Date(`${v}T00:00:00`) : null;
}

function Finance() {
  const [preset, setPreset] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clients, setClients] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const range = preset === 'custom' ? { from: customFrom, to: customTo } : getPresetRange(preset);

  useEffect(() => {
    listClients({ pageSize: 500, sortBy: 'company_name', ascending: true }).then((res) => setClients(res.data)).catch(() => setClients([]));
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFinanceSummary({ ...range, clientId: clientFilter, status: statusFilter });
      setSummary(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, clientFilter, statusFilter]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <>
      <PageHeader title="Finance" description="Overview of company finances and cash flow." />

      <Card padding="none" className="finance-filter-card">
        <div className="finance-filter">
          <Select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            options={PRESET_OPTIONS}
            aria-label="Date range"
          />
          {preset === 'custom' && (
            <>
              <DatePicker
                label="From"
                value={parseIsoDate(customFrom)}
                onChange={(d) => setCustomFrom(d ? isoDate(d) : '')}
              />
              <DatePicker
                label="To"
                value={parseIsoDate(customTo)}
                onChange={(d) => setCustomTo(d ? isoDate(d) : '')}
              />
            </>
          )}
          <Select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            options={[{ value: '', label: 'All clients' }, ...clients.map((c) => ({ value: c.id, label: c.company_name }))]}
            aria-label="Filter by client"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All invoice statuses' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SENT', label: 'Sent' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
              { value: 'PAID', label: 'Paid' },
              { value: 'OVERDUE', label: 'Overdue' },
            ]}
            aria-label="Filter by invoice status"
          />
        </div>
      </Card>

      {error && (
        <Card>
          <Alert tone="danger" title="Couldn't load finance summary">
            {error}
          </Alert>
          <div className="finance-retry">
            <Button variant="outline" icon={RotateCcw} onClick={fetchSummary}>
              Try again
            </Button>
          </div>
        </Card>
      )}

      {!error && loading && (
        <Card>
          <Spinner size="lg" label="Calculating…" />
        </Card>
      )}

      {!error && !loading && summary && (
        <div className="finance-grid">
          <KPICard icon={TrendingUp} label="Total Sales" value={formatCurrency(summary.totalSales)} tone="default" />
          <KPICard icon={Wallet} label="Total Collected" value={formatCurrency(summary.totalCollected)} tone="success" />
          <KPICard icon={Clock} label="Outstanding" value={formatCurrency(summary.outstanding)} tone="warning" />
          <KPICard icon={AlertTriangle} label="Overdue" value={formatCurrency(summary.overdue)} tone="danger" />
          <KPICard icon={ReceiptText} label="Expenses" value={formatCurrency(summary.expenses)} tone="default" />
          <KPICard icon={PiggyBank} label="Net Revenue" value={formatCurrency(summary.netRevenue)} tone="success" />
          <KPICard icon={CheckCircle2} label="Paid" value={formatCurrency(summary.statusBreakdown.paid)} tone="success" />
          <KPICard icon={CircleDashed} label="Pending" value={formatCurrency(summary.statusBreakdown.pending)} tone="warning" />
          <KPICard icon={Hourglass} label="Partially Paid" value={formatCurrency(summary.statusBreakdown.partiallyPaid)} tone="warning" />
        </div>
      )}
    </>
  );
}

export default Finance;
