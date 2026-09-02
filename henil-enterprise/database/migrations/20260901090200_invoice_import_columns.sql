-- ============================================================
-- Henil Enterprise — Database Schema
-- 31. Additive invoice columns for the invoice importer
-- ============================================================
-- Every column here is NULLABLE (or has a default that preserves
-- today's behavior) so every existing row and every existing INSERT
-- statement anywhere in the app (createInvoice, updateInvoice, the
-- existing Data Management template importer) continues to work
-- completely unchanged. Nothing here is required, nothing here is
-- backfilled with guessed data.

alter table public.invoices
  add column if not exists dc_number text,
  add column if not exists purchase_order_number text,
  -- The buyer's tax/VAT/GST number AS PRINTED ON THAT SPECIFIC INVOICE
  -- at the time it was issued. Deliberately separate from
  -- clients.gst_number: a client's current GSTIN can differ from (or
  -- postdate) what an old VAT-era invoice actually shows, and a
  -- historical document must never be silently "corrected" to match
  -- today's client record.
  add column if not exists buyer_tax_number text,
  -- Explicit financial year this invoice was imported under (e.g.
  -- '2026-27'), set by the user at import time — never inferred
  -- solely from invoice_date, per the import brief. Null for
  -- manually created invoices, which have no such concept today.
  add column if not exists financial_year text,
  -- Where this row came from. Manually created invoices (today's
  -- only path) are unaffected: the column defaults to 'manual' so
  -- every pre-existing INSERT that doesn't mention this column keeps
  -- working exactly as before.
  add column if not exists source text not null default 'manual',
  -- The invoice number AS PRINTED on the original document. For
  -- manual invoices this always equals invoice_number. For imported
  -- invoices it also always equals invoice_number UNLESS the printed
  -- number collides with one already in the database (e.g. numbering
  -- restarted in a later financial year) — in that case invoice_number
  -- gets a system-added disambiguating suffix so the table's existing
  -- UNIQUE constraint still holds, while source_invoice_number keeps
  -- the true, unmodified original value for display and audit.
  add column if not exists source_invoice_number text,
  add column if not exists import_batch_id uuid references public.invoice_imports (id) on delete set null,
  -- True when the importer could not confidently reconcile this
  -- invoice (e.g. extracted total didn't match the calculated total,
  -- an ambiguous client match, a missing required field). Imported
  -- invoices only ever land in the main Invoices list once this is
  -- false — see invoiceImportService.js.
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_notes text;

alter table public.invoices drop constraint if exists chk_invoices_source;
alter table public.invoices add constraint chk_invoices_source check (source in ('manual', 'imported'));

create index if not exists idx_invoices_import_batch_id on public.invoices (import_batch_id);
create index if not exists idx_invoices_source on public.invoices (source);
create index if not exists idx_invoices_financial_year on public.invoices (financial_year);

comment on column public.invoices.source is 'manual = created via the Invoice form (default, matches all pre-existing rows); imported = created via Data Management → Import Invoices.';
comment on column public.invoices.source_invoice_number is 'Invoice number exactly as printed on the source document — never invented, never auto-corrected. May differ from invoice_number only when a disambiguating suffix was required to satisfy the unique constraint.';
