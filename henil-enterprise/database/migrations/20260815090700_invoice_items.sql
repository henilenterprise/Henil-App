-- ============================================================
-- Henil Enterprise — Database Schema
-- 08. invoice_items
-- ============================================================

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  description text not null,
  quantity numeric(12, 2) not null,
  unit text not null default 'pcs',
  rate numeric(12, 2) not null,
  gst_percentage numeric(5, 2) not null default 18,
  amount numeric(12, 2) not null,

  constraint chk_invoice_items_quantity check (quantity > 0),
  constraint chk_invoice_items_rate check (rate >= 0),
  constraint chk_invoice_items_gst_percentage check (gst_percentage >= 0 and gst_percentage <= 100),
  constraint chk_invoice_items_amount check (amount >= 0)
);

create index if not exists idx_invoice_items_invoice_id on public.invoice_items (invoice_id);
create index if not exists idx_invoice_items_product_id on public.invoice_items (product_id);

comment on table public.invoice_items is 'Line items for an invoice. Deleted automatically when the parent invoice is deleted.';
