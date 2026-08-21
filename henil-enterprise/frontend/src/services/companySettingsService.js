import { supabase } from './supabaseClient.js';
import { sanitizeFilename } from '../utils/sanitizeFilename.js';

const BUCKET = 'company-assets';

/*
  company_settings is a singleton table (id=1). This always returns a
  usable object — real row values merged over defaults.

  IMPORTANT: these defaults (especially quotation_prefix/invoice_prefix)
  intentionally match the DB trigger's own fallback (see
  set_quotation_number()/set_invoice_number() in
  database/migrations/20260815100800_company_settings_module.sql),
  NOT company_settings' column defaults ('QUO-'/'INV-' would be a
  DB-level default, but quotation numbers already being generated use
  'QT-' before any settings row exists). If these two fallbacks ever
  disagreed, the first time an admin saved *any* unrelated setting
  (e.g. just adding a phone number) would silently jump the running
  quotation prefix from QT- to QUO- for every quotation after that —
  a confusing bug for something that looks unrelated. Keeping them
  identical means saving Settings for the first time never changes
  numbering unless the admin actually edits the prefix field.
*/
const DEFAULT_COMPANY = {
  company_name: 'Henil Enterprise',
  logo: null,
  address: 'Ahmedabad, Gujarat, India',
  phone: null,
  email: null,
  gst_number: null,
  website: null,
  quotation_prefix: 'QT-',
  invoice_prefix: 'INV-',
  default_gst: 18,
  payment_terms: null,
  quotation_terms: null,
  invoice_terms: null,
  bank_details: null,
};

export async function getCompanySettings() {
  try {
    const { data, error } = await supabase.from('company_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data ? { ...DEFAULT_COMPANY, ...data } : { ...DEFAULT_COMPANY };
  } catch {
    return { ...DEFAULT_COMPANY };
  }
}

/**
 * Upsert — company_settings has exactly one row (id=1), which may or
 * may not exist yet depending on whether Settings has ever been saved.
 */
export async function updateCompanySettings(payload) {
  const { data, error } = await supabase
    .from('company_settings')
    .upsert({ ...payload, id: 1 }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadCompanyLogo(file) {
  const path = `logo-${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
