import { supabase } from './supabaseClient.js';

const TABLE = 'products';

/*
  Products service layer.
  Maps directly to the `products` table (see
  database/migrations/20260815090300_products.sql). This is also the
  service that a future Quotations module will import to populate its
  product picker — quotation_items stores a point-in-time snapshot
  (description, rate, gst_percentage) plus a product_id reference, so
  editing a product later never rewrites historical quotations, and
  quotations never duplicate the product catalog.
*/

export async function listProducts({
  search = '',
  category = '',
  status = 'all', // 'all' | 'active' | 'inactive'
  sortBy = 'name',
  ascending = true,
  page = 1,
  pageSize = 10,
} = {}) {
  let query = supabase.from(TABLE).select('*', { count: 'exact' });

  const term = search.trim();
  if (term) {
    const pattern = `%${term}%`;
    query = query.or(
      [
        `name.ilike.${pattern}`,
        `sku.ilike.${pattern}`,
        `category.ilike.${pattern}`,
        `material.ilike.${pattern}`,
      ].join(',')
    );
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (status === 'active') {
    query = query.eq('is_active', true);
  } else if (status === 'inactive') {
    query = query.eq('is_active', false);
  }

  query = query.order(sortBy, { ascending });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function createProduct(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function setProductActive(id, isActive) {
  return updateProduct(id, { is_active: isActive });
}

/** Distinct categories currently in use, for the filter dropdown. */
export async function listProductCategories() {
  const { data, error } = await supabase.from(TABLE).select('category').not('category', 'is', null);
  if (error) throw error;
  return Array.from(new Set(data.map((r) => r.category).filter(Boolean))).sort();
}

/**
 * For the future Quotations module's product picker: active products
 * only, minimal columns, alphabetical. Kept here now so that phase
 * can import it directly without touching this service again.
 */
export async function listActiveProductsForPicker() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, name, sku, unit, default_rate, gst_percentage')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
