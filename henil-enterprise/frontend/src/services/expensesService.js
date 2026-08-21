import { supabase } from './supabaseClient.js';
import { sanitizeFilename } from '../utils/sanitizeFilename.js';

const TABLE = 'expenses';
const BUCKET = 'attachments';

/*
  Expenses service layer.

  Attachments are handled as two coordinated pieces: the actual file
  goes to Supabase Storage (bucket "attachments" — see
  database/migrations/20260815100400_expense_attachments.sql), and its
  metadata is a row in public.files with expense_id set. Deleting an
  expense's attachment (or the expense itself) must remove both — the
  DB's ON DELETE CASCADE only removes the files row automatically,
  never the Storage object, so that side is handled here explicitly.
*/

export async function listExpenses({
  search = '',
  category = '',
  paymentMethod = '',
  from = '',
  to = '',
  sortBy = 'date',
  ascending = false,
  page = 1,
  pageSize = 10,
} = {}) {
  let query = supabase.from(TABLE).select('*', { count: 'exact' });

  const term = search.trim();
  if (term) {
    const pattern = `%${term}%`;
    query = query.or(
      [`description.ilike.${pattern}`, `vendor.ilike.${pattern}`, `category.ilike.${pattern}`].join(',')
    );
  }
  if (category) query = query.eq('category', category);
  if (paymentMethod) query = query.eq('payment_method', paymentMethod);
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  query = query.order(sortBy, { ascending });
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  query = query.range(fromIdx, toIdx);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function createExpense(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateExpense(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id) {
  const attachment = await getExpenseAttachment(id);
  if (attachment) {
    await supabase.storage.from(BUCKET).remove([attachment.file_path]).catch(() => {});
    // The public.files row cascades away automatically when the
    // expense row below is deleted (files.expense_id ON DELETE CASCADE).
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/** Distinct categories currently in use, for the filter dropdown. */
export async function listExpenseCategories() {
  const { data, error } = await supabase.from(TABLE).select('category').not('category', 'is', null);
  if (error) throw error;
  return Array.from(new Set(data.map((r) => r.category).filter(Boolean))).sort();
}

/**
 * For the expenses list's attachment-indicator icon: given a page of
 * expense ids, returns the subset that have a files row (one batched
 * query instead of one per row).
 */
export async function listExpenseIdsWithAttachment(expenseIds) {
  if (!expenseIds.length) return new Set();
  const { data, error } = await supabase.from('files').select('expense_id').in('expense_id', expenseIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.expense_id));
}

// ---------------- Attachments ----------------

export async function getExpenseAttachment(expenseId) {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const file = (data ?? [])[0];
  if (!file) return null;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(file.file_path);
  return { ...file, publicUrl: urlData?.publicUrl };
}

export async function uploadExpenseAttachment(expenseId, file) {
  const path = `expenses/${expenseId}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('files')
    .insert({
      expense_id: expenseId,
      file_name: file.name,
      file_path: path,
      file_type: file.type || null,
      file_size: file.size || null,
    })
    .select()
    .single();
  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ...data, publicUrl: urlData?.publicUrl };
}

export async function deleteExpenseAttachment(attachment) {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([attachment.file_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from('files').delete().eq('id', attachment.id);
  if (error) throw error;
}
