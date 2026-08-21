-- ============================================================
-- Henil Enterprise — Database Schema
-- 16. updated_at triggers
-- ============================================================
-- Keeps `updated_at` accurate automatically on every UPDATE, for
-- every table that has that column. Tables without an updated_at
-- column (quotation_items, invoice_items, payments, expenses,
-- inventory_transactions, files) are intentionally not included.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at on public.users;
create trigger trg_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.clients;
create trigger trg_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.products;
create trigger trg_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.quotations;
create trigger trg_set_updated_at
  before update on public.quotations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.invoices;
create trigger trg_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.suppliers;
create trigger trg_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.inventory;
create trigger trg_set_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.company_settings;
create trigger trg_set_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();
