import { readWorkbook } from './workbookReader.js';
import { segmentSheetIntoInvoices } from './invoiceSegmenter.js';
import { extractHeaderFields } from './headerExtractor.js';
import { extractLineItems } from './lineItemExtractor.js';
import { extractTaxLines } from './taxExtractor.js';
import { extractTotals } from './totalsExtractor.js';

let counter = 0;
function nextTempId() {
  counter += 1;
  return `parsed-${Date.now()}-${counter}`;
}

/**
 * @typedef {object} ParsedInvoice
 * @property {string} tempId
 * @property {string} sheetName
 * @property {number} startRow
 * @property {number} endRow
 * @property {object} fields - see headerExtractor.js
 * @property {object[]} items
 * @property {object[]} extraCharges
 * @property {object[]} taxLines
 * @property {object} totals - see totalsExtractor.js
 * @property {{code:string, message:string, field?:string}[]} problems
 * @property {'ready'|'needs_review'} status - duplicate/client-match status is layered on later by the service, against the database
 */

function buildProblems({ fields, items, totals }) {
  const problems = [];

  if (!fields.invoice_number.value) {
    problems.push({ code: 'MISSING_INVOICE_NUMBER', message: 'No invoice number could be found for this invoice.', field: 'invoice_number' });
  }

  if (fields.invoice_date.raw !== null && fields.invoice_date.value === null) {
    problems.push({
      code: 'INVALID_DATE',
      message: `The invoice date ("${fields.invoice_date.raw}") could not be understood.`,
      field: 'invoice_date',
      detected: fields.invoice_date.raw,
    });
  } else if (fields.invoice_date.value === null) {
    problems.push({ code: 'MISSING_DATE', message: 'No invoice date could be found for this invoice.', field: 'invoice_date' });
  }

  if (!fields.buyer_name.value) {
    problems.push({ code: 'UNKNOWN_BUYER', message: 'No buyer/client name could be found for this invoice.', field: 'buyer_name' });
  }

  if (items.length === 0) {
    problems.push({ code: 'NO_LINE_ITEMS', message: 'No line items could be found for this invoice.' });
  } else {
    items.forEach((item, idx) => {
      if (!item.description) {
        problems.push({ code: 'MISSING_DESCRIPTION', message: `Line item ${idx + 1} has no description.` });
      }
      if (item.quantity === null && item.rate === null && item.amount === null) {
        problems.push({ code: 'MISSING_ITEM_VALUES', message: `Line item ${idx + 1} has no quantity, rate, or amount.` });
      }
    });
  }

  if (totals.totalMatches === false) {
    problems.push({
      code: 'TOTAL_MISMATCH',
      message: `Extracted total does not match the calculated total from line items and tax.`,
      detected: totals.extractedTotal,
      expected: totals.calculatedTotal,
    });
  } else if (totals.totalMatches === null) {
    problems.push({ code: 'NO_TOTAL_FOUND', message: 'No total or subtotal line could be found to verify against.' });
  }

  return problems;
}

/**
 * @param {File} file
 * @returns {Promise<{fileName:string, fileSize:number, sheetSummaries:object[], invoices:ParsedInvoice[], unrecognizedSheets:string[]}>}
 */
export async function analyzeWorkbook(file) {
  const { fileName, fileSize, sheets } = await readWorkbook(file);

  const invoices = [];
  const sheetSummaries = [];
  const unrecognizedSheets = [];

  for (const grid of sheets) {
    const blocks = segmentSheetIntoInvoices(grid);
    sheetSummaries.push({ name: grid.name, rowCount: grid.rowCount, colCount: grid.colCount, detectedInvoices: blocks.length });
    if (blocks.length === 0 && grid.rowCount > 0) unrecognizedSheets.push(grid.name);

    for (const block of blocks) {
      const fields = extractHeaderFields(grid, block);
      const { items, extraCharges, itemsEndRow } = extractLineItems(grid, block);
      const taxSearchFrom = itemsEndRow !== null ? itemsEndRow + 1 : block.startRow;
      const taxLines = extractTaxLines(grid, block, taxSearchFrom, block.endRow);
      const totals = extractTotals(grid, block, itemsEndRow, items, extraCharges, taxLines);
      const problems = buildProblems({ fields, items, totals });

      invoices.push({
        tempId: nextTempId(),
        sheetName: block.sheetName,
        startRow: block.startRow,
        endRow: block.endRow,
        fields,
        items,
        extraCharges,
        taxLines,
        totals,
        problems,
        status: problems.length > 0 ? 'needs_review' : 'ready',
      });
    }
  }

  return { fileName, fileSize, sheetSummaries, invoices, unrecognizedSheets };
}
