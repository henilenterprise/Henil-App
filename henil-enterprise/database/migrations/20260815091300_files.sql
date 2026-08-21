-- ============================================================
-- Henil Enterprise — Database Schema
-- 14. files
-- ============================================================
-- Metadata for files stored in Supabase Storage (drawings, signed
-- quotations, reference images, etc). `file_path` is expected to be
-- the storage object path, not file bytes. All three link columns
-- are nullable and independent — a file may relate to a client, a
-- quotation, an invoice, more than one of these, or none yet.

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  quotation_id uuid references public.quotations (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now(),

  constraint chk_files_file_size check (file_size is null or file_size >= 0)
);

create index if not exists idx_files_client_id on public.files (client_id);
create index if not exists idx_files_quotation_id on public.files (quotation_id);
create index if not exists idx_files_invoice_id on public.files (invoice_id);

comment on table public.files is 'Metadata for files in Supabase Storage: drawings, signed documents, reference images.';
comment on column public.files.file_path is 'Path of the object inside its Supabase Storage bucket.';
