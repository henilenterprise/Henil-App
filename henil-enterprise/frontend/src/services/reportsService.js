import { supabase } from './supabaseClient.js';
import { round2 } from '../utils/quotationCalculations.js';

/*
  Reports service layer. Every function here queries real Supabase
  data — nothing is hardcoded or mocked. Each returns the same shape:

    { totals: [{label,value,isMoney}], breakdown: [{label,count,value}], rows: [...] }

  `rows` is the underlying record-level data (what CSV export writes
  out); `breakdown` is the grouped summary shown in the UI table;
  `totals` feeds the KPI cards.

  Filter applicability varies by report (a Payments report has no
  meaningful "product" filter, an Inventory report has no client
  filter, etc.) — see Reports.jsx for which filters are shown per
  report type. Every function accepts the full filter set and simply
  ignores fields that don't apply to it.
*/

async function getClientNameMap(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase.from('clients').select('id, company_name').in('id', ids);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((c) => [c.id, c.company_name]));
}

/** IDs of quotations/invoices whose line items reference a given product. */
async function getParentIdsForProduct(itemsTable, parentIdCol, productId) {
  if (!productId) return null; // null = "no product filter"
  const { data, error } = await supabase.from(itemsTable).select(parentIdCol).eq('product_id', productId);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r[parentIdCol]))];
}

function sumBy(rows, key) {
  return round2(rows.reduce((s, r) => s + Number(r[key] || 0), 0));
}

function groupCountValue(rows, keyFn, valueKey = 'total') {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const entry = map.get(key) || { count: 0, value: 0 };
    entry.count += 1;
    entry.value += Number(row[valueKey] || 0);
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([label, { count, value }]) => ({ label, count, value: round2(value) }))
    .sort((a, b) => b.value - a.value);
}

// ---------------- Sales ----------------

export async function getSalesReport({ from, to, clientId, productId } = {}) {
  const quotationIds = await getParentIdsForProduct('quotation_items', 'quotation_id', productId);
  const invoiceIds = await getParentIdsForProduct('invoice_items', 'invoice_id', productId);

  let qQuery = supabase.from('quotations').select('id, quotation_number, quotation_date, total, status, client_id');
  if (from) qQuery = qQuery.gte('quotation_date', from);
  if (to) qQuery = qQuery.lte('quotation_date', to);
  if (clientId) qQuery = qQuery.eq('client_id', clientId);
  if (quotationIds) qQuery = qQuery.in('id', quotationIds.length ? quotationIds : ['__none__']);
  const { data: quotations, error: qErr } = await qQuery;
  if (qErr) throw qErr;

  let iQuery = supabase.from('invoices').select('id, invoice_number, invoice_date, total, status, client_id').neq('status', 'CANCELLED');
  if (from) iQuery = iQuery.gte('invoice_date', from);
  if (to) iQuery = iQuery.lte('invoice_date', to);
  if (clientId) iQuery = iQuery.eq('client_id', clientId);
  if (invoiceIds) iQuery = iQuery.in('id', invoiceIds.length ? invoiceIds : ['__none__']);
  const { data: invoices, error: iErr } = await iQuery;
  if (iErr) throw iErr;

  const clientIds = [...new Set(invoices.map((i) => i.client_id))];
  const clientNames = await getClientNameMap(clientIds);

  const acceptedCount = quotations.filter((q) => q.status === 'ACCEPTED').length;
  const conversionRate = quotations.length > 0 ? round2((acceptedCount / quotations.length) * 100) : 0;

  const breakdown = groupCountValue(invoices, (r) => clientNames[r.client_id] || 'Unknown client');

  return {
    totals: [
      { label: 'Quotations Issued', value: quotations.length, isMoney: false },
      { label: 'Quotation Value', value: sumBy(quotations, 'total'), isMoney: true },
      { label: 'Invoices Issued', value: invoices.length, isMoney: false },
      { label: 'Invoice Value', value: sumBy(invoices, 'total'), isMoney: true },
      { label: 'Conversion Rate', value: `${conversionRate}%`, isMoney: false },
    ],
    breakdown,
    rows: invoices
      .map((i) => ({ ...i, client_name: clientNames[i.client_id] || 'Unknown' }))
      .sort((a, b) => (a.invoice_date < b.invoice_date ? 1 : -1)),
    rowColumns: [
      { key: 'invoice_number', label: 'Invoice #' },
      { key: 'client_name', label: 'Client' },
      { key: 'invoice_date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total' },
    ],
  };
}

// ---------------- Quotations ----------------

export async function getQuotationsReport({ from, to, clientId, productId, status } = {}) {
  const quotationIds = await getParentIdsForProduct('quotation_items', 'quotation_id', productId);

  let query = supabase.from('quotations').select('id, quotation_number, quotation_date, valid_until, total, status, client_id');
  if (from) query = query.gte('quotation_date', from);
  if (to) query = query.lte('quotation_date', to);
  if (clientId) query = query.eq('client_id', clientId);
  if (status) query = query.eq('status', status);
  if (quotationIds) query = query.in('id', quotationIds.length ? quotationIds : ['__none__']);
  const { data, error } = await query;
  if (error) throw error;

  const clientIds = [...new Set(data.map((r) => r.client_id))];
  const clientNames = await getClientNameMap(clientIds);

  return {
    totals: [
      { label: 'Count', value: data.length, isMoney: false },
      { label: 'Total Value', value: sumBy(data, 'total'), isMoney: true },
      { label: 'Accepted', value: data.filter((r) => r.status === 'ACCEPTED').length, isMoney: false },
      { label: 'Rejected', value: data.filter((r) => r.status === 'REJECTED').length, isMoney: false },
    ],
    breakdown: groupCountValue(data, (r) => r.status),
    rows: data
      .map((r) => ({ ...r, client_name: clientNames[r.client_id] || 'Unknown' }))
      .sort((a, b) => (a.quotation_date < b.quotation_date ? 1 : -1)),
    rowColumns: [
      { key: 'quotation_number', label: 'Quotation #' },
      { key: 'client_name', label: 'Client' },
      { key: 'quotation_date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total' },
    ],
  };
}

// ---------------- Invoices ----------------

export async function getInvoicesReport({ from, to, clientId, productId, status } = {}) {
  const invoiceIds = await getParentIdsForProduct('invoice_items', 'invoice_id', productId);

  let query = supabase.from('invoices').select('id, invoice_number, invoice_date, due_date, total, status, client_id');
  if (from) query = query.gte('invoice_date', from);
  if (to) query = query.lte('invoice_date', to);
  if (clientId) query = query.eq('client_id', clientId);
  if (status) query = query.eq('status', status);
  if (invoiceIds) query = query.in('id', invoiceIds.length ? invoiceIds : ['__none__']);
  const { data, error } = await query;
  if (error) throw error;

  const clientIds = [...new Set(data.map((r) => r.client_id))];
  const clientNames = await getClientNameMap(clientIds);

  return {
    totals: [
      { label: 'Count', value: data.length, isMoney: false },
      { label: 'Total Value', value: sumBy(data, 'total'), isMoney: true },
      { label: 'Paid Invoices', value: data.filter((r) => r.status === 'PAID').length, isMoney: false },
      { label: 'Cancelled', value: data.filter((r) => r.status === 'CANCELLED').length, isMoney: false },
    ],
    breakdown: groupCountValue(data, (r) => r.status),
    rows: data
      .map((r) => ({ ...r, client_name: clientNames[r.client_id] || 'Unknown' }))
      .sort((a, b) => (a.invoice_date < b.invoice_date ? 1 : -1)),
    rowColumns: [
      { key: 'invoice_number', label: 'Invoice #' },
      { key: 'client_name', label: 'Client' },
      { key: 'invoice_date', label: 'Date' },
      { key: 'due_date', label: 'Due Date' },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total' },
    ],
  };
}

// ---------------- Payments ----------------
// The `status` filter slot is reused as "payment method" for this report.

export async function getPaymentsReport({ from, to, clientId, status: method } = {}) {
  let query = supabase.from('payments').select('id, payment_date, amount, payment_method, reference_number, invoice_id, invoice:invoices(invoice_number, client_id)');
  if (from) query = query.gte('payment_date', from);
  if (to) query = query.lte('payment_date', to);
  if (method) query = query.eq('payment_method', method);
  const { data, error } = await query;
  if (error) throw error;

  let filtered = data ?? [];
  if (clientId) {
    filtered = filtered.filter((r) => r.invoice?.client_id === clientId);
  }

  const clientIds = [...new Set(filtered.map((r) => r.invoice?.client_id).filter(Boolean))];
  const clientNames = await getClientNameMap(clientIds);

  return {
    totals: [
      { label: 'Count', value: filtered.length, isMoney: false },
      { label: 'Total Collected', value: sumBy(filtered, 'amount'), isMoney: true },
    ],
    breakdown: groupCountValue(filtered, (r) => r.payment_method, 'amount'),
    rows: filtered
      .map((r) => ({
        ...r,
        invoice_number: r.invoice?.invoice_number || '\u2014',
        client_name: clientNames[r.invoice?.client_id] || 'Unknown',
      }))
      .sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1)),
    rowColumns: [
      { key: 'payment_date', label: 'Date' },
      { key: 'invoice_number', label: 'Invoice #' },
      { key: 'client_name', label: 'Client' },
      { key: 'amount', label: 'Amount' },
      { key: 'payment_method', label: 'Method' },
      { key: 'reference_number', label: 'Reference' },
    ],
  };
}

// ---------------- Outstanding / Overdue ----------------
// Shared implementation; `overdueOnly` narrows to due_date < today.

async function getUnpaidInvoicesReport({ from, to, clientId, status, overdueOnly }) {
  let query = supabase.from('invoices').select('id, invoice_number, invoice_date, due_date, total, status, client_id').not('status', 'in', '(CANCELLED,PAID)');
  if (from) query = query.gte('invoice_date', from);
  if (to) query = query.lte('invoice_date', to);
  if (clientId) query = query.eq('client_id', clientId);
  if (status) query = query.eq('status', status);
  const { data: invoices, error } = await query;
  if (error) throw error;

  const todayIso = new Date().toISOString().slice(0, 10);
  const withRemaining = [];
  for (const inv of invoices ?? []) {
    const { data: pays, error: payErr } = await supabase.from('payments').select('amount').eq('invoice_id', inv.id);
    if (payErr) throw payErr;
    const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const remaining = round2(Math.max(0, Number(inv.total) - paid));
    const isOverdue = Boolean(inv.due_date && inv.due_date < todayIso && remaining > 0);
    if (remaining <= 0) continue;
    if (overdueOnly && !isOverdue) continue;
    withRemaining.push({ ...inv, paid: round2(paid), remaining, is_overdue: isOverdue });
  }

  const clientIds = [...new Set(withRemaining.map((r) => r.client_id))];
  const clientNames = await getClientNameMap(clientIds);

  return {
    totals: [
      { label: 'Count', value: withRemaining.length, isMoney: false },
      { label: 'Total Outstanding', value: sumBy(withRemaining, 'remaining'), isMoney: true },
      { label: 'Overdue Count', value: withRemaining.filter((r) => r.is_overdue).length, isMoney: false },
    ],
    breakdown: groupCountValue(withRemaining, (r) => clientNames[r.client_id] || 'Unknown client', 'remaining'),
    rows: withRemaining
      .map((r) => ({ ...r, client_name: clientNames[r.client_id] || 'Unknown' }))
      .sort((a, b) => b.remaining - a.remaining),
    rowColumns: [
      { key: 'invoice_number', label: 'Invoice #' },
      { key: 'client_name', label: 'Client' },
      { key: 'due_date', label: 'Due Date' },
      { key: 'total', label: 'Total' },
      { key: 'paid', label: 'Paid' },
      { key: 'remaining', label: 'Remaining' },
    ],
  };
}

export async function getOutstandingReport(filters = {}) {
  return getUnpaidInvoicesReport({ ...filters, overdueOnly: false });
}

export async function getOverdueReport(filters = {}) {
  return getUnpaidInvoicesReport({ ...filters, overdueOnly: true });
}

// ---------------- Expenses ----------------
// The `productId` filter slot is reused as "category" for this report.

export async function getExpensesReport({ from, to, productId: category } = {}) {
  let query = supabase.from('expenses').select('id, date, category, description, vendor, amount, payment_method');
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw error;

  return {
    totals: [
      { label: 'Count', value: data.length, isMoney: false },
      { label: 'Total Expenses', value: sumBy(data, 'amount'), isMoney: true },
    ],
    breakdown: groupCountValue(data, (r) => r.category, 'amount'),
    rows: [...data].sort((a, b) => (a.date < b.date ? 1 : -1)),
    rowColumns: [
      { key: 'date', label: 'Date' },
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' },
      { key: 'vendor', label: 'Vendor' },
      { key: 'amount', label: 'Amount' },
      { key: 'payment_method', label: 'Method' },
    ],
  };
}

// ---------------- Inventory ----------------
// The `productId` filter slot is reused as "category". `from`/`to`
// scope the transaction-activity portion only (current stock is
// always a live snapshot, not a historical one).

export async function getInventoryReport({ from, to, productId: category } = {}) {
  let productQuery = supabase.from('products').select('id, name, sku, category, unit, default_rate').eq('is_active', true);
  if (category) productQuery = productQuery.eq('category', category);
  const { data: products, error: prodErr } = await productQuery;
  if (prodErr) throw prodErr;

  const ids = products.map((p) => p.id);
  let inventoryRows = [];
  if (ids.length > 0) {
    const { data, error } = await supabase.from('inventory').select('*').in('product_id', ids);
    if (error) throw error;
    inventoryRows = data ?? [];
  }
  const invByProduct = new Map(inventoryRows.map((r) => [r.product_id, r]));

  const stockRows = products.map((p) => {
    const inv = invByProduct.get(p.id);
    const quantity = inv ? Number(inv.quantity) : 0;
    const minimumStock = inv ? Number(inv.minimum_stock) : 0;
    return {
      product_id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category || '\u2014',
      quantity,
      unit: p.unit,
      minimum_stock: minimumStock,
      stock_value: round2(quantity * Number(p.default_rate || 0)),
      is_low_stock: Boolean(inv) && quantity <= minimumStock,
      is_tracked: Boolean(inv),
    };
  });

  // Transaction activity within the date range (if any range given).
  let txQuery = supabase.from('inventory_transactions').select('transaction_type, quantity, product_id').in('product_id', ids.length ? ids : ['__none__']);
  if (from) txQuery = txQuery.gte('created_at', `${from}T00:00:00`);
  if (to) txQuery = txQuery.lte('created_at', `${to}T23:59:59`);
  const { data: transactions, error: txErr } = await txQuery;
  if (txErr) throw txErr;

  const totalStockValue = sumBy(stockRows, 'stock_value');
  const lowStockCount = stockRows.filter((r) => r.is_low_stock).length;
  const trackedCount = stockRows.filter((r) => r.is_tracked).length;

  return {
    totals: [
      { label: 'Active Products', value: stockRows.length, isMoney: false },
      { label: 'Tracked Products', value: trackedCount, isMoney: false },
      { label: 'Low Stock Items', value: lowStockCount, isMoney: false },
      { label: 'Total Stock Value', value: totalStockValue, isMoney: true },
      { label: 'Transactions in Range', value: (transactions ?? []).length, isMoney: false },
    ],
    breakdown: groupCountValue(transactions ?? [], (r) => r.transaction_type, 'quantity'),
    rows: stockRows.sort((a, b) => a.name.localeCompare(b.name)),
    rowColumns: [
      { key: 'name', label: 'Product' },
      { key: 'sku', label: 'SKU' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Stock' },
      { key: 'unit', label: 'Unit' },
      { key: 'minimum_stock', label: 'Reorder At' },
      { key: 'stock_value', label: 'Stock Value' },
    ],
  };
}
