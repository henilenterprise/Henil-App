-- ============================================================
-- Henil Enterprise — Database Schema
-- 04. products
-- ============================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  category text,
  description text,
  material text,
  thickness text,
  unit text not null default 'pcs',
  default_rate numeric(12, 2) not null default 0,
  gst_percentage numeric(5, 2) not null default 18,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_products_default_rate check (default_rate >= 0),
  constraint chk_products_gst_percentage check (gst_percentage >= 0 and gst_percentage <= 100)
);

create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_is_active on public.products (is_active);
create index if not exists idx_products_name on public.products (name);

comment on table public.products is 'Acrylic / polycarbonate products and fabrication items that can be quoted, invoiced, and stocked.';
comment on column public.products.unit is 'Unit of measure, e.g. sheets, pcs, rolls, sq.ft.';
