/*
  Invoices use the identical subtotal/discount/GST/total calculation
  as quotations — same shape, same rounding rules. Rather than
  duplicate that logic, this file re-exports the shared engine under
  invoice-appropriate names so invoice code doesn't read like it's
  importing "quotation" functions. See quotationCalculations.js for
  the full implementation and rounding rationale (that file is the
  single source of truth; this is just a naming layer).
*/
export {
  round2,
  computeItemAmount,
  computeItemGst,
  computeQuotationTotals as computeInvoiceTotals,
} from './quotationCalculations.js';
