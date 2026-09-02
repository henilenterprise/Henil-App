-- ============================================================
-- Henil Enterprise — Database Schema
-- 33. Storage bucket for original uploaded invoice-import workbooks
-- ============================================================
-- Mirrors the 'project-files' bucket pattern from migration 24
-- exactly: PRIVATE bucket, access only via a short-lived signed URL
-- generated for an authenticated, authorized request
-- (frontend/src/services/invoiceImportService.js), never a public
-- URL. These are complete financial-year invoice workbooks, i.e.
-- sensitive financial records, so they get the same treatment as
-- customer drawings plus a tighter access rule: gated by the 'data'
-- module (admin-only today), matching who can reach Import Invoices
-- in the UI at all.

insert into storage.buckets (id, name, public, file_size_limit)
values ('invoice-imports', 'invoice-imports', false, 52428800) -- 50 MB
on conflict (id) do nothing;

drop policy if exists invoice_imports_bucket_select on storage.objects;
create policy invoice_imports_bucket_select on storage.objects
  for select using (bucket_id = 'invoice-imports' and public.has_module_access('data'));

drop policy if exists invoice_imports_bucket_insert on storage.objects;
create policy invoice_imports_bucket_insert on storage.objects
  for insert with check (bucket_id = 'invoice-imports' and public.has_module_access('data'));

drop policy if exists invoice_imports_bucket_delete on storage.objects;
create policy invoice_imports_bucket_delete on storage.objects
  for delete using (bucket_id = 'invoice-imports' and public.current_user_role() in ('admin', 'manager'));
