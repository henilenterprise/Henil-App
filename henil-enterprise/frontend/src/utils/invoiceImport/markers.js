/*
  Every regex the invoice detector relies on lives here, in one
  place, on purpose: if a future workbook uses a label these don't
  recognize (e.g. "Invoice Ref" instead of "Invoice No"), this is the
  only file that needs a new line added — the detector, extractor,
  and segmenter logic itself never needs to change. This is what the
  brief calls "the detection logic should be configurable".
*/

// A row containing any of these strongly signals "a new invoice
// starts here". Checked first/preferentially over the fallback list.
export const INVOICE_TITLE_MARKERS = [/\btax\s*invoice\b/i, /\bproforma\s*invoice\b/i, /\bcash\s*invoice\b/i];

// Used only when a sheet has ZERO title markers at all — some
// invoice formats omit a "TAX INVOICE" banner entirely.
export const INVOICE_NUMBER_FALLBACK_MARKERS = [
  /^invoice\s*no\.?\s*[-:]?$/i,
  /^invoice\s*number\s*[-:]?$/i,
  /^invoice\s*no\.?\s*-/i,
  /^bill\s*no\.?\s*[-:]?/i,
];

export const INVOICE_NUMBER_LABELS = [/invoice\s*no\.?/i, /invoice\s*number/i, /invoice\s*#/i, /\bbill\s*no\.?/i];

export const INVOICE_DATE_LABELS = [/invoice\s*date/i, /^dated?[\s-]*$/i, /^date\s*&?\s*time/i, /^date$/i];

export const DC_NUMBER_LABELS = [/\bdc\s*no\.?/i, /\bd\.?c\.?\s*number/i, /delivery\s*challan/i];

export const PO_NUMBER_LABELS = [/\bp\.?\s*o\.?\s*no\.?/i, /purchase\s*order\s*(no\.?|number)?/i];

export const BUYER_SECTION_LABELS = [/^buyer$/i, /^receiver$/i, /^bill\s*to$/i, /^consignee$/i];
export const BUYER_NAME_LABELS = [/^name$/i, /^m\/s\.?$/i];
export const BUYER_ADDRESS_LABELS = [/^add[-.:]?$/i, /^address$/i];

export const NEXT_SECTION_LABELS = [
  /^state[-.:]?$/i,
  /^state\s*code[-.:]?$/i,
  /^gst\s*no[-.:]?$/i,
  /^gstin[-.:]?$/i,
  /^shipped\s*to$/i,
  ...BUYER_SECTION_LABELS,
];

export const BUYER_TAX_NUMBER_LABELS = [
  /gstin/i,
  /\bgst\s*no\.?/i,
  /vat\s*tin/i,
  /sales\s*tax\.?\s*no/i,
  /\btin\b/i,
];

export const COMPANY_TAX_NUMBER_LABELS = [/company\s*(vat|gst)\s*tin/i, /^gst\s*number[-:]?/i];

// Item-table header row: a row counts as the header if it has cells
// matching at least DESCRIPTION + (QTY or RATE or AMOUNT).
export const ITEM_COL_DESCRIPTION = [/descri?ption/i, /particulars?/i, /goods/i];
export const ITEM_COL_QTY = [/^qty\.?$/i, /quantity/i];
export const ITEM_COL_UNIT = [/^per$/i, /^unit$/i, /^uom$/i];
export const ITEM_COL_RATE = [/^rate$/i, /^price$/i];
export const ITEM_COL_AMOUNT = [/^amount$/i, /taxable\s*value/i, /^value$/i];
export const ITEM_COL_HSN = [/hsn/i, /sac/i];
export const ITEM_COL_SNO = [/^s\.?\s*no\.?$/i, /^sr\.?\s*no\.?$/i];

export const SUBTOTAL_LABELS = [/sub\s*tot[ae]l/i];
export const TOTAL_LABELS = [/^total$/i, /^grand\s*total$/i, /amount\s*charg(e|i)ble/i, /^invoice\s*total$/i];
export const AMOUNT_IN_WORDS_LABELS = [/amount\s*charg(e|i)ble\s*\(in\s*word/i];

// Rows that LOOK like they contain a tax keyword but are actually
// boilerplate/header text, not an actual tax line to extract.
export const TAX_LINE_EXCLUDE = [
  /tax\s*is\s*payable\s*on\s*reverse\s*charge/i,
  /^tax\s*invoice/i,
  /taxable\s*value/i,
  ...SUBTOTAL_LABELS,
  ...TOTAL_LABELS,
  ...COMPANY_TAX_NUMBER_LABELS,
  ...BUYER_TAX_NUMBER_LABELS,
];

// Named tax components this importer recognizes out of the box.
// Order matters: more specific patterns (ADD.OUTPUT VAT) before
// their substrings (OUTPUT VAT) so the longer name wins.
export const TAX_NAME_PATTERNS = [
  { name: 'ADD. OUTPUT VAT', re: /add\.?\s*output\s*vat/i },
  { name: 'OUTPUT VAT', re: /output\s*vat/i },
  { name: 'CGST', re: /\bc\.?\s*gst\b/i },
  { name: 'SGST', re: /\bs\.?\s*gst\b/i },
  { name: 'IGST', re: /\bi\.?\s*gst\b/i },
  { name: 'UTGST', re: /\but\.?\s*gst\b/i },
  { name: 'CESS', re: /\bcess\b/i },
  { name: 'VAT', re: /\bvat\b/i },
  { name: 'GST', re: /\bgst\b/i },
  { name: 'TAX', re: /\btax\b/i },
];

// Additional (non-tax) charges that legitimately add to the taxable
// base before tax is calculated, e.g. packing & forwarding, freight.
export const EXTRA_CHARGE_PATTERNS = [
  { name: 'Packing & Forwarding', re: /\bp\s*&?\s*f\b|packing\s*(&|and)?\s*forwarding/i },
  { name: 'Freight', re: /\bfreight\b/i },
  { name: 'Transportation', re: /\btransport(ation)?\b/i },
  { name: 'Round Off', re: /round\s*off/i },
];

export function matchesAny(text, patterns) {
  return patterns.some((re) => re.test(text));
}
