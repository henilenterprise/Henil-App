/*
  Single source of truth for Excel/CSV import, template generation,
  and export — every sheet's column list, business key (for
  duplicate detection), and foreign-key references come from here,
  so the template, the validator, and the importer can never drift
  out of sync with each other.

  Columns are pulled directly from the real table schemas in
  database/migrations/ — nothing here is invented. Auto-generated
  columns (id, created_at, updated_at) are deliberately excluded from
  every sheet: users never need to fill those in, and letting them
  try would just create confusion (a pasted id would either collide
  or be silently ignored).

  IMPORT_ORDER matters: sheets are imported in this exact sequence so
  that a child row's foreign-key lookup (e.g. an Invoice's client)
  always resolves against a client that's already been created,
  whether that client came from an earlier sheet in the SAME
  workbook or already existed in the database beforehand.
*/

export const IMPORT_TABLES = {
  clients: {
    sheetName: 'Clients',
    label: 'Clients',
    businessKey: ['company_name'],
    columns: [
      { key: 'company_name', label: 'Company Name', required: true },
      { key: 'contact_person', label: 'Contact Person' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'gst_number', label: 'GST Number' },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'pincode', label: 'Pincode' },
      { key: 'notes', label: 'Notes' },
    ],
  },

  products: {
    sheetName: 'Products',
    label: 'Products',
    businessKey: ['sku'],
    columns: [
      { key: 'name', label: 'Product Name', required: true },
      { key: 'sku', label: 'SKU', required: true },
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' },
      { key: 'material', label: 'Material' },
      { key: 'thickness', label: 'Thickness' },
      { key: 'unit', label: 'Unit', example: 'pcs' },
      { key: 'default_rate', label: 'Default Rate', required: true, type: 'number' },
      { key: 'gst_percentage', label: 'GST %', type: 'number', example: 18 },
      { key: 'is_active', label: 'Active (TRUE/FALSE)', type: 'boolean', example: 'TRUE' },
    ],
  },

  suppliers: {
    sheetName: 'Suppliers',
    label: 'Suppliers',
    businessKey: ['company_name'],
    columns: [
      { key: 'company_name', label: 'Company Name', required: true },
      { key: 'contact_person', label: 'Contact Person' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'gst_number', label: 'GST Number' },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'pincode', label: 'Pincode' },
      { key: 'notes', label: 'Notes' },
    ],
  },

  inventory: {
    sheetName: 'Inventory',
    label: 'Inventory (opening stock)',
    businessKey: null, // see executeImport: re-running this sheet safely ADDS via the same adjustment path the app always uses, never overwrites \u2014 the identical recovery model as any other inventory correction
    dependsOn: ['products'],
    columns: [
      { key: 'product_sku', label: 'Product SKU', required: true, refTable: 'products', refKey: 'sku' },
      { key: 'quantity', label: 'Opening Quantity', required: true, type: 'number' },
      { key: 'minimum_stock', label: 'Reorder At', type: 'number', example: 0 },
    ],
    note: 'Each row sets a product\u2019s STARTING stock via the same safe adjustment path the app itself uses \u2014 it never overwrites a quantity directly. Re-importing the same file again ADDS the quantity a second time (exactly like running the same adjustment twice by hand) rather than silently overwriting \u2014 check Inventory \u2192 Transaction History if you\u2019re ever unsure what an import actually did.',
  },

  expenses: {
    sheetName: 'Expenses',
    label: 'Expenses',
    businessKey: null, // ledger-style; see dataManagementService.js for how duplicates are still soft-detected
    columns: [
      { key: 'date', label: 'Date (YYYY-MM-DD)', required: true, type: 'date' },
      { key: 'category', label: 'Category', required: true },
      { key: 'description', label: 'Description' },
      { key: 'amount', label: 'Amount', required: true, type: 'number' },
      { key: 'payment_method', label: 'Payment Method', example: 'Cash' },
      { key: 'vendor', label: 'Vendor' },
      { key: 'notes', label: 'Notes' },
    ],
  },

  quotations: {
    sheetName: 'Quotations',
    label: 'Quotations',
    businessKey: ['quotation_number'],
    dependsOn: ['clients'],
    columns: [
      { key: 'quotation_number', label: 'Quotation Number', example: '(leave blank to auto-generate)' },
      { key: 'client_company_name', label: 'Client Company Name', required: true, refTable: 'clients', refKey: 'company_name' },
      { key: 'quotation_date', label: 'Quotation Date (YYYY-MM-DD)', type: 'date' },
      { key: 'valid_until', label: 'Valid Until (YYYY-MM-DD)', type: 'date' },
      { key: 'discount', label: 'Discount', type: 'number', example: 0 },
      { key: 'status', label: 'Status', example: 'DRAFT' },
      { key: 'notes', label: 'Notes' },
    ],
    note: 'Subtotal, GST, and Total are always calculated automatically from the Quotation Items sheet \u2014 do not include them here, they cannot be set manually (this matches the app\u2019s own rule that a total must always equal its line items).',
  },

  quotation_items: {
    sheetName: 'Quotation Items',
    label: 'Quotation Items',
    businessKey: null,
    dependsOn: ['quotations', 'products'],
    columns: [
      { key: 'quotation_number', label: 'Quotation Number', required: true, refTable: 'quotations', refKey: 'quotation_number' },
      { key: 'product_sku', label: 'Product SKU (blank for a custom item)', refTable: 'products', refKey: 'sku' },
      { key: 'description', label: 'Description', required: true },
      { key: 'quantity', label: 'Quantity', required: true, type: 'number' },
      { key: 'unit', label: 'Unit', example: 'pcs' },
      { key: 'rate', label: 'Rate', required: true, type: 'number' },
      { key: 'gst_percentage', label: 'GST %', type: 'number', example: 18 },
    ],
    note: 'Amount is always calculated as Quantity \u00d7 Rate \u2014 do not include it, it cannot be set manually.',
  },

  invoices: {
    sheetName: 'Invoices',
    label: 'Invoices',
    businessKey: ['invoice_number'],
    dependsOn: ['clients', 'quotations'],
    columns: [
      { key: 'invoice_number', label: 'Invoice Number', example: '(leave blank to auto-generate)' },
      { key: 'client_company_name', label: 'Client Company Name', required: true, refTable: 'clients', refKey: 'company_name' },
      { key: 'quotation_number', label: 'Converted From Quotation Number (optional)', refTable: 'quotations', refKey: 'quotation_number' },
      { key: 'invoice_date', label: 'Invoice Date (YYYY-MM-DD)', type: 'date' },
      { key: 'due_date', label: 'Due Date (YYYY-MM-DD)', required: true, type: 'date' },
      { key: 'discount', label: 'Discount', type: 'number', example: 0 },
      { key: 'status', label: 'Status', example: 'DRAFT' },
    ],
    note: 'Subtotal, GST, and Total are always calculated automatically from the Invoice Items sheet.',
  },

  invoice_items: {
    sheetName: 'Invoice Items',
    label: 'Invoice Items',
    businessKey: null,
    dependsOn: ['invoices', 'products'],
    columns: [
      { key: 'invoice_number', label: 'Invoice Number', required: true, refTable: 'invoices', refKey: 'invoice_number' },
      { key: 'product_sku', label: 'Product SKU (blank for a custom item)', refTable: 'products', refKey: 'sku' },
      { key: 'description', label: 'Description', required: true },
      { key: 'quantity', label: 'Quantity', required: true, type: 'number' },
      { key: 'unit', label: 'Unit', example: 'pcs' },
      { key: 'rate', label: 'Rate', required: true, type: 'number' },
      { key: 'gst_percentage', label: 'GST %', type: 'number', example: 18 },
    ],
    note: 'Amount is always calculated as Quantity \u00d7 Rate.',
  },

  payments: {
    sheetName: 'Payments',
    label: 'Payments',
    businessKey: null,
    dependsOn: ['invoices'],
    columns: [
      { key: 'invoice_number', label: 'Invoice Number', required: true, refTable: 'invoices', refKey: 'invoice_number' },
      { key: 'amount', label: 'Amount', required: true, type: 'number' },
      { key: 'payment_date', label: 'Payment Date (YYYY-MM-DD)', type: 'date' },
      { key: 'payment_method', label: 'Payment Method', required: true, example: 'Bank Transfer' },
      { key: 'reference_number', label: 'Reference Number' },
      { key: 'notes', label: 'Notes' },
    ],
    note: 'A payment can never push an invoice\u2019s total paid above its total \u2014 rows that would overpay are rejected with an error, the same rule the app enforces everywhere else.',
  },

  inventory_transactions: {
    sheetName: 'Inventory Transactions',
    label: 'Inventory Transactions',
    businessKey: null,
    dependsOn: ['products'],
    columns: [
      { key: 'product_sku', label: 'Product SKU', required: true, refTable: 'products', refKey: 'sku' },
      { key: 'transaction_type', label: 'Type (PURCHASE/USAGE/ADJUSTMENT/DAMAGE/RETURN)', required: true },
      { key: 'quantity', label: 'Quantity', required: true, type: 'number' },
      { key: 'reference', label: 'Reference' },
      { key: 'notes', label: 'Notes' },
    ],
    note: 'Each row is applied through the same safe, atomic stock-change function the app uses everywhere \u2014 never a raw overwrite. A row that would take stock negative is rejected with an error naming the exact row.',
  },

  company_settings: {
    sheetName: 'Company Settings',
    label: 'Company Settings',
    businessKey: 'singleton',
    columns: [
      { key: 'company_name', label: 'Company Name', required: true },
      { key: 'address', label: 'Address' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'gst_number', label: 'GST Number' },
      { key: 'website', label: 'Website' },
      { key: 'quotation_prefix', label: 'Quotation Prefix', example: 'QT-' },
      { key: 'invoice_prefix', label: 'Invoice Prefix', example: 'INV-' },
      { key: 'default_gst', label: 'Default GST %', type: 'number', example: 18 },
      { key: 'payment_terms', label: 'Payment Terms' },
      { key: 'quotation_terms', label: 'Quotation Terms' },
      { key: 'invoice_terms', label: 'Invoice Terms' },
    ],
    note: 'There is only ever one Company Settings record. This sheet always updates it \u2014 it is never duplicated. Logo and bank details are managed from the Settings page, not this import (a logo is a file, not spreadsheet data).',
  },
};

// Dependency-respecting import order. Anything not listed falls back
// to object key order, but every table with a dependsOn is listed
// after everything it depends on.
export const IMPORT_ORDER = [
  'clients',
  'products',
  'suppliers',
  'inventory',
  'expenses',
  'quotations',
  'quotation_items',
  'invoices',
  'invoice_items',
  'payments',
  'inventory_transactions',
  'company_settings',
];

export function getTableConfig(tableKey) {
  return IMPORT_TABLES[tableKey];
}
