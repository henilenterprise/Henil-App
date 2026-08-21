import { supabase } from './supabaseClient.js';

const TABLE = 'suppliers';

/*
  Suppliers service layer.
  Every function here maps directly to the `suppliers` table defined
  in database/migrations/20260815091000_suppliers.sql — same shape as
  clients (company_name, contact_person, phone, email, gst_number,
  address, city, state, pincode, notes), but with no downstream
  relationships anywhere else in the schema (no other table has a
  supplier_id foreign key), so unlike Clients there is no detail page
  showing related quotations/invoices — just a straightforward list.

  Row Level Security applies automatically based on the signed-in
  user's role. 'suppliers' is not in any non-admin role's module list
  (see database/migrations/20260815100700_role_based_access_control.sql),
  so only an admin can read or write this table; every other role
  gets a permission error, which callers should surface via the UI's
  error handling.
*/

/**
 * @param {object} options
 * @param {string} [options.search] - matched against company_name, contact_person, email, phone, gst_number
 * @param {string} [options.state] - exact match filter
 * @param {string} [options.sortBy] - column to sort by
 * @param {boolean} [options.ascending]
 * @param {number} [options.page] - 1-based
 * @param {number} [options.pageSize]
 */
export async function listSuppliers({
  search = '',
  state = '',
  sortBy = 'company_name',
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
        `company_name.ilike.${pattern}`,
        `contact_person.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
        `gst_number.ilike.${pattern}`,
      ].join(',')
    );
  }

  if (state) {
    query = query.eq('state', state);
  }

  query = query.order(sortBy, { ascending });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function createSupplier(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSupplier(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/** Distinct list of states currently in use, for the filter dropdown. */
export async function listSupplierStates() {
  const { data, error } = await supabase.from(TABLE).select('state').not('state', 'is', null);
  if (error) throw error;
  return Array.from(new Set(data.map((r) => r.state).filter(Boolean))).sort();
}
