import { cellText, normalizeAmount } from './normalize.js';
import { isBlankRow } from './workbookReader.js';
import {
  ITEM_COL_DESCRIPTION,
  ITEM_COL_QTY,
  ITEM_COL_UNIT,
  ITEM_COL_RATE,
  ITEM_COL_AMOUNT,
  ITEM_COL_HSN,
  ITEM_COL_SNO,
  SUBTOTAL_LABELS,
  TOTAL_LABELS,
  TAX_NAME_PATTERNS,
  EXTRA_CHARGE_PATTERNS,
  matchesAny,
} from './markers.js';

const MAX_CONSECUTIVE_BLANK_ROWS = 30; // a printed template can reserve many blank rows for line items

function findColumn(headerRow, patterns) {
  for (let c = 0; c < headerRow.length; c++) {
    const text = cellText(headerRow[c]);
    if (text && matchesAny(text, patterns)) return c;
  }
  return -1;
}

/** Locates the item-table header row: needs at least a Description column plus one of Qty/Rate/Amount. */
function findItemHeaderRow(grid, block) {
  for (let r = block.startRow; r <= block.endRow; r++) {
    const row = grid.rows[r] || [];
    const descCol = findColumn(row, ITEM_COL_DESCRIPTION);
    if (descCol === -1) continue;
    const qtyCol = findColumn(row, ITEM_COL_QTY);
    const rateCol = findColumn(row, ITEM_COL_RATE);
    const amountCol = findColumn(row, ITEM_COL_AMOUNT);
    if (qtyCol !== -1 || rateCol !== -1 || amountCol !== -1) {
      return {
        headerRow: r,
        descCol,
        qtyCol,
        unitCol: findColumn(row, ITEM_COL_UNIT),
        rateCol,
        amountCol,
        hsnCol: findColumn(row, ITEM_COL_HSN),
        snoCol: findColumn(row, ITEM_COL_SNO),
      };
    }
  }
  return null;
}

function rowLooksLikeFooterStart(row) {
  const texts = row.map(cellText).filter(Boolean);
  return texts.some((t) => matchesAny(t, SUBTOTAL_LABELS) || matchesAny(t, TOTAL_LABELS));
}

function rowLooksLikeTaxOrCharge(row) {
  const texts = row.map(cellText).filter(Boolean);
  return texts.some((t) => matchesAny(t, TAX_NAME_PATTERNS.map((p) => p.re)) || matchesAny(t, EXTRA_CHARGE_PATTERNS.map((p) => p.re)));
}

/**
 * @returns {{ items: object[], extraCharges: object[], itemsEndRow: number|null, headerFound: boolean }}
 */
export function extractLineItems(grid, block) {
  const header = findItemHeaderRow(grid, block);
  if (!header) return { items: [], extraCharges: [], itemsEndRow: null, headerFound: false };

  const items = [];
  const extraCharges = [];
  let blankStreak = 0;
  let lastItem = null;
  let itemsEndRow = header.headerRow;

  for (let r = header.headerRow + 1; r <= block.endRow; r++) {
    const row = grid.rows[r] || [];

    if (isBlankRow(grid, r)) {
      blankStreak++;
      if (blankStreak > MAX_CONSECUTIVE_BLANK_ROWS) break;
      continue;
    }

    if (rowLooksLikeFooterStart(row)) {
      itemsEndRow = r - 1;
      break;
    }

    if (rowLooksLikeTaxOrCharge(row)) {
      // A charge line (e.g. "P & F") that isn't a tax keyword gets
      // folded in as an extra charge feeding the taxable base; actual
      // tax keyword rows are picked up later by taxExtractor and
      // ignored here entirely.
      const isTax = matchesAny(cellText(row.find((v) => cellText(v)) ?? ''), TAX_NAME_PATTERNS.map((p) => p.re));
      if (!isTax) {
        const chargeLabel = row.map(cellText).find((t) => t && matchesAny(t, EXTRA_CHARGE_PATTERNS.map((p) => p.re)));
        const match = EXTRA_CHARGE_PATTERNS.find((p) => p.re.test(chargeLabel || ''));
        const amount = rightmostAmount(row, header.amountCol);
        if (amount !== null) {
          extraCharges.push({ description: match ? match.name : chargeLabel, amount, sourceRow: r });
        }
      }
      itemsEndRow = r;
      continue; // charges/tax rows sit inside the same footer zone as items on tightly-packed sheets; keep scanning for the real footer
    }

    blankStreak = 0;
    const descRaw = header.descCol !== -1 ? row[header.descCol] : null;
    const desc = cellText(descRaw);
    const qty = header.qtyCol !== -1 ? normalizeAmount(row[header.qtyCol]) : null;
    const rate = header.rateCol !== -1 ? normalizeAmount(row[header.rateCol]) : null;
    const amount = header.amountCol !== -1 ? normalizeAmount(row[header.amountCol]) : null;
    const unit = header.unitCol !== -1 ? cellText(row[header.unitCol]) : '';

    const hasAnyNumber = qty !== null || rate !== null || amount !== null;

    if (!desc && !hasAnyNumber) continue; // fully irrelevant row inside the item zone (stray formatting)

    if (!hasAnyNumber && desc && lastItem) {
      // A description-only continuation line wrapping onto the next row.
      lastItem.description = [lastItem.description, desc].filter(Boolean).join(' ');
      itemsEndRow = r;
      continue;
    }

    const computedAmount = amount !== null ? amount : qty !== null && rate !== null ? Math.round(qty * rate * 100) / 100 : null;

    const item = {
      description: desc || null,
      quantity: qty,
      unit: unit || null,
      rate,
      amount: computedAmount,
      sourceRow: r,
    };
    items.push(item);
    lastItem = item;
    itemsEndRow = r;
  }

  return { items, extraCharges, itemsEndRow, headerFound: true };
}

function rightmostAmount(row, preferredCol) {
  if (preferredCol !== -1) {
    const v = normalizeAmount(row[preferredCol]);
    if (v !== null) return v;
  }
  for (let c = row.length - 1; c >= 0; c--) {
    const v = normalizeAmount(row[c]);
    if (v !== null) return v;
  }
  return null;
}
