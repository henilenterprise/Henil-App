/*
  Quotation calculation engine.

  Deliberately pure, deterministic, and framework-free so it can be
  unit-tested and reused (e.g. by a future Invoices module, which
  uses the identical subtotal/discount/GST/total shape).

  Rounding: every intermediate value is rounded to 2 decimal places
  immediately after computing it, not just at the end — this avoids
  floating-point drift accumulating across many line items (e.g.
  0.1 + 0.2 !== 0.3 in IEEE 754), which matters once real money is
  involved.

  Design (matches the workflow order in the brief):
    item.amount = quantity * rate                          (pre-GST)
    subtotal    = sum(item.amount)
    item GST    = item.amount * (item.gst_percentage / 100)
    gst (total) = sum(item GST)
    total       = subtotal - discount + gst

  `discount` is a flat currency amount (matches quotations.discount's
  numeric column — there is no separate discount-percentage column),
  not a percentage.
*/

export function round2(value) {
  const n = Number(value) || 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeItemAmount(quantity, rate) {
  return round2((Number(quantity) || 0) * (Number(rate) || 0));
}

export function computeItemGst(quantity, rate, gstPercentage) {
  const amount = computeItemAmount(quantity, rate);
  return round2(amount * ((Number(gstPercentage) || 0) / 100));
}

/**
 * @param {Array<{quantity:number, rate:number, gst_percentage:number}>} items
 * @param {number} discount - flat currency amount
 * @returns {{subtotal:number, discount:number, gst:number, total:number}}
 */
export function computeQuotationTotals(items, discount = 0) {
  const subtotal = round2(
    items.reduce((sum, item) => sum + computeItemAmount(item.quantity, item.rate), 0)
  );
  const gst = round2(
    items.reduce((sum, item) => sum + computeItemGst(item.quantity, item.rate, item.gst_percentage), 0)
  );
  const safeDiscount = round2(Math.max(0, Number(discount) || 0));
  const total = round2(Math.max(0, subtotal - safeDiscount + gst));

  return { subtotal, discount: safeDiscount, gst, total };
}
