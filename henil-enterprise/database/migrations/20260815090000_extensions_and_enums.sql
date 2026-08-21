-- ============================================================
-- Henil Enterprise — Database Schema
-- 01. Extensions and shared enum types
-- ============================================================
-- Run this file first. It sets up the extensions and custom types
-- that every later migration in this folder depends on.

-- gen_random_uuid() for primary keys
create extension if not exists "pgcrypto";

-- ---------- Enum types ----------

-- Quotation lifecycle status.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'quotation_status') then
    create type quotation_status as enum (
      'DRAFT',
      'SENT',
      'VIEWED',
      'ACCEPTED',
      'REJECTED',
      'EXPIRED'
    );
  end if;
end $$;

-- Invoice lifecycle status. This also covers "payment status" values
-- (PENDING / PARTIALLY_PAID / PAID / OVERDUE) — an invoice's status
-- IS its payment status once it has been sent, so a separate
-- payment_status type is not needed. See database/README.md for the
-- full explanation of this decision.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum (
      'DRAFT',
      'SENT',
      'PENDING',
      'PARTIALLY_PAID',
      'PAID',
      'OVERDUE',
      'CANCELLED'
    );
  end if;
end $$;

-- Inventory movement direction.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_transaction_type') then
    create type inventory_transaction_type as enum (
      'IN',
      'OUT',
      'ADJUSTMENT'
    );
  end if;
end $$;

-- Internal user role, used by Row Level Security policies once
-- authentication is wired up in a later phase.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum (
      'admin',
      'manager',
      'staff'
    );
  end if;
end $$;
