-- ============================================================
-- Henil Enterprise — Database Schema
-- 29. invoice_imports (bulk financial-year invoice import history)
-- ============================================================
-- One row per "Import Invoices" run from Data Management. Created
-- BEFORE public.invoices gets its import_batch_id column (next
-- migration) so that column can reference this table.
--
-- This is purely a history/audit log — it never gates or blocks
-- anything the rest of the app does with invoices. Deleting an
-- import row (not exposed in the UI, but possible via SQL) does not
-- delete the invoices it created; the FK on invoices.import_batch_id
-- is ON DELETE SET NULL for exactly that reason.

create table if not exists public.invoice_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_path text, -- Supabase Storage object path of the original workbook, see migration 33; null if the file wasn't retained
  file_size bigint,
  financial_year text, -- explicit user selection at import time, e.g. '2026-27' — never inferred from invoice_date alone
  uploaded_by uuid references public.users (id) on delete set null,
  status text not null default 'completed',
  total_detected integer not null default 0,
  imported_count integer not null default 0,
  skipped_duplicate_count integer not null default 0,
  needs_review_count integer not null default 0,
  failed_count integer not null default 0,
  total_line_items integer not null default 0,
  total_invoice_value numeric(14, 2) not null default 0,
  total_tax_value numeric(14, 2) not null default 0,
  -- Full per-invoice detection/import report (everything the preview
  -- and result screens showed), so a past import can be reopened and
  -- inspected later without re-parsing the original file.
  report jsonb,
  created_at timestamptz not null default now(),

  constraint chk_invoice_imports_status check (status in ('completed', 'partial', 'failed')),
  constraint chk_invoice_imports_file_size check (file_size is null or file_size >= 0),
  constraint chk_invoice_imports_counts check (
    total_detected >= 0 and imported_count >= 0 and skipped_duplicate_count >= 0
    and needs_review_count >= 0 and failed_count >= 0 and total_line_items >= 0
  )
);

create index if not exists idx_invoice_imports_created_at on public.invoice_imports (created_at desc);
create index if not exists idx_invoice_imports_uploaded_by on public.invoice_imports (uploaded_by);

comment on table public.invoice_imports is 'History log for bulk "Import Invoices" runs (financial-year workbooks) from Data Management. Never referenced by financial logic — audit/history only.';
comment on column public.invoice_imports.report is 'Full per-invoice outcome snapshot (detected fields, status, warnings) captured at import time, for reopening this batch later.';
