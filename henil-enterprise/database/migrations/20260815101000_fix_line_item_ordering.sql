-- ============================================================
-- Henil Enterprise — Database Schema
-- 28. Fix: quotation_items/invoice_items had no ordering column
-- ============================================================
-- Found via a real deployment (not caught during development,
-- since local testing used an offline query-builder stub that never
-- validates real column existence against Postgres): both
-- quotation_items and invoice_items were queried with
-- `order('created_at', ...)`, but neither table has ever had a
-- created_at column (see migrations 06 and 08) — every attempt to
-- view or edit a quotation or invoice failed with
-- "column quotation_items.created_at does not exist".
--
-- The fix is NOT simply adding created_at: line items are always
-- inserted as one batch (a single multi-row INSERT per
-- quotation/invoice save), and Postgres evaluates a column's
-- `default now()` once per STATEMENT, not once per ROW — every item
-- in the same save would get the identical timestamp, so ordering by
-- created_at would not reliably preserve the order the user actually
-- entered the items in. An explicit sort_order column, set from the
-- item's array position by the application at insert time, is the
-- only way to guarantee that.
--
-- Existing rows (saved before this migration) have no recoverable
-- signal for their original order — they default to sort_order = 0
-- and will display in whatever order Postgres happens to return
-- them in. That's a real limitation for data saved before this fix,
-- but strictly better than the alternative: those rows were
-- completely unviewable before this migration (the page errored
-- outright), so this makes them visible again even if the item order
-- on old records isn't guaranteed. Every quotation/invoice saved
-- from now on gets a reliable, intentional order.

alter table public.quotation_items add column if not exists sort_order integer not null default 0;
alter table public.invoice_items add column if not exists sort_order integer not null default 0;

create index if not exists idx_quotation_items_sort_order on public.quotation_items (quotation_id, sort_order);
create index if not exists idx_invoice_items_sort_order on public.invoice_items (invoice_id, sort_order);

comment on column public.quotation_items.sort_order is 'Set explicitly from the item''s position in the form when saved — the only reliable way to preserve item order, since a batch insert gives every row the same created_at.';
comment on column public.invoice_items.sort_order is 'Set explicitly from the item''s position in the form when saved — the only reliable way to preserve item order, since a batch insert gives every row the same created_at.';
