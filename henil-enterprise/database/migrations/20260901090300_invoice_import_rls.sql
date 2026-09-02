-- ============================================================
-- Henil Enterprise — Database Schema
-- 32. RLS for invoice_imports and invoice_tax_lines
-- ============================================================
-- Mirrors the existing module matrix from migration 25
-- (role_based_access_control.sql) exactly, rather than inventing a
-- new rule shape:
--   invoice_tax_lines follows the 'invoices' module, identical to
--   how invoice_items already does.
--   invoice_imports follows the 'data' module, identical to how the
--   existing Data Management import/export screen is gated
--   (frontend: <ModuleProtectedRoute module="data">) — only admin
--   has 'data' today, so only admin can run or view bulk invoice
--   imports, same as the existing template importer.

alter table public.invoice_tax_lines enable row level security;

drop policy if exists invoice_tax_lines_select on public.invoice_tax_lines;
drop policy if exists invoice_tax_lines_insert on public.invoice_tax_lines;
drop policy if exists invoice_tax_lines_update on public.invoice_tax_lines;
drop policy if exists invoice_tax_lines_delete on public.invoice_tax_lines;

create policy invoice_tax_lines_select on public.invoice_tax_lines for select using (public.has_module_access('invoices'));
create policy invoice_tax_lines_insert on public.invoice_tax_lines for insert with check (public.has_module_access('invoices'));
create policy invoice_tax_lines_update on public.invoice_tax_lines for update using (public.has_module_access('invoices')) with check (public.has_module_access('invoices'));
create policy invoice_tax_lines_delete on public.invoice_tax_lines for delete using (public.can_delete_module('invoices'));

alter table public.invoice_imports enable row level security;

drop policy if exists invoice_imports_select on public.invoice_imports;
drop policy if exists invoice_imports_insert on public.invoice_imports;
drop policy if exists invoice_imports_update on public.invoice_imports;
drop policy if exists invoice_imports_delete on public.invoice_imports;

create policy invoice_imports_select on public.invoice_imports for select using (public.has_module_access('data'));
create policy invoice_imports_insert on public.invoice_imports for insert with check (public.has_module_access('data'));
create policy invoice_imports_update on public.invoice_imports for update using (public.has_module_access('data')) with check (public.has_module_access('data'));
create policy invoice_imports_delete on public.invoice_imports for delete using (public.can_delete_module('data'));
