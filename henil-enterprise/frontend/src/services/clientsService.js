import { supabase } from './supabaseClient.js';

const TABLE = 'clients';

/*
  Clients service layer.
  Every function here maps directly to the `clients` table defined in
  database/migrations/20260815090200_clients.sql. Row Level Security
  applies automatically based on the signed-in user's role — in
  particular, deleting a client requires the 'manager' or 'admin'
  role (see database/migrations/20260815091600_row_level_security.sql);
  a 'staff' user will get a permission error from Supabase, which
  callers should surface via the UI's error handling.
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
export async function listClients({
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

export async function getClient(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createClient(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateClient(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteClient(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/** Distinct list of states currently in use, for the filter dropdown. */
export async function listClientStates() {
  const { data, error } = await supabase.from(TABLE).select('state').not('state', 'is', null);
  if (error) throw error;
  return Array.from(new Set(data.map((r) => r.state).filter(Boolean))).sort();
}
