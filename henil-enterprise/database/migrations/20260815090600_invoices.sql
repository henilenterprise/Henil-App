-- ============================================================
-- Henil Enterprise — Database Schema
-- 07. invoices
-- ============================================================

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  quotation_id uuid references public.quotations (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete restrict,
  invoice_date date not null default current_date,
  due_date date,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  gst numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  status invoice_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_invoices_subtotal check (subtotal >= 0),
  constraint chk_invoices_discount check (discount >= 0),
  constraint chk_invoices_gst check (gst >= 0),
  constraint chk_invoices_total check (total >= 0),
  constraint chk_invoices_due_date check (due_date is null or due_date >= invoice_date)
);

create index if not exists idx_invoices_client_id on public.invoices (client_id);
create index if not exists idx_invoices_quotation_id on public.invoices (quotation_id);
create index if not exists idx_invoices_status on public.invoices (status);
create index if not exists idx_invoices_due_date on public.invoices (due_date);

comment on table public.invoices is 'Invoices issued to clients, optionally originating from a quotation. Line items live in invoice_items.';
comment on column public.invoices.status is
  'DRAFT/SENT/CANCELLED are workflow states; PENDING/PARTIALLY_PAID/PAID/OVERDUE double as the invoice''s payment status.';
