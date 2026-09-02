import { cellText, normalizeDate } from './normalize.js';
import { firstNonEmptyRight, firstNonEmptyBelow } from './workbookReader.js';
import {
  INVOICE_NUMBER_LABELS,
  INVOICE_DATE_LABELS,
  DC_NUMBER_LABELS,
  PO_NUMBER_LABELS,
  BUYER_SECTION_LABELS,
  BUYER_NAME_LABELS,
  BUYER_ADDRESS_LABELS,
  NEXT_SECTION_LABELS,
  BUYER_TAX_NUMBER_LABELS,
  COMPANY_TAX_NUMBER_LABELS,
  matchesAny,
} from './markers.js';

/**
 * A label cell's value may be:
 *  - inline in the same cell after a separator ("INVOICE NO-119")
 *  - the next non-empty cell to the right, same row (Sheet2 style)
 *  - the cell directly below it, same column (Sheet1 style, where
 *    the label row and value row are adjacent but not side-by-side)
 */
function readLabelValue(grid, r, c, labelText) {
  const inline = labelText.match(/[-:]\s*(.+)$/);
  if (inline && inline[1].trim()) return { value: inline[1].trim(), row: r, col: c };

  const right = firstNonEmptyRight(grid, r, c);
  if (right) return { value: right.value, row: right.row, col: right.col };

  const below = firstNonEmptyBelow(grid, r, c, 2);
  if (below) return { value: below.value, row: below.row, col: below.col };

  return null;
}

function findFirstLabel(grid, block, labelPatterns) {
  for (let r = block.startRow; r <= block.endRow; r++) {
    const row = grid.rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const text = cellText(row[c]);
      if (text && matchesAny(text, labelPatterns)) {
        const found = readLabelValue(grid, r, c, text);
        if (found) return { ...found, labelRow: r, labelCol: c, labelText: text };
      }
    }
  }
  return null;
}

/**
 * Buyer name + address is a multi-row block, not a single labeled
 * cell, and appears in two shapes across real invoices:
 *   Shape A (no explicit "Name"/"Add-" labels): a "Buyer" section
 *     header, then the company name on the next non-empty row, then
 *     the address on the row(s) after that, until a blank row or the
 *     next known section label.
 *   Shape B (explicit labels): "RECEIVER" section header, "NAME"
 *     label with the value beside it, "ADD-" label with the first
 *     address line beside it, then further address lines below in
 *     the same column with no label at all, until the next known
 *     section label (STATE-, GST NO-, etc).
 */
function extractBuyer(grid, block) {
  const sectionHit = findFirstSectionLabelRow(grid, block, BUYER_SECTION_LABELS);
  if (!sectionHit) return { name: null, address: null };

  // Shape B: an explicit NAME label appears at/after the section header.
  for (let r = sectionHit.row; r <= Math.min(block.endRow, sectionHit.row + 6); r++) {
    const row = grid.rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const text = cellText(row[c]);
      if (text && matchesAny(text, BUYER_NAME_LABELS)) {
        const nameFound = readLabelValue(grid, r, c, text);
        const addrHit = findFirstLabel(
          { rows: grid.rows.slice(0, block.endRow + 1) },
          { startRow: r, endRow: Math.min(block.endRow, r + 6) },
          BUYER_ADDRESS_LABELS
        );
        const addressLines = [];
        if (addrHit) {
          addressLines.push(cellText(addrHit.value));
          // Continuation lines: same column as the address value, no label, until next section label or blank row.
          let rr = addrHit.row + 1;
          while (rr <= block.endRow) {
            const rowVals = grid.rows[rr] || [];
            const candidate = rowVals[addrHit.col];
            const anyLabelOnRow = rowVals.some((v) => cellText(v) && matchesAny(cellText(v), NEXT_SECTION_LABELS));
            if (anyLabelOnRow || candidate === null || candidate === undefined || cellText(candidate) === '') break;
            addressLines.push(cellText(candidate));
            rr++;
          }
        }
        return { name: nameFound ? cellText(nameFound.value) : null, address: addressLines.join(', ') || null };
      }
    }
  }

  // Shape A: name is simply the next non-empty row after the section header; address is the row(s) after that.
  let r = sectionHit.row + 1;
  const lines = [];
  while (r <= block.endRow && lines.length < 4) {
    const row = grid.rows[r] || [];
    const nonEmpty = row.find((v) => cellText(v) !== '');
    const anyLabelOnRow = row.some((v) => cellText(v) && matchesAny(cellText(v), NEXT_SECTION_LABELS));
    if (anyLabelOnRow) break;
    if (nonEmpty === undefined) {
      if (lines.length > 0) break; // a blank row after some content ends the block
    } else {
      lines.push(cellText(nonEmpty));
    }
    r++;
  }
  return { name: lines[0] || null, address: lines.slice(1).join(', ') || null };
}

function findFirstSectionLabelRow(grid, block, labelPatterns) {
  for (let r = block.startRow; r <= block.endRow; r++) {
    const row = grid.rows[r] || [];
    for (const v of row) {
      const text = cellText(v);
      if (text && matchesAny(text, labelPatterns)) return { row: r };
    }
  }
  return null;
}

/**
 * @param {import('./workbookReader.js').SheetGrid} grid
 * @param {import('./invoiceSegmenter.js').InvoiceBlock} block
 */
export function extractHeaderFields(grid, block) {
  const invoiceNumberHit = findFirstLabel(grid, block, INVOICE_NUMBER_LABELS);
  const invoiceDateHit = findFirstLabel(grid, block, INVOICE_DATE_LABELS);
  const dcHit = findFirstLabel(grid, block, DC_NUMBER_LABELS);
  const poHit = findFirstLabel(grid, block, PO_NUMBER_LABELS);
  const buyerTaxHit = findFirstLabel(grid, block, BUYER_TAX_NUMBER_LABELS);
  const companyTaxHit = findFirstLabel(grid, block, COMPANY_TAX_NUMBER_LABELS);
  const buyer = extractBuyer(grid, block);

  const rawInvoiceNumber = invoiceNumberHit ? cellText(invoiceNumberHit.value) : null;
  const rawInvoiceDate = invoiceDateHit ? invoiceDateHit.value : null;
  const invoiceDateIso = rawInvoiceDate !== null ? normalizeDate(rawInvoiceDate) : null;

  return {
    invoice_number: { value: rawInvoiceNumber, raw: rawInvoiceNumber, cell: invoiceNumberHit || null },
    invoice_date: { value: invoiceDateIso, raw: rawInvoiceDate === null ? null : cellText(rawInvoiceDate), cell: invoiceDateHit || null },
    dc_number: { value: dcHit ? cellText(dcHit.value) : null, cell: dcHit || null },
    purchase_order_number: { value: poHit ? cellText(poHit.value) : null, cell: poHit || null },
    buyer_name: { value: buyer.name, cell: null },
    buyer_address: { value: buyer.address, cell: null },
    buyer_tax_number: { value: buyerTaxHit ? cellText(buyerTaxHit.value) : null, cell: buyerTaxHit || null },
    company_tax_number: { value: companyTaxHit ? cellText(companyTaxHit.value) : null, cell: companyTaxHit || null },
  };
}
