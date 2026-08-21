-- ============================================================
-- Henil Enterprise — Database Schema
-- 03. clients
-- ============================================================

create table if not exists public.clients (
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

  constraint chk_clients_email_format
    check (email is null or email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  constraint chk_clients_gst_format
    check (gst_number is null or gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  constraint chk_clients_pincode_format
    check (pincode is null or pincode ~ '^[0-9]{6}$')
);

create index if not exists idx_clients_company_name on public.clients (company_name);
create index if not exists idx_clients_gst_number on public.clients (gst_number);
create index if not exists idx_clients_city on public.clients (city);
create index if not exists idx_clients_state on public.clients (state);

comment on table public.clients is 'Client companies and their contact details.';
comment on column public.clients.gst_number is 'Indian GSTIN, 15 characters, validated by chk_clients_gst_format.';
