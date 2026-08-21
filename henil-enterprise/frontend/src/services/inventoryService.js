import { supabase } from './supabaseClient.js';

export const ADD_TRANSACTION_TYPES = [
  { value: 'PURCHASE', label: 'Purchase (received new stock)' },
  { value: 'RETURN', label: 'Return (unused material returned to stock)' },
];

export const REMOVE_TRANSACTION_TYPES = [
  { value: 'USAGE', label: 'Usage (consumed in production)' },
  { value: 'DAMAGE', label: 'Damage (written off)' },
];

/*
  Inventory service layer.

  IMPORTANT: this file never writes to public.inventory directly.
  Every quantity change goes through the record_inventory_transaction
  RPC (see database/migrations/20260815100500_inventory_transaction_types_and_rpc.sql),
  which is the only place stock is actually changed — atomically, and
  it rejects anything that would take stock negative. "Never silently
  overwrite inventory" means there is no code path here that can SET
  a quantity; only recordInventoryTransaction(), which always applies
  a delta backed by a permanent ledger row.
*/

/**
 * @param {{product_id:string, transaction_type:string, quantity:number, reference?:string, notes?:string}} params
 *   `quantity` is a signed delta for ADJUSTMENT, a positive magnitude for every other type.
 */
export async function recordInventoryTransaction({ product_id, transaction_type, quantity, reference, notes }) {
  const { data, error } = await supabase.rpc('record_inventory_transaction', {
    p_product_id: product_id,
    p_transaction_type: transaction_type,
    p_quantity: Number(quantity),
    p_reference: reference || null,
    p_notes: notes || null,
  });
  if (error) throw error;
  return data;
}

/**
 * One row per active product, merged with its inventory row if one
 * exists yet (a product with no inventory row is "not tracked" —
 * shown with quantity 0 and a prompt to set opening stock). Fetches
 * all active products rather than paging server-side, since
 * low-stock filtering has to happen after the join; fine at this
 * project's scale (see the equivalent tradeoff noted in
 * financeService.js).
 */
export async function getInventoryOverview() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, sku, category, unit, default_rate')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw error;

  const ids = products.map((p) => p.id);
  let inventoryRows = [];
  if (ids.length > 0) {
    const { data, error: invError } = await supabase.from('inventory').select('*').in('product_id', ids);
    if (invError) throw invError;
    inventoryRows = data ?? [];
  }
  const invByProduct = new Map(inventoryRows.map((r) => [r.product_id, r]));

  return products.map((p) => {
    const inv = invByProduct.get(p.id);
    const quantity = inv ? Number(inv.quantity) : 0;
    const minimumStock = inv ? Number(inv.minimum_stock) : 0;
    return {
      product: p,
      inventoryId: inv?.id ?? null,
      quantity,
      minimumStock,
      tracked: Boolean(inv),
      isLowStock: Boolean(inv) && quantity <= minimumStock,
      updatedAt: inv?.updated_at ?? null,
    };
  });
}

export async function updateMinimumStock(productId, minimumStock) {
  const { data: existing, error: fetchError } = await supabase
    .from('inventory')
    .select('id')
    .eq('product_id', productId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (existing) {
    const { error } = await supabase.from('inventory').update({ minimum_stock: minimumStock }).eq('product_id', productId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('inventory').insert({ product_id: productId, quantity: 0, minimum_stock: minimumStock });
    if (error) throw error;
  }
}

export async function listInventoryTransactions({
  search = '',
  productId = '',
  transactionType = '',
  from = '',
  to = '',
  sortBy = 'created_at',
  ascending = false,
  page = 1,
  pageSize = 10,
} = {}) {
  let query = supabase
    .from('inventory_transactions')
    .select('*, product:products(id, name, sku)', { count: 'exact' });

  if (productId) query = query.eq('product_id', productId);
  if (transactionType) query = query.eq('transaction_type', transactionType);
  if (from) query = query.gte('created_at', `${from}T00:00:00`);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);

  const term = search.trim();
  if (term) {
    const pattern = `%${term}%`;
    const { data: matchingProducts } = await supabase.from('products').select('id').ilike('name', pattern);
    const productIds = (matchingProducts ?? []).map((p) => p.id);
    const orParts = [`reference.ilike.${pattern}`, `notes.ilike.${pattern}`];
    if (productIds.length > 0) orParts.push(`product_id.in.(${productIds.join(',')})`);
    query = query.or(orParts.join(','));
  }

  query = query.order(sortBy, { ascending });
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  query = query.range(fromIdx, toIdx);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}
