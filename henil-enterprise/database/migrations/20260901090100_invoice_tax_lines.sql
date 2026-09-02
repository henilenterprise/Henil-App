-- ============================================================
-- Henil Enterprise — Database Schema
-- 30. invoice_tax_lines (named, multi-component tax breakdown)
-- ============================================================
-- public.invoices.gst is a single blended tax number and is kept
-- exactly as-is — every existing manually-created invoice, the PDF
-- generator, reports, and the calculation engine in
-- quotationCalculations.js all keep working unmodified against it.
--
-- Historical invoices, however, often show several NAMED tax
-- components on one document (CGST 9% + SGST 9%, or OUTPUT VAT 4% +
-- ADD.OUTPUT VAT 1%, etc.) that a single number can't represent.
-- This table is purely additive: it stores that breakdown for
-- invoices where it's known (mainly ones created by the invoice
-- importer), while invoices.gst continues to hold the same combined
-- total it always has, kept in sync with the sum of these rows
-- whenever they exist. An invoice with no rows here behaves in every
-- way exactly like it did before this migration.

create table if not exists public.invoice_tax_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  tax_name text not null, -- as printed on the source document, e.g. 'CGST', 'SGST', 'IGST', 'VAT', 'OUTPUT VAT', 'CESS'
  tax_rate numeric(6, 3), -- percentage, e.g. 9 for "CGST-9%"; nullable because some historical rows only show an amount
  tax_amount numeric(12, 2) not null default 0,
  sort_order integer not null default 0,

  constraint chk_invoice_tax_lines_rate check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 100)),
  constraint chk_invoice_tax_lines_amount check (tax_amount >= 0)
);

create index if not exists idx_invoice_tax_lines_invoice_id on public.invoice_tax_lines (invoice_id);

comment on table public.invoice_tax_lines is 'Optional named tax breakdown (CGST/SGST/IGST/VAT/etc.) for an invoice. Additive: invoices.gst always still holds the combined total and is unaffected by whether this table has rows for that invoice.';
