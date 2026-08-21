-- ============================================================
-- Henil Enterprise — Database Schema
-- 13. inventory_transactions
-- ============================================================
-- Append-only ledger of stock movements. The current balance in
-- `inventory.quantity` should always equal the net of these rows for
-- that product; reconciling/updating that balance is application
-- logic (or a future trigger), not implemented in this DB-only phase.

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  transaction_type inventory_transaction_type not null,
  quantity numeric(12, 2) not null,
  reference text,
  notes text,
  created_at timestamptz not null default now(),

  constraint chk_inventory_transactions_quantity check (quantity > 0)
);

create index if not exists idx_inventory_transactions_product_id on public.inventory_transactions (product_id);
create index if not exists idx_inventory_transactions_type on public.inventory_transactions (transaction_type);
create index if not exists idx_inventory_transactions_created_at on public.inventory_transactions (created_at);

comment on table public.inventory_transactions is 'Append-only stock movement ledger: IN (received), OUT (used/sold), ADJUSTMENT (stock count correction).';
comment on column public.inventory_transactions.reference is 'Free-text reference, e.g. a quotation/invoice number or supplier PO number.';
