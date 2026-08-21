/*
  Maps each real DB enum value (see database/migrations —
  quotation_status and invoice_status types) to a Badge tone.
  Keys MUST be the exact enum strings used throughout the app
  (ALL_CAPS_WITH_UNDERSCORES) — this file previously used Title Case
  keys like 'Draft'/'Sent' that never matched any real status value,
  which silently made every status badge fall back to the Badge
  component's default 'neutral' tone. Fixed here, and covers every
  value in both enums (VIEWED and CANCELLED were missing entirely).
*/

export const QUOTATION_STATUS_TONE = {
  DRAFT: 'neutral',
  SENT: 'info',
  VIEWED: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
};

export const INVOICE_STATUS_TONE = {
  DRAFT: 'neutral',
  SENT: 'info',
  PENDING: 'warning',
  PARTIALLY_PAID: 'info',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
};
