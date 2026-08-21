-- ============================================================
-- Henil Enterprise — Database Schema
-- 24. Project files: dedicated Storage bucket + access control
-- ============================================================
-- Customer drawings and project files (distinct from the expense
-- receipts bucket added in migration 22) get their own bucket:
-- 'project-files'. Unlike 'attachments' (public, for convenience),
-- this bucket is PRIVATE — access is only ever through a short-lived
-- signed URL generated for an authenticated, authorized request
-- (frontend/src/services/filesService.js), which is the access
-- control this module's brief calls for explicitly.

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 20971520) -- 20 MB
on conflict (id) do nothing;

-- RLS on storage.objects, scoped to this bucket. Mirrors the
-- public.files table's own RLS: any signed-in (staff+) user can
-- upload/view, but only manager/admin can delete — deleting a
-- customer's drawing is a more consequential action than adding one.
drop policy if exists project_files_select on storage.objects;
create policy project_files_select on storage.objects
  for select using (bucket_id = 'project-files' and auth.uid() is not null);

drop policy if exists project_files_insert on storage.objects;
create policy project_files_insert on storage.objects
  for insert with check (bucket_id = 'project-files' and auth.uid() is not null);

drop policy if exists project_files_delete on storage.objects;
create policy project_files_delete on storage.objects
  for delete using (bucket_id = 'project-files' and public.current_user_role() in ('admin', 'manager'));

-- ---------- Allow-list at the database level too ----------
-- Application code (frontend/src/services/filesService.js) validates
-- the file extension before ever uploading, but this constraint means
-- a row bypassing the app (direct SQL, a bug, a future integration)
-- still can't record a file type outside the supported set for
-- project files. file_type stores the lowercase extension (e.g.
-- 'pdf'), not a MIME type — MIME strings for DXF/DWG aren't
-- standardized across browsers/OSes, so extension is the reliable
-- signal, both here and in the app.
--
-- Scoped to rows where expense_id is null: expense receipts
-- (migration 22) were never restricted to this exact list (any
-- image format was accepted), so this constraint only tightens the
-- *new* project-files use case and doesn't retroactively break that
-- existing feature.
alter table public.files drop constraint if exists chk_files_file_type;
alter table public.files
  add constraint chk_files_file_type
  check (
    file_type is null
    or expense_id is not null
    or lower(file_type) in ('pdf', 'png', 'jpg', 'jpeg', 'dxf', 'dwg')
  );

comment on column public.files.file_type is 'Lowercase file extension. Project files (client/quotation/invoice) are restricted to pdf/png/jpg/jpeg/dxf/dwg by chk_files_file_type; expense attachments are not.';
