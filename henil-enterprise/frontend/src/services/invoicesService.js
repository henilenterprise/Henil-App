import { supabase } from './supabaseClient.js';
import { computeInvoiceTotals, computeItemAmount } from '../utils/invoiceCalculations.js';
import { getTotalPaidForInvoice } from './paymentsService.js';
import { round2 } from '../utils/quotationCalculations.js';

const TABLE = 'invoices';
const ITEMS_TABLE = 'invoice_items';

/*
  Invoices service layer. Mirrors quotationsService.js closely —
  invoice_number is NEVER set here (a Postgres trigger generates it,
  see database/migrations/20260815100100_invoice_numbering.sql), and
  line items use the same "replace all" strategy on update.
*/

function toItemRow(invoiceId, item, index) {
  return {
    invoice_id: invoiceId,
    product_id: item.product_id || null,
    description: item.description,
    quantity: Number(item.quantity),
    unit: item.unit || 'pcs',
    rate: Number(item.rate),
    gst_percentage: item.gst_percentage === '' || item.gst_percentage === null ? 18 : Number(item.gst_percentage),
    amount: computeItemAmount(item.quantity, item.rate),
    sort_order: index,
  };
}

export async function listInvoices({
  search = '',
  status = '',
  sortBy = 'invoice_date',
  ascending = false,
  page = 1,
  pageSize = 10,
} = {}) {
  let query = supabase.from(TABLE).select('*, client:clients(id, company_name)', { count: 'exact' });

  const term = search.trim();
  if (term) {
    const pattern = `%${term}%`;
    const orParts = [`invoice_number.ilike.${pattern}`];
    const { data: matchingClients } = await supabase.from('clients').select('id').ilike('company_name', pattern);
    const clientIds = (matchingClients ?? []).map((c) => c.id);
    if (clientIds.length > 0) {
      orParts.push(`client_id.in.(${clientIds.join(',')})`);
    }
    query = query.or(orParts.join(','));
  }

  if (status) {
    query = query.eq('status', status);
  }

  query = query.order(sortBy, { ascending });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function getInvoiceWithItems(id) {
  const { data: invoice, error } = await supabase
    .from(TABLE)
    .select(
      '*, client:clients(id, company_name, email, phone, address, city, state, gst_number), quotation:quotations(id, quotation_number)'
    )
    .eq('id', id)
    .single();
  if (error) throw error;

  const { data: items, error: itemsError } = await supabase
    .from(ITEMS_TABLE)
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true });
  if (itemsError) throw itemsError;

  const paid = await getTotalPaidForInvoice(id);
  const remaining = round2(Math.max(0, Number(invoice.total) - paid));

  return { ...invoice, items: items ?? [], paid, remaining };
}

export async function createInvoice(invoice, items) {
  const totals = computeInvoiceTotals(items, invoice.discount);

  const { data: created, error } = await supabase
    .from(TABLE)
    .insert({
      quotation_id: invoice.quotation_id || null,
      client_id: invoice.client_id,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      gst: totals.gst,
      total: totals.total,
      status: 'DRAFT',
      // invoice_number intentionally omitted — the DB trigger sets it.
    })
    .select()
    .single();
  if (error) throw error;

  if (items.length > 0) {
    const rows = items.map((item, index) => toItemRow(created.id, item, index));
    const { error: itemsError } = await supabase.from(ITEMS_TABLE).insert(rows);
    if (itemsError) throw itemsError;
  }

  return created;
}

export async function updateInvoice(id, invoice, items) {
  const totals = computeInvoiceTotals(items, invoice.discount);

  const { data: updated, error } = await supabase
    .from(TABLE)
    .update({
      client_id: invoice.client_id,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      gst: totals.gst,
      total: totals.total,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  const { error: deleteError } = await supabase.from(ITEMS_TABLE).delete().eq('invoice_id', id);
  if (deleteError) throw deleteError;

  if (items.length > 0) {
    const rows = items.map((item, index) => toItemRow(id, item, index));
    const { error: itemsError } = await supabase.from(ITEMS_TABLE).insert(rows);
    if (itemsError) throw itemsError;
  }

  return updated;
}

export async function updateInvoiceStatus(id, status) {
  const { data, error } = await supabase.from(TABLE).update({ status }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/** Cancelling is a status change, not a delete — invoices are never hard-deleted. */
export async function cancelInvoice(id) {
  return updateInvoiceStatus(id, 'CANCELLED');
}

/**
 * For the Payments module's "which invoice is this payment against?"
 * picker: excludes invoices that can never take a payment (CANCELLED)
 * or already can't (PAID). Doesn't exclude DRAFT — an advance payment
 * against a not-yet-sent invoice is unusual but not invalid.
 */
export async function listInvoicesForPaymentPicker() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, invoice_number, total, status, client:clients(company_name)')
    .not('status', 'in', '(CANCELLED,PAID)')
    .order('invoice_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
