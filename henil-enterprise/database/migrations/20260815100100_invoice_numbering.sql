-- ============================================================
-- Henil Enterprise — Database Schema
-- 19. Automatic invoice numbering
-- ============================================================
-- Generates invoice_number automatically as INV-00001, INV-00002,
-- ... whenever an invoice is inserted without one already set.
-- Identical pattern to migration 18 (quotation_number_seq) — see
-- that file's comments for the full rationale on why this is a real
-- Postgres sequence rather than app-side "SELECT MAX() + 1".

create sequence if not exists public.invoice_number_seq;

create or replace function public.set_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_invoice_number on public.invoices;

create trigger trg_set_invoice_number
  before insert on public.invoices
  for each row
  execute function public.set_invoice_number();

comment on sequence public.invoice_number_seq is 'Backs the INV-##### auto-numbering on public.invoices. Set by trg_set_invoice_number.';
