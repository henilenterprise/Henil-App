-- ============================================================
-- Henil Enterprise — Database Schema
-- 12. inventory
-- ============================================================
-- One current-stock row per product. Historical stock movements are
-- recorded separately in inventory_transactions; this table always
-- reflects the current on-hand quantity.

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  quantity numeric(12, 2) not null default 0,
  minimum_stock numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),

  constraint chk_inventory_quantity check (quantity >= 0),
  constraint chk_inventory_minimum_stock check (minimum_stock >= 0)
);

create index if not exists idx_inventory_product_id on public.inventory (product_id);

comment on table public.inventory is 'Current stock level per product. quantity <= minimum_stock means the product should be reordered.';
