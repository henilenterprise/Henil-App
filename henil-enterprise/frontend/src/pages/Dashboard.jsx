import PageHeader from '../components/layout/PageHeader.jsx';
import FinancialOverview from '../components/dashboard/FinancialOverview.jsx';
import BusinessOverview from '../components/dashboard/BusinessOverview.jsx';
import RecentQuotationsTable from '../components/dashboard/RecentQuotationsTable.jsx';
import RecentInvoicesTable from '../components/dashboard/RecentInvoicesTable.jsx';
import RecentPaymentsTable from '../components/dashboard/RecentPaymentsTable.jsx';
import LowStockSection from '../components/dashboard/LowStockSection.jsx';
import OutstandingPaymentsSection from '../components/dashboard/OutstandingPaymentsSection.jsx';
import {
  financialOverviewMock,
  businessOverviewMock,
  recentQuotationsMock,
  recentInvoicesMock,
  recentPaymentsMock,
  lowStockItemsMock,
  outstandingPaymentsMock,
} from '../mock/dashboardMockData.js';
import './Dashboard.css';
import { useCompany } from '../hooks/useCompany.js';

/*
  Dashboard UI phase — all data below comes from src/mock/dashboardMockData.js.
  No database is connected yet. When Supabase is wired up, replace the
  mock imports above with real data-fetching calls; the section
  components themselves expect the same data shape and do not need
  to change.
*/
function Dashboard() {
  const { company } = useCompany();
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Overview of ${company?.company_name || 'Henil Enterprise'} business activity.`}
      />

      <section className="dashboard-section">
        <div className="dashboard-section__heading">
          <p className="eyebrow">Financial overview</p>
        </div>
        <FinancialOverview data={financialOverviewMock} />
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__heading">
          <p className="eyebrow">Business overview</p>
        </div>
        <BusinessOverview data={businessOverviewMock} />
      </section>

      <section className="dashboard-section">
        <div className="dashboard-two-col">
          <RecentQuotationsTable quotations={recentQuotationsMock} />
          <LowStockSection items={lowStockItemsMock} />
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-two-col">
          <RecentInvoicesTable invoices={recentInvoicesMock} />
          <OutstandingPaymentsSection items={outstandingPaymentsMock} />
        </div>
      </section>

      <section className="dashboard-section">
        <RecentPaymentsTable payments={recentPaymentsMock} />
      </section>
    </>
  );
}

export default Dashboard;
