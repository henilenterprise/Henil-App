/* ============================================================
   MOCK DATA — DASHBOARD UI PHASE ONLY
   ============================================================
   Everything in this file is placeholder data used purely to build
   and preview the Dashboard UI before the database is connected.

   WHEN CONNECTING SUPABASE:
   - Delete this file (or stop importing from it).
   - Replace each export below with a real API/service call that
     returns data in the same shape, so the components in
     src/components/dashboard/ do not need to change.
   ============================================================ */

// ---- Financial overview (all amounts in INR) ----
export const financialOverviewMock = {
  totalSales: 1842500,
  paymentsReceived: 1420000,
  outstanding: 422500,
  overdue: 156000,
  expenses: 650000,
  netRevenue: 770000,
};

// ---- Business overview ----
export const businessOverviewMock = {
  openQuotations: 14,
  acceptedQuotations: 27,
  pendingInvoices: 9,
  lowStock: 5,
};

// ---- Recent quotations ----
// status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired'
export const recentQuotationsMock = [
  { id: 'q1', quoteNumber: 'Q-1042', client: 'Shree Fabricators', amount: 84500, status: 'Sent', date: '2026-08-12' },
  { id: 'q2', quoteNumber: 'Q-1041', client: 'Ambica Glass & Acrylic', amount: 132000, status: 'Accepted', date: '2026-08-11' },
  { id: 'q3', quoteNumber: 'Q-1040', client: 'Patel Signage Works', amount: 47800, status: 'Draft', date: '2026-08-10' },
  { id: 'q4', quoteNumber: 'Q-1039', client: 'Om Sai Interiors', amount: 61200, status: 'Rejected', date: '2026-08-08' },
  { id: 'q5', quoteNumber: 'Q-1038', client: 'Vraj Display Solutions', amount: 98750, status: 'Accepted', date: '2026-08-07' },
];

// ---- Recent invoices ----
// status: 'Paid' | 'Pending' | 'Overdue' | 'Partially Paid'
export const recentInvoicesMock = [
  { id: 'i1', invoiceNumber: 'INV-2031', client: 'Ambica Glass & Acrylic', amount: 132000, status: 'Paid', dueDate: '2026-08-05' },
  { id: 'i2', invoiceNumber: 'INV-2030', client: 'Krishna Enterprises', amount: 56400, status: 'Overdue', dueDate: '2026-07-29' },
  { id: 'i3', invoiceNumber: 'INV-2029', client: 'Balaji Acrylic Works', amount: 74300, status: 'Pending', dueDate: '2026-08-18' },
  { id: 'i4', invoiceNumber: 'INV-2028', client: 'Vraj Display Solutions', amount: 98750, status: 'Partially Paid', dueDate: '2026-08-14' },
  { id: 'i5', invoiceNumber: 'INV-2027', client: 'Shree Fabricators', amount: 41200, status: 'Paid', dueDate: '2026-07-30' },
];

// ---- Recent payments ----
// method: 'Bank Transfer' | 'UPI' | 'Cheque' | 'Cash'
export const recentPaymentsMock = [
  { id: 'p1', client: 'Ambica Glass & Acrylic', invoiceNumber: 'INV-2031', amount: 132000, method: 'Bank Transfer', date: '2026-08-13' },
  { id: 'p2', client: 'Shree Fabricators', invoiceNumber: 'INV-2027', amount: 41200, method: 'UPI', date: '2026-08-09' },
  { id: 'p3', client: 'Vraj Display Solutions', invoiceNumber: 'INV-2028', amount: 49375, method: 'Cheque', date: '2026-08-08' },
  { id: 'p4', client: 'Om Sai Interiors', invoiceNumber: 'INV-2019', amount: 28600, method: 'Bank Transfer', date: '2026-08-04' },
  { id: 'p5', client: 'Krishna Enterprises', invoiceNumber: 'INV-2015', amount: 33000, method: 'Cash', date: '2026-08-02' },
];

// ---- Low stock items ----
export const lowStockItemsMock = [
  { id: 's1', name: 'Acrylic Sheet — 6mm Clear', sku: 'HE-AC-6C-001', stockLeft: 12, reorderLevel: 40, unit: 'sheets' },
  { id: 's2', name: 'Polycarbonate — 4mm Frosted', sku: 'HE-PC-4F-014', stockLeft: 8, reorderLevel: 25, unit: 'sheets' },
  { id: 's3', name: 'Acrylic Rod — 10mm Clear', sku: 'HE-AR-10C-007', stockLeft: 22, reorderLevel: 30, unit: 'pcs' },
  { id: 's4', name: 'Double-Sided Tape — 12mm', sku: 'HE-CN-TP-002', stockLeft: 6, reorderLevel: 20, unit: 'rolls' },
  { id: 's5', name: 'Polycarbonate — 10mm Twin Wall', sku: 'HE-PC-10T-009', stockLeft: 18, reorderLevel: 25, unit: 'sheets' },
];

// ---- Outstanding payments ----
export const outstandingPaymentsMock = [
  { id: 'o1', client: 'Krishna Enterprises', invoiceNumber: 'INV-2030', amount: 56400, daysOverdue: 17 },
  { id: 'o2', client: 'Balaji Acrylic Works', invoiceNumber: 'INV-2029', amount: 74300, daysOverdue: 0 },
  { id: 'o3', client: 'Vraj Display Solutions', invoiceNumber: 'INV-2028', amount: 49375, daysOverdue: 0 },
  { id: 'o4', client: 'Patel Signage Works', invoiceNumber: 'INV-2022', amount: 38200, daysOverdue: 32 },
  { id: 'o5', client: 'Om Sai Interiors', invoiceNumber: 'INV-2019', amount: 12400, daysOverdue: 5 },
];
