import { cellText } from './normalize.js';
import { INVOICE_TITLE_MARKERS, INVOICE_NUMBER_FALLBACK_MARKERS, matchesAny } from './markers.js';

/**
 * @typedef {object} InvoiceBlock
 * @property {string} sheetName
 * @property {number} startRow - 0-indexed, inclusive
 * @property {number} endRow - 0-indexed, inclusive
 */

const MERGE_PROXIMITY_ROWS = 5; // marker rows within this many rows of each other = same invoice's header zone, not two invoices

function findMarkerRows(grid, patterns) {
  const hits = [];
  for (let r = 0; r < grid.rows.length; r++) {
    const row = grid.rows[r];
    for (let c = 0; c < row.length; c++) {
      const text = cellText(row[c]);
      if (text && matchesAny(text, patterns)) {
        hits.push(r);
        break;
      }
    }
  }
  return hits;
}

/** Collapses marker rows that are close together into a single "invoice starts here" row (the first one). */
function collapseMarkers(rowIndices) {
  const collapsed = [];
  for (const r of rowIndices) {
    const last = collapsed[collapsed.length - 1];
    if (last === undefined || r - last > MERGE_PROXIMITY_ROWS) collapsed.push(r);
  }
  return collapsed;
}

/**
 * Splits one sheet's grid into invoice blocks. A new invoice starts
 * wherever a "TAX INVOICE"-style title reappears (the strong,
 * unambiguous signal); if a sheet has none of those at all, falls
 * back to repeated "Invoice No" labels instead. A sheet with a
 * single invoice simply produces one block spanning start-of-sheet
 * (or the sheet's own single marker) to end-of-sheet.
 *
 * @param {import('./workbookReader.js').SheetGrid} grid
 * @returns {InvoiceBlock[]}
 */
export function segmentSheetIntoInvoices(grid) {
  if (grid.rows.length === 0) return [];

  let starts = collapseMarkers(findMarkerRows(grid, INVOICE_TITLE_MARKERS));
  if (starts.length === 0) {
    starts = collapseMarkers(findMarkerRows(grid, INVOICE_NUMBER_FALLBACK_MARKERS));
  }
  if (starts.length === 0) return []; // nothing that looks like an invoice on this sheet at all

  // If content exists before the first marker, it's very likely
  // report boilerplate ("Company Ledger", printed-on date, etc.), not
  // part of an invoice — the first block still starts at its own
  // marker row, not row 0, so junk above it never gets scanned for
  // fields.
  const blocks = [];
  for (let i = 0; i < starts.length; i++) {
    const startRow = starts[i];
    const endRow = i + 1 < starts.length ? starts[i + 1] - 1 : grid.rows.length - 1;
    blocks.push({ sheetName: grid.name, startRow, endRow });
  }
  return blocks;
}
