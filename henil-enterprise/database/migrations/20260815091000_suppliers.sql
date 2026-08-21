-- ============================================================
-- Henil Enterprise — Database Schema
-- 11. suppliers
-- ============================================================
-- No column list was specified in the brief for this table; it
-- mirrors `clients` since suppliers are the same kind of business
-- entity (a company with contact/GST/address details), just on the
-- purchasing side instead of the sales side.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text,
  phone text,
  email text,
  gst_number text,
  address text,
  city text,
  state text,
  pincode text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_suppliers_email_format
    check (email is null or email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  constraint chk_suppliers_gst_format
    check (gst_number is null or gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  constraint chk_suppliers_pincode_format
    check (pincode is null or pincode ~ '^[0-9]{6}$')
);

create index if not exists idx_suppliers_company_name on public.suppliers (company_name);
create index if not exists idx_suppliers_gst_number on public.suppliers (gst_number);
create index if not exists idx_suppliers_city on public.suppliers (city);

comment on table public.suppliers is 'Raw material and component suppliers.';
