-- ============================================================
-- Henil Enterprise — Database Schema
-- 21. Prevent payments exceeding the outstanding balance
-- ============================================================
-- "Do not allow payment amounts greater than the outstanding balance
-- unless an explicit overpayment mechanism is implemented." No
-- overpayment mechanism exists, so this is enforced at the database
-- level (not just in the app) — a BEFORE INSERT/UPDATE trigger that
-- rejects any payment whose amount would push the invoice's total
-- paid past its total. This protects against the case app-side
-- validation alone cannot: two payments submitted concurrently that
-- each pass a stale "remaining balance" check.

create or replace function public.check_payment_within_balance()
returns trigger
language plpgsql
as $$
declare
  invoice_total numeric;
  already_paid numeric;
  new_total_paid numeric;
begin
  select total into invoice_total
  from public.invoices
  where id = new.invoice_id;

  if invoice_total is null then
    raise exception 'Invoice % does not exist', new.invoice_id;
  end if;

  select coalesce(sum(amount), 0) into already_paid
  from public.payments
  where invoice_id = new.invoice_id
    and (tg_op = 'INSERT' or id <> new.id);

  new_total_paid := already_paid + new.amount;

  if new_total_paid > invoice_total then
    raise exception
      'Payment of % would exceed the outstanding balance for this invoice (already paid: %, invoice total: %)',
      new.amount, already_paid, invoice_total;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_payment_within_balance on public.payments;

create trigger trg_check_payment_within_balance
  before insert or update on public.payments
  for each row
  execute function public.check_payment_within_balance();

comment on function public.check_payment_within_balance() is
  'Rejects any INSERT/UPDATE on payments that would make total payments for an invoice exceed its total. No overpayment mechanism exists.';
