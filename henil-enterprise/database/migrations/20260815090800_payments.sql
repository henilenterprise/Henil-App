-- ============================================================
-- Henil Enterprise — Database Schema
-- 09. payments
-- ============================================================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(12, 2) not null,
  payment_date date not null default current_date,
  payment_method text not null,
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),

  constraint chk_payments_amount check (amount > 0),
  constraint chk_payments_method check (
    payment_method in ('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other')
  )
);

create index if not exists idx_payments_invoice_id on public.payments (invoice_id);
create index if not exists idx_payments_payment_date on public.payments (payment_date);

comment on table public.payments is 'Payments recorded against an invoice. An invoice can have multiple partial payments.';
