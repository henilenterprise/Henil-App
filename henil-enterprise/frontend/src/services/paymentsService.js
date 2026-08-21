import { supabase } from './supabaseClient.js';
import { round2 } from '../utils/quotationCalculations.js';
import { formatCurrency } from '../utils/formatCurrency.js';

const TABLE = 'payments';

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other'];

/*
  Payments service layer.

  Status auto-update: whenever a payment is created or removed,
  syncInvoiceStatus() recomputes the invoice's paid total and sets
  its status accordingly (see comment on that function below). This
  is what makes "payment status must automatically update" true —
  callers never set invoice status directly after a payment changes.

  Overpayment prevention: enforced in three independent layers —
  1. This file checks amount against the live remaining balance
     before even attempting the insert (fast, friendly error).
  2. A Postgres trigger (see
     database/migrations/20260815100300_prevent_payment_overpayment.sql)
     re-checks at the database level, which is what actually protects
     against a race condition between two concurrent payments.
  3. The UI (RecordPaymentModal) also blocks submission client-side.
*/

export async function getTotalPaidForInvoice(invoiceId) {
  const { data, error } = await supabase.from(TABLE).select('amount').eq('invoice_id', invoiceId);
  if (error) throw error;
  return round2((data ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0));
}

async function getInvoiceForPaymentCheck(invoiceId) {
  const { data, error } = await supabase.from('invoices').select('id, total, status').eq('id', invoiceId).single();
  if (error) throw error;
  return data;
}

/*
  Recomputes status from paid vs total:
    paid >= total (total > 0)  -> PAID
    0 < paid < total           -> PARTIALLY_PAID
    paid <= 0                  -> if status was PAID/PARTIALLY_PAID
                                   (i.e. driven by payments that no
                                   longer exist), revert to PENDING;
                                   otherwise leave DRAFT/SENT/etc alone.
*/
async function syncInvoiceStatus(invoiceId) {
  const invoice = await getInvoiceForPaymentCheck(invoiceId);
  const paid = await getTotalPaidForInvoice(invoiceId);
  const total = Number(invoice.total);

  let nextStatus = null;
  if (total > 0 && paid >= total) {
    nextStatus = 'PAID';
  } else if (paid > 0) {
    nextStatus = 'PARTIALLY_PAID';
  } else if (invoice.status === 'PAID' || invoice.status === 'PARTIALLY_PAID') {
    nextStatus = 'PENDING';
  }

  if (nextStatus && nextStatus !== invoice.status) {
    const { error } = await supabase.from('invoices').update({ status: nextStatus }).eq('id', invoiceId);
    if (error) throw error;
  }
  return nextStatus || invoice.status;
}

export async function listPayments({
  search = '',
  method = '',
  sortBy = 'payment_date',
  ascending = false,
  page = 1,
  pageSize = 10,
} = {}) {
  let query = supabase
    .from(TABLE)
    .select('*, invoice:invoices(id, invoice_number, client:clients(company_name))', { count: 'exact' });

  const term = search.trim();
  if (term) {
    const pattern = `%${term}%`;
    const { data: matchingInvoices } = await supabase.from('invoices').select('id').ilike('invoice_number', pattern);
    const invoiceIds = (matchingInvoices ?? []).map((i) => i.id);
    const orParts = [`reference_number.ilike.${pattern}`];
    if (invoiceIds.length > 0) orParts.push(`invoice_id.in.(${invoiceIds.join(',')})`);
    query = query.or(orParts.join(','));
  }

  if (method) {
    query = query.eq('payment_method', method);
  }

  query = query.order(sortBy, { ascending });
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function createPayment(payload) {
  const invoice = await getInvoiceForPaymentCheck(payload.invoice_id);
  if (invoice.status === 'CANCELLED') {
    throw new Error('Cannot record a payment against a cancelled invoice.');
  }

  const alreadyPaid = await getTotalPaidForInvoice(payload.invoice_id);
  const remaining = round2(Math.max(0, Number(invoice.total) - alreadyPaid));
  const amount = round2(Number(payload.amount));

  if (!amount || amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (amount > remaining) {
    throw new Error(
      `Payment of ${formatCurrency(amount)} exceeds the outstanding balance of ${formatCurrency(remaining)} for this invoice.`
    );
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      invoice_id: payload.invoice_id,
      amount,
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      reference_number: payload.reference_number || null,
      notes: payload.notes || null,
    })
    .select()
    .single();
  if (error) throw error;

  await syncInvoiceStatus(payload.invoice_id);
  return data;
}

export async function deletePayment(id, invoiceId) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
  await syncInvoiceStatus(invoiceId);
}
