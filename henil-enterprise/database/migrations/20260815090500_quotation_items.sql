-- ============================================================
-- Henil Enterprise — Database Schema
-- 06. quotation_items
-- ============================================================

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  description text not null,
  quantity numeric(12, 2) not null,
  unit text not null default 'pcs',
  rate numeric(12, 2) not null,
  gst_percentage numeric(5, 2) not null default 18,
  amount numeric(12, 2) not null,

  constraint chk_quotation_items_quantity check (quantity > 0),
  constraint chk_quotation_items_rate check (rate >= 0),
  constraint chk_quotation_items_gst_percentage check (gst_percentage >= 0 and gst_percentage <= 100),
  constraint chk_quotation_items_amount check (amount >= 0)
);

create index if not exists idx_quotation_items_quotation_id on public.quotation_items (quotation_id);
create index if not exists idx_quotation_items_product_id on public.quotation_items (product_id);

comment on table public.quotation_items is 'Line items for a quotation. Deleted automatically when the parent quotation is deleted.';
comment on column public.quotation_items.product_id is 'Nullable: line item keeps its description/rate even if the product is later removed.';
