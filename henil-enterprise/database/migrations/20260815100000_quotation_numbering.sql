-- ============================================================
-- Henil Enterprise — Database Schema
-- 18. Automatic quotation numbering
-- ============================================================
-- Generates quotation_number automatically as QT-00001, QT-00002, ...
-- whenever a quotation is inserted without one already set. Backed
-- by a real Postgres sequence, so concurrent inserts can never
-- collide the way an application-side "SELECT MAX() + 1" could.
--
-- The prefix is intentionally the literal 'QT-' (matching the
-- example in the brief) rather than company_settings.quotation_prefix
-- (which defaults to 'QUO-') — see database/README.md for the note
-- on this choice if the prefix needs to become configurable later.

create sequence if not exists public.quotation_number_seq;

create or replace function public.set_quotation_number()
returns trigger
language plpgsql
as $$
begin
  if new.quotation_number is null or new.quotation_number = '' then
    new.quotation_number := 'QT-' || lpad(nextval('public.quotation_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_quotation_number on public.quotations;

create trigger trg_set_quotation_number
  before insert on public.quotations
  for each row
  execute function public.set_quotation_number();

comment on sequence public.quotation_number_seq is 'Backs the QT-##### auto-numbering on public.quotations. Set by trg_set_quotation_number.';
