-- ============================================================
-- Henil Enterprise — Database Schema
-- 25. Role-based access control (5 roles, module permissions)
-- ============================================================
-- Replaces the original 3-role (admin/manager/staff) blanket
-- "any signed-in user can read/write everything" model with 5 roles
-- and an explicit per-module permission matrix. This migration is
-- the actual enforcement layer — RLS runs inside Postgres itself, so
-- even a request that bypasses the frontend and backend entirely
-- (a raw call to the Supabase REST/RPC endpoint) is still governed
-- by the same rules defined here.

-- ---------- Extend the role enum ----------
alter type public.user_role add value if not exists 'sales';
alter type public.user_role add value if not exists 'accounts';

-- ---------- Per-user extra module grants ----------
-- "STAFF: Inventory, Assigned operational modules" — the second half
-- is a per-user grant, not something a fixed role definition can
-- express. This column lets an admin extend one specific user's
-- access beyond their role's default modules (e.g. a particular
-- staff member also handling Products) without changing their role
-- or granting it to every staff user. No UI manages this yet — it's
-- set directly via SQL until a User Management module exists — but
-- the permission check below already respects it.
alter table public.users add column if not exists assigned_modules text[] not null default '{}';

comment on column public.users.assigned_modules is 'Extra modules granted to this specific user beyond their role''s defaults (e.g. a staff member individually given Products access). Checked by public.has_module_access() alongside the role-based matrix.';

-- ---------- The permission matrix (single source of truth) ----------
-- Mirrors the brief exactly:
--   ADMIN    - everything
--   MANAGER  - clients, products, quotations, invoices, inventory, reports
--   SALES    - clients, products, quotations
--   ACCOUNTS - invoices, payments, finance, expenses, reports
--   STAFF    - inventory (+ assigned_modules, checked separately)
-- 'finance' and 'reports' are not tables - they gate application
-- pages that read across several tables. 'suppliers' appears in no
-- role's list, so only admin (the catch-all) can reach it.
create or replace function public.role_has_module(p_role text, p_module text)
returns boolean
language sql
immutable
as $$
  select case
    when p_role = 'admin' then true
    when p_role = 'manager' then p_module in ('clients', 'products', 'quotations', 'invoices', 'inventory', 'reports')
    when p_role = 'sales' then p_module in ('clients', 'products', 'quotations')
    when p_role = 'accounts' then p_module in ('invoices', 'payments', 'finance', 'expenses', 'reports')
    when p_role = 'staff' then p_module in ('inventory')
    else false
  end;
$$;

-- SECURITY DEFINER so this can read public.users without recursively
-- triggering the RLS policies defined on public.users itself.
create or replace function public.has_module_access(p_module text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_assigned text[];
begin
  select role::text, assigned_modules into v_role, v_assigned
  from public.users where id = auth.uid();

  if v_role is null then
    return false;
  end if;

  if public.role_has_module(v_role, p_module) then
    return true;
  end if;

  return v_assigned is not null and p_module = any(v_assigned);
end;
$$;

-- Deleting is more consequential than reading/writing within a
-- module a role is otherwise permitted to use, so it's additionally
-- restricted to admin/manager - matching the original schema's
-- "staff cannot delete" intent, generalized across all 5 roles.
create or replace function public.can_delete_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_module_access(p_module) and public.current_user_role() in ('admin', 'manager');
$$;

-- ---------- Close a privilege-escalation gap ----------
-- The original users_update policy (migration 17) allows
-- auth.uid() = id, i.e. any signed-in user can update their own
-- row - which includes the role and (now) assigned_modules columns.
-- Nothing stopped a STAFF user from calling
-- update users set role = 'admin' where id = auth.uid() directly
-- against the API and granting themselves full access. This trigger
-- closes that regardless of what the RLS policy's USING/WITH CHECK
-- clauses allow.
create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and public.current_user_role() <> 'admin' then
    raise exception 'Only an admin can change a user''s role.';
  end if;
  if new.assigned_modules is distinct from old.assigned_modules and public.current_user_role() <> 'admin' then
    raise exception 'Only an admin can change a user''s assigned modules.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_unauthorized_role_change on public.users;
create trigger trg_prevent_unauthorized_role_change
  before update on public.users
  for each row
  execute function public.prevent_unauthorized_role_change();

-- ============================================================
-- Rewrite every table's policies to use the module matrix
-- ============================================================

-- ---------- clients ----------
drop policy if exists clients_select on public.clients;
drop policy if exists clients_insert on public.clients;
drop policy if exists clients_update on public.clients;
drop policy if exists clients_delete on public.clients;

create policy clients_select on public.clients for select using (public.has_module_access('clients'));
create policy clients_insert on public.clients for insert with check (public.has_module_access('clients'));
create policy clients_update on public.clients for update using (public.has_module_access('clients')) with check (public.has_module_access('clients'));
create policy clients_delete on public.clients for delete using (public.can_delete_module('clients'));

-- ---------- products ----------
drop policy if exists products_select on public.products;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;
drop policy if exists products_delete on public.products;

create policy products_select on public.products for select using (public.has_module_access('products'));
create policy products_insert on public.products for insert with check (public.has_module_access('products'));
create policy products_update on public.products for update using (public.has_module_access('products')) with check (public.has_module_access('products'));
create policy products_delete on public.products for delete using (public.can_delete_module('products'));

-- ---------- quotations ----------
drop policy if exists quotations_select on public.quotations;
drop policy if exists quotations_insert on public.quotations;
drop policy if exists quotations_update on public.quotations;
drop policy if exists quotations_delete on public.quotations;

create policy quotations_select on public.quotations for select using (public.has_module_access('quotations'));
create policy quotations_insert on public.quotations for insert with check (public.has_module_access('quotations'));
create policy quotations_update on public.quotations for update using (public.has_module_access('quotations')) with check (public.has_module_access('quotations'));
create policy quotations_delete on public.quotations for delete using (public.can_delete_module('quotations'));

-- ---------- quotation_items ----------
drop policy if exists quotation_items_select on public.quotation_items;
drop policy if exists quotation_items_insert on public.quotation_items;
drop policy if exists quotation_items_update on public.quotation_items;
drop policy if exists quotation_items_delete on public.quotation_items;

create policy quotation_items_select on public.quotation_items for select using (public.has_module_access('quotations'));
create policy quotation_items_insert on public.quotation_items for insert with check (public.has_module_access('quotations'));
create policy quotation_items_update on public.quotation_items for update using (public.has_module_access('quotations')) with check (public.has_module_access('quotations'));
create policy quotation_items_delete on public.quotation_items for delete using (public.can_delete_module('quotations'));

-- ---------- invoices ----------
drop policy if exists invoices_select on public.invoices;
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_update on public.invoices;
drop policy if exists invoices_delete on public.invoices;

create policy invoices_select on public.invoices for select using (public.has_module_access('invoices'));
create policy invoices_insert on public.invoices for insert with check (public.has_module_access('invoices'));
create policy invoices_update on public.invoices for update using (public.has_module_access('invoices')) with check (public.has_module_access('invoices'));
create policy invoices_delete on public.invoices for delete using (public.can_delete_module('invoices'));

-- ---------- invoice_items ----------
drop policy if exists invoice_items_select on public.invoice_items;
drop policy if exists invoice_items_insert on public.invoice_items;
drop policy if exists invoice_items_update on public.invoice_items;
drop policy if exists invoice_items_delete on public.invoice_items;

create policy invoice_items_select on public.invoice_items for select using (public.has_module_access('invoices'));
create policy invoice_items_insert on public.invoice_items for insert with check (public.has_module_access('invoices'));
create policy invoice_items_update on public.invoice_items for update using (public.has_module_access('invoices')) with check (public.has_module_access('invoices'));
create policy invoice_items_delete on public.invoice_items for delete using (public.can_delete_module('invoices'));

-- ---------- payments ----------
-- SELECT is intentionally broader than the 'payments' module alone:
-- anyone who can see invoices needs payment amounts to compute a
-- "remaining balance" (Invoice view, Outstanding/Overdue reports) -
-- e.g. MANAGER has 'invoices' but not 'payments'. Writing to the
-- ledger itself still requires true 'payments' access.
drop policy if exists payments_select on public.payments;
drop policy if exists payments_insert on public.payments;
drop policy if exists payments_update on public.payments;
drop policy if exists payments_delete on public.payments;

create policy payments_select on public.payments for select using (public.has_module_access('payments') or public.has_module_access('invoices'));
create policy payments_insert on public.payments for insert with check (public.has_module_access('payments'));
create policy payments_update on public.payments for update using (public.has_module_access('payments')) with check (public.has_module_access('payments'));
create policy payments_delete on public.payments for delete using (public.can_delete_module('payments'));

-- ---------- expenses ----------
drop policy if exists expenses_select on public.expenses;
drop policy if exists expenses_insert on public.expenses;
drop policy if exists expenses_update on public.expenses;
drop policy if exists expenses_delete on public.expenses;

create policy expenses_select on public.expenses for select using (public.has_module_access('expenses'));
create policy expenses_insert on public.expenses for insert with check (public.has_module_access('expenses'));
create policy expenses_update on public.expenses for update using (public.has_module_access('expenses')) with check (public.has_module_access('expenses'));
create policy expenses_delete on public.expenses for delete using (public.can_delete_module('expenses'));

-- ---------- suppliers ----------
-- No role in the brief lists Suppliers, so only ADMIN (the "everything" catch-all) reaches it.
drop policy if exists suppliers_select on public.suppliers;
drop policy if exists suppliers_insert on public.suppliers;
drop policy if exists suppliers_update on public.suppliers;
drop policy if exists suppliers_delete on public.suppliers;

create policy suppliers_select on public.suppliers for select using (public.has_module_access('suppliers'));
create policy suppliers_insert on public.suppliers for insert with check (public.has_module_access('suppliers'));
create policy suppliers_update on public.suppliers for update using (public.has_module_access('suppliers')) with check (public.has_module_access('suppliers'));
create policy suppliers_delete on public.suppliers for delete using (public.can_delete_module('suppliers'));

-- ---------- inventory ----------
drop policy if exists inventory_select on public.inventory;
drop policy if exists inventory_insert on public.inventory;
drop policy if exists inventory_update on public.inventory;
drop policy if exists inventory_delete on public.inventory;

create policy inventory_select on public.inventory for select using (public.has_module_access('inventory'));
create policy inventory_insert on public.inventory for insert with check (public.has_module_access('inventory'));
create policy inventory_update on public.inventory for update using (public.has_module_access('inventory')) with check (public.has_module_access('inventory'));
create policy inventory_delete on public.inventory for delete using (public.can_delete_module('inventory'));

-- ---------- inventory_transactions ----------
drop policy if exists inventory_transactions_select on public.inventory_transactions;
drop policy if exists inventory_transactions_insert on public.inventory_transactions;
drop policy if exists inventory_transactions_delete on public.inventory_transactions;

create policy inventory_transactions_select on public.inventory_transactions for select using (public.has_module_access('inventory'));
create policy inventory_transactions_insert on public.inventory_transactions for insert with check (public.has_module_access('inventory'));
create policy inventory_transactions_delete on public.inventory_transactions for delete using (public.can_delete_module('inventory'));

-- ---------- files ----------
-- A file's relevant module follows whichever parent it's attached
-- to; a user needs access to at least one of those modules.
drop policy if exists files_select on public.files;
drop policy if exists files_insert on public.files;
drop policy if exists files_update on public.files;
drop policy if exists files_delete on public.files;

create policy files_select on public.files for select using (
  public.has_module_access('clients') or public.has_module_access('quotations')
  or public.has_module_access('invoices') or public.has_module_access('expenses')
);
create policy files_insert on public.files for insert with check (
  public.has_module_access('clients') or public.has_module_access('quotations')
  or public.has_module_access('invoices') or public.has_module_access('expenses')
);
create policy files_update on public.files for update using (
  public.has_module_access('clients') or public.has_module_access('quotations')
  or public.has_module_access('invoices') or public.has_module_access('expenses')
) with check (
  public.has_module_access('clients') or public.has_module_access('quotations')
  or public.has_module_access('invoices') or public.has_module_access('expenses')
);
create policy files_delete on public.files for delete using (
  public.can_delete_module('clients') or public.can_delete_module('quotations')
  or public.can_delete_module('invoices') or public.can_delete_module('expenses')
);

-- ---------- company_settings ----------
-- Read stays broad (needed by every role that can generate a
-- quotation/invoice PDF); write is now ADMIN only - "Settings"
-- appears in no other role's module list, tightened from the
-- original manager-or-admin default.
drop policy if exists company_settings_select on public.company_settings;
drop policy if exists company_settings_insert on public.company_settings;
drop policy if exists company_settings_update on public.company_settings;
drop policy if exists company_settings_delete on public.company_settings;

create policy company_settings_select on public.company_settings for select using (auth.uid() is not null);
create policy company_settings_insert on public.company_settings for insert with check (public.current_user_role() = 'admin');
create policy company_settings_update on public.company_settings for update using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy company_settings_delete on public.company_settings for delete using (public.current_user_role() = 'admin');

comment on function public.has_module_access(text) is 'Single source of truth for module-based RLS. Mirrored (not re-implemented differently) by frontend/src/context/AuthContext.jsx for UI/routing - that copy is for UX only, this function is the actual enforcement.';
