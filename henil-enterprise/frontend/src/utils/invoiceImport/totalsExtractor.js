import { cellText, normalizeAmount, round2 } from './normalize.js';
import { SUBTOTAL_LABELS, TOTAL_LABELS, matchesAny } from './markers.js';

function findLabeledAmountRow(grid, block, fromRow, labelPatterns) {
  for (let r = fromRow; r <= block.endRow; r++) {
    const row = grid.rows[r] || [];
    const hasLabel = row.some((v) => cellText(v) && matchesAny(cellText(v), labelPatterns));
    if (!hasLabel) continue;
    for (let c = row.length - 1; c >= 0; c--) {
      const amount = normalizeAmount(row[c]);
      if (amount !== null) return { amount, row: r };
    }
  }
  return null;
}

/** Tolerance for the extracted-vs-calculated total comparison — a few paise of rounding drift is expected, real mismatches are usually whole rupees off. */
const TOTAL_MATCH_TOLERANCE = 1;

/**
 * @param {import('./workbookReader.js').SheetGrid} grid
 * @param {import('./invoiceSegmenter.js').InvoiceBlock} block
 * @param {number} itemsEndRow
 * @param {{amount:number}[]} items
 * @param {{amount:number}[]} extraCharges
 * @param {{amount:number}[]} taxLines
 */
export function extractTotals(grid, block, itemsEndRow, items, extraCharges, taxLines) {
  const searchFrom = itemsEndRow !== null ? itemsEndRow + 1 : block.startRow;
  const subtotalHit = findLabeledAmountRow(grid, block, searchFrom, SUBTOTAL_LABELS);
  const totalHit = findLabeledAmountRow(grid, block, searchFrom, TOTAL_LABELS);

  const calculatedItemsSubtotal = round2(items.reduce((s, i) => s + (i.amount || 0), 0));
  const calculatedExtraCharges = round2(extraCharges.reduce((s, c) => s + (c.amount || 0), 0));
  const calculatedSubtotal = round2(calculatedItemsSubtotal + calculatedExtraCharges);
  const calculatedTaxTotal = round2(taxLines.reduce((s, t) => s + (t.amount || 0), 0));
  const calculatedTotal = round2(calculatedSubtotal + calculatedTaxTotal);

  const extractedSubtotal = subtotalHit ? subtotalHit.amount : null;
  const extractedTotal = totalHit ? totalHit.amount : null;

  const totalToCompare = extractedTotal !== null ? extractedTotal : extractedSubtotal !== null ? extractedSubtotal + calculatedTaxTotal : null;
  const totalMatches = totalToCompare === null ? null : Math.abs(round2(totalToCompare) - calculatedTotal) <= TOTAL_MATCH_TOLERANCE;

  return {
    extractedSubtotal,
    extractedTotal,
    calculatedSubtotal,
    calculatedTaxTotal,
    calculatedTotal,
    totalMatches,
  };
}
