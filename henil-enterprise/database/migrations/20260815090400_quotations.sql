-- ============================================================
-- Henil Enterprise — Database Schema
-- 05. quotations
-- ============================================================

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique,
  client_id uuid not null references public.clients (id) on delete restrict,
  quotation_date date not null default current_date,
  valid_until date,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  gst numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  status quotation_status not null default 'DRAFT',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_quotations_subtotal check (subtotal >= 0),
  constraint chk_quotations_discount check (discount >= 0),
  constraint chk_quotations_gst check (gst >= 0),
  constraint chk_quotations_total check (total >= 0),
  constraint chk_quotations_valid_until check (valid_until is null or valid_until >= quotation_date)
);

create index if not exists idx_quotations_client_id on public.quotations (client_id);
create index if not exists idx_quotations_status on public.quotations (status);
create index if not exists idx_quotations_quotation_date on public.quotations (quotation_date);

comment on table public.quotations is 'Quotations issued to clients. Line items live in quotation_items.';
comment on column public.quotations.total is 'subtotal - discount + gst, computed and stored by the application layer.';

-- A client with quotations cannot be deleted (on delete restrict above)
-- so historical quotations always keep a valid client reference.
