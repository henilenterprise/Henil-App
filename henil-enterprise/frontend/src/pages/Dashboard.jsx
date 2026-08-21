import { useCallback, useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import FinancialOverview from '../components/dashboard/FinancialOverview.jsx';
import BusinessOverview from '../components/dashboard/BusinessOverview.jsx';
import RecentQuotationsTable from '../components/dashboard/RecentQuotationsTable.jsx';
import RecentInvoicesTable from '../components/dashboard/RecentInvoicesTable.jsx';
import RecentPaymentsTable from '../components/dashboard/RecentPaymentsTable.jsx';
import LowStockSection from '../components/dashboard/LowStockSection.jsx';
import OutstandingPaymentsSection from '../components/dashboard/OutstandingPaymentsSection.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import { useCompany } from '../hooks/useCompany.js';
import { getFinanceSummary } from '../services/financeService.js';
import { listQuotations, countQuotationsByStatus } from '../services/quotationsService.js';
import { listInvoices, countInvoicesByStatus } from '../services/invoicesService.js';
import { listPayments } from '../services/paymentsService.js';
import { getInventoryOverview } from '../services/inventoryService.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './Dashboard.css';

/*
  Real data, wired up to Supabase — this used to run entirely on
  placeholder numbers from src/mock/dashboardMockData.js (deliberately
  flagged in that file's own comments as UI-phase-only, but never
  circled back to until a real production deployment surfaced the
  numbers as obviously fake). That file is no longer imported anywhere
  and has been removed.

  "This month" is used for the financial KPIs, matching the Finance
  page's own default preset, so the two pages agree with each other
  rather than showing different numbers for what looks like the same
  question.
*/

function getThisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

function daysOverdue(dueDateStr) {
  if (!dueDateStr) return 0;
  const due = new Date(dueDateStr);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((today - due) / (1000 * 60 * 60 * 24));
}

function Dashboard() {
  const { company } = useCompany();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [financial, setFinancial] = useState(null);
  const [business, setBusiness] = useState(null);
  const [recentQuotations, setRecentQuotations] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [outstandingItems, setOutstandingItems] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getThisMonthRange();

      const [
        summary,
        openQuotationsCount,
        acceptedQuotationsCount,
        pendingInvoicesCount,
        quotationsRes,
        invoicesRes,
        paymentsRes,
        unpaidInvoicesForOutstanding,
        inventoryOverview,
      ] = await Promise.all([
        getFinanceSummary({ from, to }),
        countQuotationsByStatus(['DRAFT', 'SENT', 'VIEWED']),
        countQuotationsByStatus(['ACCEPTED']),
        countInvoicesByStatus(['PENDING', 'PARTIALLY_PAID', 'OVERDUE']),
        listQuotations({ sortBy: 'created_at', ascending: false, pageSize: 5 }),
        listInvoices({ sortBy: 'created_at', ascending: false, pageSize: 5 }),
        listPayments({ sortBy: 'created_at', ascending: false, pageSize: 5 }),
        listInvoices({ status: 'OVERDUE', sortBy: 'due_date', ascending: true, pageSize: 5 }),
        getInventoryOverview(),
      ]);

      const lowStock = inventoryOverview.filter((row) => row.isLowStock);

      setFinancial({
        totalSales: summary.totalSales,
        paymentsReceived: summary.totalCollected,
        outstanding: summary.outstanding,
        overdue: summary.overdue,
        expenses: summary.expenses,
        netRevenue: summary.netRevenue,
      });

      setBusiness({
        openQuotations: openQuotationsCount,
        acceptedQuotations: acceptedQuotationsCount,
        pendingInvoices: pendingInvoicesCount,
        lowStock: lowStock.length,
      });

      setRecentQuotations(
        quotationsRes.data.map((q) => ({
          id: q.id,
          quoteNumber: q.quotation_number,
          client: q.client?.company_name || '\u2014',
          amount: Number(q.total),
          status: q.status,
          date: q.quotation_date,
        }))
      );

      setRecentInvoices(
        invoicesRes.data.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          client: inv.client?.company_name || '\u2014',
          amount: Number(inv.total),
          status: inv.status,
          dueDate: inv.due_date,
        }))
      );

      setRecentPayments(
        paymentsRes.data.map((p) => ({
          id: p.id,
          client: p.invoice?.client?.company_name || '\u2014',
          invoiceNumber: p.invoice?.invoice_number || '\u2014',
          amount: Number(p.amount),
          method: p.payment_method,
          date: p.payment_date,
        }))
      );

      setLowStockItems(
        lowStock.slice(0, 5).map((row) => ({
          id: row.product.id,
          name: row.product.name,
          sku: row.product.sku,
          stockLeft: row.quantity,
          reorderLevel: row.minimumStock,
          unit: row.product.unit || 'pcs',
        }))
      );

      setOutstandingItems(
        unpaidInvoicesForOutstanding.data.map((inv) => ({
          id: inv.id,
          client: inv.client?.company_name || '\u2014',
          invoiceNumber: inv.invoice_number,
          amount: Number(inv.total),
          daysOverdue: Math.max(0, daysOverdue(inv.due_date)),
        }))
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Overview of ${company?.company_name || 'your company'} business activity this month.`}
      />

      {error && (
        <>
          <Alert tone="danger" title="Couldn't load the dashboard">
            {error}
          </Alert>
          <div className="dashboard-retry">
            <Button variant="outline" icon={RotateCcw} onClick={fetchAll}>
              Try again
            </Button>
          </div>
        </>
      )}

      {!error && loading && <Spinner size="lg" label="Loading dashboard…" />}

      {!error && !loading && (
        <>
          <section className="dashboard-section">
            <div className="dashboard-section__heading">
              <p className="eyebrow">Financial overview</p>
            </div>
            <FinancialOverview data={financial} />
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section__heading">
              <p className="eyebrow">Business overview</p>
            </div>
            <BusinessOverview data={business} />
          </section>

          <section className="dashboard-section">
            <div className="dashboard-two-col">
              <RecentQuotationsTable quotations={recentQuotations} />
              <LowStockSection items={lowStockItems} />
            </div>
          </section>

          <section className="dashboard-section">
            <div className="dashboard-two-col">
              <RecentInvoicesTable invoices={recentInvoices} />
              <OutstandingPaymentsSection items={outstandingItems} />
            </div>
          </section>

          <section className="dashboard-section">
            <RecentPaymentsTable payments={recentPayments} />
          </section>
        </>
      )}
    </>
  );
}

export default Dashboard;
