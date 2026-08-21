-- ============================================================
-- Henil Enterprise — Database Schema
-- 10. expenses
-- ============================================================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  category text not null,
  description text,
  amount numeric(12, 2) not null,
  payment_method text,
  vendor text,
  notes text,
  created_at timestamptz not null default now(),

  constraint chk_expenses_amount check (amount > 0)
);

create index if not exists idx_expenses_date on public.expenses (date);
create index if not exists idx_expenses_category on public.expenses (category);

comment on table public.expenses is 'Operating expenses (materials, utilities, rent, transport, etc.), independent of the invoicing flow.';
