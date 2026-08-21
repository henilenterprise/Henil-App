-- ============================================================
-- Henil Enterprise — Database Schema
-- 17. Row Level Security
-- ============================================================
-- The frontend is not connected yet and no auth flow exists in the
-- app so far, but RLS is enabled now so the database is safe by
-- default the moment a Supabase client (even with just the anon key)
-- can reach it: with RLS on and no policy granting access, anon
-- requests are rejected. Policies below only grant access to
-- authenticated Supabase Auth users (auth.uid() is not null),
-- refined by the role stored in public.users.role.
--
-- Role model used throughout:
--   admin   — full access, including deletes
--   manager — full access, including deletes
--   staff   — can read/create/update, cannot delete
--
-- Adjust these once real auth + role management is built; nothing
-- here depends on frontend code existing yet.

-- ---------- Helper: current signed-in user's role ----------
-- SECURITY DEFINER so this can read public.users without recursively
-- triggering the RLS policies defined on public.users below.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.users where id = auth.uid();
$$;

create or replace function public.is_staff_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'manager');
$$;

-- ============================================================
-- users
-- ============================================================
alter table public.users enable row level security;

create policy users_select on public.users
  for select
  using (auth.uid() = id or public.is_manager_or_admin());

create policy users_insert on public.users
  for insert
  with check (public.current_user_role() = 'admin');

create policy users_update on public.users
  for update
  using (auth.uid() = id or public.current_user_role() = 'admin')
  with check (auth.uid() = id or public.current_user_role() = 'admin');

create policy users_delete on public.users
  for delete
  using (public.current_user_role() = 'admin');

-- ============================================================
-- Reusable pattern for standard business tables:
--   select/insert/update -> any authenticated (staff+) user
--   delete                -> manager or admin only
-- ============================================================

-- ---------- clients ----------
alter table public.clients enable row level security;

create policy clients_select on public.clients for select using (public.is_staff_or_above());
create policy clients_insert on public.clients for insert with check (public.is_staff_or_above());
create policy clients_update on public.clients for update using (public.is_staff_or_above()) with check (public.is_staff_or_above());
create policy clients_delete on public.clients for delete using (public.is_manager_or_admin());

-- ---------- products ----------
alter table public.products enable row level security;

create policy products_select on public.products for select using (public.is_staff_or_above());
create policy products_insert on public.products for insert with check (public.is_staff_or_above());
create policy products_update on public.products for update using (public.is_staff_or_above()) with check (public.is_staff_or_above());
create policy products_delete on public.products for delete using (public.is_manager_or_admin());

-- ---------- quotations ----------
alter table public.quotations enable row level security;

create policy quotations_select on public.quotations for select using (public.is_staff_or_above());
create policy quotations_insert on public.quotations for insert with check (public.is_staff_or_above());
create policy quotations_update on public.quotations for update using (public.is_staff_or_above()) with check (public.is_staff_or_above());
create policy quotations_delete on public.quotations for delete using (public.is_manager_or_admin());

-- ---------- quotation_items ----------
alter table public.quotation_items enable row level security;

create policy quotation_items_select on public.quotation_items for select using (public.is_staff_or_above());
create policy quotation_items_insert on public.quotation_items for insert with check (public.is_staff_or_above());
create policy quotation_items_update on public.quotation_items for update using (public.is_staff_or_above()) with check (public.is_staff_or_above());
create policy quotation_items_delete on public.quotation_items for delete using (public.is_manager_or_admin());

-- ---------- invoices ----------
alter table public.invoices enable row level security;

create policy invoices_select on public.invoices for select using (public.is_staff_or_above());
create policy invoices_insert on public.invoices for insert with check (public.is_staff_or_above());
create policy invoices_update on public.invoices for update using (public.is_staff_or_above()) with check (public.is_staff_or_above());
create policy invoices_delete on public.invoices for delete using (public.is_manager_or_admin());

-- ---------- invoice_items ----------
alter table public.invoice_items enable row level security;

create policy invoice_items_select on public.invoice_items for select using (public.is_staff_or_above());
create policy invoice_items_insert on public.invoice_items for insert with check (public.is_staff_or_above());
create policy invoice_items_update on public.invoice_items for update using (public.is_staff_or_above()) with check (public.is_staff_or_above());
create policy invoice_items_delete on public.invoice_items for delete using (public.is_manager_or_admin());

-- ---------- payments ----------
alter table public.payments enable row level security;

create policy payments_select on public.payments for select using (public.is_staff_or_above());
create policy payments_insert on public.payments for insert with check (public.is_staff_or_above());
create policy payments_update on public.payments for update using (public.is_staff_or_above()) with check (public.is_staff_or_above());
create policy payments_delete on public.payments for delete using (public.is_manager_or_admin());

-- ---------- expenses ----------
alter table public.expenses enable row level security;

create policy expenses_select on public.expenses for select using (public.is_staff_or_above());
create policy expenses_insert on public.expenses for insert with check (public.is_staff_or_above());
create policy expenses_update on public.expenses for update using (public.is_staff_or_above()) with check (public.is_staff_or_above());
create policy expenses_delete on public.expenses for delete using (public.is_manager_or_admin());

-- ---------- suppliers ----------
alter table public.suppliers enable row level security;

create policy suppliers_select on public.suppliers for select using (public.is_staff_or_above());
create policy suppliers_insert on public.suppliers for insert with check (public.is_staff_or_above());
create policy suppliers_update on public.suppliers for update using (public.is_staff_or_above()) with check (public.is_staff_or_above());
create policy suppliers_delete on public.suppliers for delete using (public.is_manager_or_admin());

-- ---------- inventory ----------
alter table public.inventory enable row level security;

create policy inventory_select on public.inventory for select using (public.is_staff_or_above());
create policy inventory_insert on public.inventory for insert with check (public.is_staff_or_above());
create policy inventory_update on public.inventory for update using (public.is_staff_or_above()) with check (public.is_staff_or_above());
create policy inventory_delete on public.inventory for delete using (public.is_manager_or_admin());

-- ---------- inventory_transactions ----------
-- Append-only ledger: no update policy is defined on purpose, so
-- rows cannot be edited after the fact, only inserted or (by a
-- manager/admin correcting a mistake) deleted.
alter table public.inventory_transactions enable row level security;

create policy inventory_transactions_select on public.inventory_transactions for select using (public.is_staff_or_above());
create policy inventory_transactions_insert on public.inventory_transactions for insert with check (public.is_staff_or_above());
create policy inventory_transactions_delete on public.inventory_transactions for delete using (public.is_manager_or_admin());

-- ---------- files ----------
alter table public.files enable row level security;

create policy files_select on public.files for select using (public.is_staff_or_above());
create policy files_insert on public.files for insert with check (public.is_staff_or_above());
create policy files_update on public.files for update using (public.is_staff_or_above()) with check (public.is_staff_or_above());
create policy files_delete on public.files for delete using (public.is_manager_or_admin());

-- ---------- company_settings ----------
-- Everyone signed in can read company details (needed to print them
-- on quotations/invoices); only managers/admins can change them.
alter table public.company_settings enable row level security;

create policy company_settings_select on public.company_settings for select using (public.is_staff_or_above());
create policy company_settings_insert on public.company_settings for insert with check (public.is_manager_or_admin());
create policy company_settings_update on public.company_settings for update using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
create policy company_settings_delete on public.company_settings for delete using (public.current_user_role() = 'admin');
