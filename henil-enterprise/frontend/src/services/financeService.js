import { supabase } from './supabaseClient.js';
import { round2 } from '../utils/quotationCalculations.js';

/*
  Finance summary for the Finance page. See database/README.md and
  the definitions below for how each figure is computed — financial
  KPI naming varies by convention, so these choices are documented
  explicitly rather than left implicit.

  - Total Sales: sum(invoices.total) for invoices with invoice_date in
    the selected range, excluding CANCELLED.
  - Total Collected: sum(payments.amount) for payments with
    payment_date in the range.
  - Outstanding: for invoices with invoice_date in range and status
    not in (CANCELLED, PAID), sum(total - allTimePaidForThatInvoice).
    Uses ALL payments ever made against each invoice, not just ones
    in the range, since remaining balance doesn't care when it was
    paid down.
  - Overdue: the Outstanding subset where due_date is before today,
    computed dynamically from due_date + remaining balance rather
    than the stored status column (nothing sets OVERDUE automatically
    yet, so this is more reliable).
  - Paid / Pending / Partially Paid: sum(invoices.total) grouped by
    the invoice's current status, for invoices in range — the
    "Billing Dashboard" breakdown a business owner actually wants
    alongside the cash-basis figures above.
  - Expenses: sum(expenses.amount) for expenses with date in range.
  - Net Revenue: Total Collected - Expenses (cash-basis).

  clientId and status are optional filters — both apply to every
  invoice-derived figure (Total Sales, Outstanding, Overdue, the
  status breakdown); status intentionally does NOT filter Total
  Collected/Expenses, since payment/expense records don't have an
  invoice status of their own.

  N+1 note: Outstanding/Overdue fetch each candidate invoice's
  payments individually — fine at this scale; the first place to move
  to a DB view/RPC if the invoice count grows large.
*/

export async function getFinanceSummary({ from = '', to = '', clientId = '', status = '' } = {}) {
  let salesQuery = supabase.from('invoices').select('total, status').neq('status', 'CANCELLED');
  if (from) salesQuery = salesQuery.gte('invoice_date', from);
  if (to) salesQuery = salesQuery.lte('invoice_date', to);
  if (clientId) salesQuery = salesQuery.eq('client_id', clientId);
  if (status) salesQuery = salesQuery.eq('status', status);
  const { data: salesInvoices, error: salesError } = await salesQuery;
  if (salesError) throw salesError;
  const totalSales = round2((salesInvoices ?? []).reduce((s, inv) => s + Number(inv.total), 0));

  const statusBreakdown = { paid: 0, pending: 0, partiallyPaid: 0 };
  for (const inv of salesInvoices ?? []) {
    if (inv.status === 'PAID') statusBreakdown.paid += Number(inv.total);
    else if (inv.status === 'PENDING') statusBreakdown.pending += Number(inv.total);
    else if (inv.status === 'PARTIALLY_PAID') statusBreakdown.partiallyPaid += Number(inv.total);
  }
  statusBreakdown.paid = round2(statusBreakdown.paid);
  statusBreakdown.pending = round2(statusBreakdown.pending);
  statusBreakdown.partiallyPaid = round2(statusBreakdown.partiallyPaid);

  let paymentsQuery = supabase.from('payments').select('amount, invoice:invoices(client_id)');
  if (from) paymentsQuery = paymentsQuery.gte('payment_date', from);
  if (to) paymentsQuery = paymentsQuery.lte('payment_date', to);
  const { data: periodPayments, error: paymentsError } = await paymentsQuery;
  if (paymentsError) throw paymentsError;
  const filteredPayments = clientId ? (periodPayments ?? []).filter((p) => p.invoice?.client_id === clientId) : periodPayments ?? [];
  const totalCollected = round2(filteredPayments.reduce((s, p) => s + Number(p.amount), 0));

  let unpaidQuery = supabase.from('invoices').select('id, total, due_date').not('status', 'in', '(CANCELLED,PAID)');
  if (from) unpaidQuery = unpaidQuery.gte('invoice_date', from);
  if (to) unpaidQuery = unpaidQuery.lte('invoice_date', to);
  if (clientId) unpaidQuery = unpaidQuery.eq('client_id', clientId);
  if (status) unpaidQuery = unpaidQuery.eq('status', status);
  const { data: unpaidInvoices, error: unpaidError } = await unpaidQuery;
  if (unpaidError) throw unpaidError;

  const todayIso = new Date().toISOString().slice(0, 10);
  let outstanding = 0;
  let overdue = 0;
  for (const inv of unpaidInvoices ?? []) {
    const { data: pays, error: payErr } = await supabase.from('payments').select('amount').eq('invoice_id', inv.id);
    if (payErr) throw payErr;
    const paidForInvoice = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const remaining = Math.max(0, Number(inv.total) - paidForInvoice);
    outstanding += remaining;
    if (inv.due_date && inv.due_date < todayIso && remaining > 0) {
      overdue += remaining;
    }
  }
  outstanding = round2(outstanding);
  overdue = round2(overdue);

  let expensesQuery = supabase.from('expenses').select('amount');
  if (from) expensesQuery = expensesQuery.gte('date', from);
  if (to) expensesQuery = expensesQuery.lte('date', to);
  const { data: expenseRows, error: expensesError } = await expensesQuery;
  if (expensesError) throw expensesError;
  const expenses = round2((expenseRows ?? []).reduce((s, e) => s + Number(e.amount), 0));

  const netRevenue = round2(totalCollected - expenses);

  return { totalSales, totalCollected, outstanding, overdue, expenses, netRevenue, statusBreakdown };
}
