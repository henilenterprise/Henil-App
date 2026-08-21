import { useEffect, useState } from 'react';
import { Download, RotateCcw, BarChart3 } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Table from '../components/ui/Table.jsx';
import Select from '../components/ui/Select.jsx';
import DatePicker from '../components/ui/DatePicker.jsx';
import Button from '../components/ui/Button.jsx';
import Alert from '../components/ui/Alert.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import KPICard from '../components/dashboard/KPICard.jsx';
import {
  getSalesReport,
  getQuotationsReport,
  getInvoicesReport,
  getPaymentsReport,
  getOutstandingReport,
  getOverdueReport,
  getExpensesReport,
  getInventoryReport,
} from '../services/reportsService.js';
import { listClients } from '../services/clientsService.js';
import { listActiveProductsForPicker, listProductCategories } from '../services/productsService.js';
import { listExpenseCategories } from '../services/expensesService.js';
import { PAYMENT_METHODS } from '../services/paymentsService.js';
import { exportToCsv } from '../utils/csvExport.js';
import { formatCurrency } from '../utils/formatCurrency.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './Reports.css';

const QUOTATION_STATUSES = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];

const REPORT_TYPES = [
  { value: 'sales', label: 'Sales', filters: ['dateRange', 'client', 'product'], fetch: getSalesReport },
  { value: 'quotations', label: 'Quotations', filters: ['dateRange', 'client', 'product', 'status'], statusOptions: QUOTATION_STATUSES, fetch: getQuotationsReport },
  { value: 'invoices', label: 'Invoices', filters: ['dateRange', 'client', 'product', 'status'], statusOptions: INVOICE_STATUSES, fetch: getInvoicesReport },
  { value: 'payments', label: 'Payments', filters: ['dateRange', 'client', 'method'], fetch: getPaymentsReport },
  { value: 'outstanding', label: 'Outstanding', filters: ['client', 'status'], statusOptions: INVOICE_STATUSES, fetch: getOutstandingReport },
  { value: 'overdue', label: 'Overdue', filters: ['client', 'status'], statusOptions: INVOICE_STATUSES, fetch: getOverdueReport },
  { value: 'expenses', label: 'Expenses', filters: ['dateRange', 'category'], fetch: getExpensesReport },
  { value: 'inventory', label: 'Inventory', filters: ['dateRange', 'category'], fetch: getInventoryReport },
];

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseIsoDate(v) {
  return v ? new Date(`${v}T00:00:00`) : null;
}

function formatCellValue(key, value) {
  if (value === null || value === undefined || value === '') return '\u2014';
  const moneyKeys = ['total', 'amount', 'remaining', 'paid', 'stock_value'];
  if (moneyKeys.includes(key)) return formatCurrency(value);
  return String(value);
}

function Reports() {
  const [reportType, setReportType] = useState('sales');
  const meta = REPORT_TYPES.find((r) => r.value === reportType);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientId, setClientId] = useState('');
  const [productOrCategory, setProductOrCategory] = useState('');
  const [statusOrMethod, setStatusOrMethod] = useState('');

  const [clientOptions, setClientOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    listClients({ pageSize: 500, sortBy: 'company_name', ascending: true })
      .then((res) => setClientOptions(res.data.map((c) => ({ value: c.id, label: c.company_name }))))
      .catch(() => setClientOptions([]));
    listActiveProductsForPicker()
      .then((data) => setProductOptions(data.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))))
      .catch(() => setProductOptions([]));
  }, []);

  useEffect(() => {
    if (reportType === 'expenses') {
      listExpenseCategories().then((cats) => setCategoryOptions(cats.map((c) => ({ value: c, label: c })))).catch(() => setCategoryOptions([]));
    } else if (reportType === 'inventory') {
      listProductCategories().then((cats) => setCategoryOptions(cats.map((c) => ({ value: c, label: c })))).catch(() => setCategoryOptions([]));
    }
  }, [reportType]);

  function resetFilters() {
    setDateFrom('');
    setDateTo('');
    setClientId('');
    setProductOrCategory('');
    setStatusOrMethod('');
  }

  function handleReportTypeChange(value) {
    setReportType(value);
    resetFilters();
    setReport(null);
    setHasRun(false);
  }

  async function runReport() {
    setLoading(true);
    setError(null);
    try {
      const filters = { from: dateFrom, to: dateTo, clientId, productId: productOrCategory, status: statusOrMethod };
      const data = await meta.fetch(filters);
      setReport(data);
      setHasRun(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!report) return;
    exportToCsv(report.rows, report.rowColumns, `${reportType}-report-${isoDate(new Date())}`);
  }

  const showFilter = (key) => meta.filters.includes(key);

  return (
    <>
      <PageHeader title="Reports" description="Real-time reporting across every part of the business." />

      <Card padding="none" className="reports-filter-card">
        <div className="reports-filter">
          <Select
            label="Report"
            value={reportType}
            onChange={(e) => handleReportTypeChange(e.target.value)}
            options={REPORT_TYPES.map((r) => ({ value: r.value, label: r.label }))}
          />

          {showFilter('dateRange') && (
            <>
              <DatePicker label="From" value={parseIsoDate(dateFrom)} onChange={(d) => setDateFrom(d ? isoDate(d) : '')} />
              <DatePicker label="To" value={parseIsoDate(dateTo)} onChange={(d) => setDateTo(d ? isoDate(d) : '')} />
            </>
          )}

          {showFilter('client') && (
            <Select
              label="Client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              options={[{ value: '', label: 'All clients' }, ...clientOptions]}
            />
          )}

          {showFilter('product') && (
            <Select
              label="Product"
              value={productOrCategory}
              onChange={(e) => setProductOrCategory(e.target.value)}
              options={[{ value: '', label: 'All products' }, ...productOptions]}
            />
          )}

          {showFilter('category') && (
            <Select
              label="Category"
              value={productOrCategory}
              onChange={(e) => setProductOrCategory(e.target.value)}
              options={[{ value: '', label: 'All categories' }, ...categoryOptions]}
            />
          )}

          {showFilter('status') && (
            <Select
              label="Status"
              value={statusOrMethod}
              onChange={(e) => setStatusOrMethod(e.target.value)}
              options={[{ value: '', label: 'All statuses' }, ...meta.statusOptions.map((s) => ({ value: s, label: s }))]}
            />
          )}

          {showFilter('method') && (
            <Select
              label="Payment Method"
              value={statusOrMethod}
              onChange={(e) => setStatusOrMethod(e.target.value)}
              options={[{ value: '', label: 'All methods' }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: m }))]}
            />
          )}

          <div className="reports-filter__actions">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear
            </Button>
            <Button onClick={runReport} loading={loading}>
              Generate Report
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card>
          <Alert tone="danger" title="Couldn't generate report">
            {error}
          </Alert>
          <div className="reports-retry">
            <Button variant="outline" icon={RotateCcw} onClick={runReport}>
              Try again
            </Button>
          </div>
        </Card>
      )}

      {!error && loading && (
        <Card>
          <Spinner size="lg" label="Generating report…" />
        </Card>
      )}

      {!error && !loading && !hasRun && (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="Choose filters and generate a report"
            description="Every figure is calculated live from your actual records."
          />
        </Card>
      )}

      {!error && !loading && hasRun && report && (
        <>
          <div className="reports-kpis">
            {report.totals.map((metric) => (
              <KPICard
                key={metric.label}
                label={metric.label}
                value={metric.isMoney ? formatCurrency(metric.value) : metric.value}
              />
            ))}
          </div>

          {report.breakdown.length > 0 && (
            <Card title="Breakdown" className="reports-section">
              <Table
                columns={[
                  { key: 'label', header: 'Group' },
                  { key: 'count', header: 'Count', align: 'right' },
                  { key: 'value', header: 'Value', align: 'right', render: (row) => formatCurrency(row.value) },
                ]}
                rows={report.breakdown.map((b, i) => ({ ...b, id: i }))}
              />
            </Card>
          )}

          <Card
            title="Detail"
            subtitle={`${report.rows.length} record${report.rows.length === 1 ? '' : 's'}`}
            actions={
              <Button size="sm" variant="outline" icon={Download} onClick={handleExport} disabled={report.rows.length === 0}>
                Export CSV
              </Button>
            }
          >
            {report.rows.length === 0 ? (
              <EmptyState icon={BarChart3} title="No records match these filters" />
            ) : (
              <div className="reports-detail-table">
                <Table
                  columns={report.rowColumns.map((c) => ({
                    key: c.key,
                    header: c.label,
                    render: (row) => formatCellValue(c.key, row[c.key]),
                  }))}
                  rows={report.rows.map((r, i) => ({ ...r, id: r.id || i }))}
                />
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

export default Reports;
