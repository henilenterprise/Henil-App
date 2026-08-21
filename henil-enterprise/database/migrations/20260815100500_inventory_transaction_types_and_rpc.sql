-- ============================================================
-- Henil Enterprise — Database Schema
-- 23. Inventory transaction types + atomic stock-change RPC
-- ============================================================
-- The original inventory_transaction_type enum (migration 1) had
-- placeholder values (IN/OUT/ADJUSTMENT) chosen before the Inventory
-- module's exact requirements existed. No inventory_transactions
-- rows exist yet (this module is being built now), so it's safe to
-- redefine the type directly rather than needing a data migration.

-- ---------- Redefine the enum ----------
alter table public.inventory_transactions alter column transaction_type drop default;
alter table public.inventory_transactions alter column transaction_type type text using transaction_type::text;

drop type if exists public.inventory_transaction_type;

create type public.inventory_transaction_type as enum (
  'PURCHASE',
  'USAGE',
  'ADJUSTMENT',
  'DAMAGE',
  'RETURN'
);

alter table public.inventory_transactions
  alter column transaction_type type public.inventory_transaction_type
  using transaction_type::public.inventory_transaction_type;

alter table public.inventory_transactions alter column transaction_type set not null;

-- ---------- Quantity sign rules ----------
-- Every type except ADJUSTMENT always represents a positive
-- magnitude (direction is implied by the type: PURCHASE/RETURN add
-- to stock, USAGE/DAMAGE remove from it). ADJUSTMENT is the one type
-- that can go either direction (a physical stock count came in
-- higher or lower than recorded), so its quantity is a signed delta
-- and may be negative, but never zero (a zero-quantity "adjustment"
-- isn't a real transaction).
alter table public.inventory_transactions drop constraint if exists chk_inventory_transactions_quantity;
alter table public.inventory_transactions
  add constraint chk_inventory_transactions_quantity
  check (
    (transaction_type = 'ADJUSTMENT' and quantity <> 0)
    or (transaction_type <> 'ADJUSTMENT' and quantity > 0)
  );

-- ---------- The only safe way to change stock ----------
-- "Never silently overwrite inventory" + "maintained safely with
-- transactional updates": public.inventory.quantity is NEVER set
-- directly by the application. This function is the sole write path
-- — it inserts the ledger row and updates the running balance in one
-- atomic database transaction (a PL/pgSQL function body is part of
-- the caller's transaction; if it raises, nothing it did commits).
-- `for update` locks the inventory row for the duration, so two
-- concurrent calls for the same product can't both read the same
-- starting balance and silently clobber each other.
--
-- If no public.inventory row exists yet for this product, one is
-- created starting at 0 — this is what makes "opening stock" work:
-- it's just the first ADJUSTMENT ever recorded for that product,
-- going through the exact same safe path as every later change.
create or replace function public.record_inventory_transaction(
  p_product_id uuid,
  p_transaction_type public.inventory_transaction_type,
  p_quantity numeric,
  p_reference text default null,
  p_notes text default null
)
returns public.inventory
language plpgsql
security invoker
as $$
declare
  v_delta numeric;
  v_current_qty numeric;
  v_new_qty numeric;
  v_result public.inventory;
begin
  if p_transaction_type = 'ADJUSTMENT' then
    if p_quantity = 0 then
      raise exception 'Adjustment quantity cannot be zero.';
    end if;
    v_delta := p_quantity;
  else
    if p_quantity is null or p_quantity <= 0 then
      raise exception 'Quantity must be greater than zero for % transactions.', p_transaction_type;
    end if;
    if p_transaction_type in ('PURCHASE', 'RETURN') then
      v_delta := p_quantity;
    elsif p_transaction_type in ('USAGE', 'DAMAGE') then
      v_delta := -p_quantity;
    else
      raise exception 'Unknown transaction type %', p_transaction_type;
    end if;
  end if;

  select quantity into v_current_qty
  from public.inventory
  where product_id = p_product_id
  for update;

  if not found then
    v_current_qty := 0;
    insert into public.inventory (product_id, quantity, minimum_stock)
    values (p_product_id, 0, 0);
  end if;

  v_new_qty := v_current_qty + v_delta;

  if v_new_qty < 0 then
    raise exception
      'This % of % would take stock below zero (current stock: %, requested change: %).',
      p_transaction_type, abs(p_quantity), v_current_qty, v_delta;
  end if;

  insert into public.inventory_transactions (product_id, transaction_type, quantity, reference, notes)
  values (p_product_id, p_transaction_type, p_quantity, p_reference, p_notes);

  update public.inventory
  set quantity = v_new_qty, updated_at = now()
  where product_id = p_product_id
  returning * into v_result;

  return v_result;
end;
$$;

comment on function public.record_inventory_transaction is
  'Sole write path for inventory quantity changes. Inserts the ledger row and updates the running balance atomically; raises rather than allowing stock to go negative. Never call this with a raw quantity SET — it always applies a delta.';
