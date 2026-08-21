-- ============================================================
-- Henil Enterprise — Database Schema
-- 20. Fix payment_method constraint to the exact specified list
-- ============================================================
-- The original constraint (migration 09) allowed 'Card' as a
-- reasonable guess, but the Payments module brief specifies exactly:
-- Cash, Bank Transfer, UPI, Cheque, Other. Postgres doesn't support
-- altering a CHECK constraint in place, so this drops and recreates
-- it with the corrected list.

alter table public.payments drop constraint if exists chk_payments_method;

alter table public.payments
  add constraint chk_payments_method
  check (payment_method in ('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other'));
