-- ============================================================
-- Henil Enterprise — Database Schema
-- 26. Company settings: logo storage + configurable numbering prefixes
-- ============================================================
-- Two things close out "do not hardcode company information":
--
-- 1. A public bucket for the company logo. Public (like 'attachments',
--    unlike the private 'project-files') because buildDocumentPdf.js
--    fetches the logo with a plain fetch(url) call while generating a
--    PDF — that needs a directly-fetchable URL, not a signed one.
--    Write access is ADMIN-only, matching "ADMIN should be able to
--    configure" — nobody else can change the company's logo.
--
-- 2. set_quotation_number()/set_invoice_number() (migrations 18, 19)
--    used a literal 'QT-'/'INV-' prefix, explicitly deferring real
--    configurability ("If the prefix needs to become configurable
--    later, update ... to read from company_settings instead" —
--    database/README.md). Company Settings now lets an admin set
--    quotation_prefix/invoice_prefix, so this is that later: both
--    functions now read the prefix from company_settings, falling
--    back to the original literals if no settings row exists yet.

insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do nothing;

drop policy if exists company_assets_select on storage.objects;
create policy company_assets_select on storage.objects
  for select using (bucket_id = 'company-assets' and auth.uid() is not null);

drop policy if exists company_assets_insert on storage.objects;
create policy company_assets_insert on storage.objects
  for insert with check (bucket_id = 'company-assets' and public.has_module_access('settings'));

drop policy if exists company_assets_delete on storage.objects;
create policy company_assets_delete on storage.objects
  for delete using (bucket_id = 'company-assets' and public.has_module_access('settings'));

-- ---------- Wire numbering to the configurable prefix ----------
create or replace function public.set_quotation_number()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
begin
  if new.quotation_number is null or new.quotation_number = '' then
    select quotation_prefix into v_prefix from public.company_settings where id = 1;
    if v_prefix is null or v_prefix = '' then
      v_prefix := 'QT-';
    end if;
    new.quotation_number := v_prefix || lpad(nextval('public.quotation_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create or replace function public.set_invoice_number()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
begin
  if new.invoice_number is null or new.invoice_number = '' then
    select invoice_prefix into v_prefix from public.company_settings where id = 1;
    if v_prefix is null or v_prefix = '' then
      v_prefix := 'INV-';
    end if;
    new.invoice_number := v_prefix || lpad(nextval('public.invoice_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

comment on function public.set_quotation_number() is
  'Reads quotation_prefix from company_settings (falls back to QT- if no settings row exists). Changing the prefix in Settings only affects new quotations going forward -- existing numbers are never rewritten.';
comment on function public.set_invoice_number() is
  'Reads invoice_prefix from company_settings (falls back to INV- if no settings row exists). Changing the prefix in Settings only affects new invoices going forward -- existing numbers are never rewritten.';
