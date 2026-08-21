-- ============================================================
-- Henil Enterprise — Database Schema
-- 27. Security audit fix: missing Storage size limits
-- ============================================================
-- Found during a full security audit: the 'project-files' bucket
-- (migration 24) got a 20MB file_size_limit, but 'attachments'
-- (migration 22, expense receipts) and 'company-assets' (migration
-- 26, company logo) never did. Without it, RLS still correctly
-- restricts WHO can upload, but not HOW MUCH — any user with write
-- access to a bucket could upload an arbitrarily large file. For
-- 'company-assets' specifically this is worse than ordinary storage
-- abuse: the logo is fetched into memory on every single PDF
-- generation (see frontend/src/utils/pdf/buildDocumentPdf.js), so an
-- oversized "logo" would slow down or bloat memory usage for every
-- user generating a quotation or invoice PDF, not just the uploader.

update storage.buckets set file_size_limit = 10485760 where id = 'attachments'; -- 10 MB
update storage.buckets set file_size_limit = 2097152 where id = 'company-assets'; -- 2 MB, generous for a logo image

-- ============================================================
-- Financial consistency: verify totals, don't just trust them
-- ============================================================
-- quotations.total, invoices.total, and quotation_items/invoice_items
-- .amount were documented as "computed and stored by the application
-- layer" with no independent database check. RLS correctly restricts
-- WHO can write to these tables, but nothing previously stopped an
-- authorized user (e.g. a SALES role, which can create quotations)
-- from calling the API directly and storing a self-inconsistent
-- total — e.g. subtotal=100000, discount=0, gst=0, total=1 — which
-- would then flow into Reports and Finance as real revenue data.
--
-- These constraints exactly match the formulas in
-- frontend/src/utils/quotationCalculations.js (computeItemAmount,
-- computeQuotationTotals): item.amount = quantity * rate (pre-GST),
-- and total = greatest(0, subtotal - discount + gst). Money columns
-- are numeric(12,2) — exact decimal arithmetic, not floating point —
-- so this equality check has no rounding false-positive risk against
-- values the app itself computed.

alter table public.quotation_items drop constraint if exists chk_quotation_items_amount_consistent;
alter table public.quotation_items
  add constraint chk_quotation_items_amount_consistent
  check (amount = round(quantity * rate, 2));

alter table public.invoice_items drop constraint if exists chk_invoice_items_amount_consistent;
alter table public.invoice_items
  add constraint chk_invoice_items_amount_consistent
  check (amount = round(quantity * rate, 2));

alter table public.quotations drop constraint if exists chk_quotations_total_consistent;
alter table public.quotations
  add constraint chk_quotations_total_consistent
  check (total = greatest(0, round(subtotal - discount + gst, 2)));

alter table public.invoices drop constraint if exists chk_invoices_total_consistent;
alter table public.invoices
  add constraint chk_invoices_total_consistent
  check (total = greatest(0, round(subtotal - discount + gst, 2)));

comment on constraint chk_quotations_total_consistent on public.quotations is
  'Defense in depth: independently verifies what the application already computes, so a direct API call cannot store a fabricated total.';
comment on constraint chk_invoices_total_consistent on public.invoices is
  'Defense in depth: independently verifies what the application already computes, so a direct API call cannot store a fabricated total.';
