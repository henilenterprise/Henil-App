-- ============================================================
-- Henil Enterprise — Database Schema
-- 15. company_settings
-- ============================================================
-- Singleton table: exactly one row (id = 1), enforced below by the
-- primary key together with a check constraint pinning id to 1.
-- Insert the single row yourself when ready — no data is seeded by
-- this migration.

create table if not exists public.company_settings (
  id smallint primary key default 1,
  company_name text not null,
  logo text,
  address text,
  phone text,
  email text,
  gst_number text,
  website text,
  quotation_prefix text not null default 'QUO-',
  invoice_prefix text not null default 'INV-',
  default_gst numeric(5, 2) not null default 18,
  payment_terms text,
  quotation_terms text,
  invoice_terms text,
  bank_details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_company_settings_singleton check (id = 1),
  constraint chk_company_settings_default_gst check (default_gst >= 0 and default_gst <= 100)
);

comment on table public.company_settings is 'Single-row table of company profile and document defaults. Enforced as a singleton via chk_company_settings_singleton.';
comment on column public.company_settings.logo is 'Path/URL to the logo file in Supabase Storage.';
comment on column public.company_settings.bank_details is 'JSON object, e.g. {"bank_name": "...", "account_number": "...", "ifsc": "...", "branch": "..."}.';
