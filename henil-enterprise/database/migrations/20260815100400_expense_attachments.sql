-- ============================================================
-- Henil Enterprise — Database Schema
-- 22. Expense attachments (Storage bucket + files.expense_id)
-- ============================================================
-- The Expenses module's "Attachment" field stores the actual file in
-- Supabase Storage and its metadata in public.files (which already
-- has client_id/quotation_id/invoice_id link columns — this adds the
-- matching expense_id column, following the same pattern).

-- ---------- Storage bucket ----------
-- Public so getPublicUrl() works directly without generating signed
-- URLs. This is an acceptable tradeoff here: object paths are
-- unguessable (contain a UUID), the app is already behind Supabase
-- Auth, and nothing links to these URLs from outside the app. If
-- stricter privacy is needed later, switch the app to
-- createSignedUrl() and set public = false here.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- RLS on storage.objects, scoped to only this bucket. storage.objects
-- has RLS enabled by default in Supabase-managed projects; this just
-- adds the policies (there are none by default, so nothing is
-- accessible until these exist).
drop policy if exists attachments_select on storage.objects;
create policy attachments_select on storage.objects
  for select using (bucket_id = 'attachments' and auth.uid() is not null);

drop policy if exists attachments_insert on storage.objects;
create policy attachments_insert on storage.objects
  for insert with check (bucket_id = 'attachments' and auth.uid() is not null);

drop policy if exists attachments_delete on storage.objects;
create policy attachments_delete on storage.objects
  for delete using (bucket_id = 'attachments' and auth.uid() is not null);

-- ---------- files.expense_id ----------
alter table public.files
  add column if not exists expense_id uuid references public.expenses (id) on delete cascade;

create index if not exists idx_files_expense_id on public.files (expense_id);

comment on column public.files.expense_id is 'Set when this file is an expense receipt/attachment. Storage object itself lives in the "attachments" bucket, not deleted automatically by this FK cascade — application code must remove it from Storage explicitly.';
