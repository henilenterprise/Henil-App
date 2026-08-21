import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient.js';
import { IMPORT_TABLES, IMPORT_ORDER } from '../utils/dataManagement/importSchema.js';
import { computeItemAmount, computeQuotationTotals, round2 } from '../utils/quotationCalculations.js';
import { createClient, updateClient } from './clientsService.js';
import { createProduct, updateProduct } from './productsService.js';
import { createSupplier, updateSupplier } from './suppliersService.js';
import { createExpense } from './expensesService.js';
import { createQuotation, updateQuotationStatus } from './quotationsService.js';
import { createInvoice, updateInvoiceStatus } from './invoicesService.js';
import { createPayment } from './paymentsService.js';
import { recordInventoryTransaction, updateMinimumStock } from './inventoryService.js';
import { getCompanySettings, updateCompanySettings } from './companySettingsService.js';

/*
  Data Management: Excel/CSV import, export, and template generation.

  This deliberately does NOT reimplement insert logic. Every row is
  created through the exact same service function the rest of the
  app uses (createClient, createQuotation, recordInventoryTransaction,
  ...) so imported data goes through the identical validation,
  calculations, and safety checks as anything entered by hand in the
  UI — a bulk-imported quotation's total is computed the same way, a
  bulk-imported payment can't overpay an invoice, a bulk-imported
  stock change can't take inventory negative, exactly as if a person
  had typed each one in.

  All 12 sheets/tables are defined once in
  utils/dataManagement/importSchema.js and read from here — nothing
  about columns or business keys is duplicated.
*/

const PAGE_FETCH_SIZE = 1000; // PostgREST's practical per-request cap

// ---------------- Template ----------------

export function buildTemplateWorkbook() {
  const wb = XLSX.utils.book_new();

  const instructionsRows = [
    ['Henil Enterprise \u2014 Data Import Template'],
    [''],
    ['How to use this workbook:'],
    ['1. Fill in one row per record on each sheet. Do not rename the sheets or the header row.'],
    ['2. Leave a cell blank if you don\u2019t have that information \u2014 only bold-required columns must be filled in.'],
    ['3. Columns referencing another sheet (e.g. a Client Company Name on the Quotations sheet) must exactly match an existing row on that sheet, or a row you\u2019re also adding in this same workbook.'],
    ['4. Upload the completed file from Data Management \u2192 Import Data. You will see a full preview before anything is saved.'],
    [''],
    ['Sheet-by-sheet notes:'],
  ];
  for (const table of Object.values(IMPORT_TABLES)) {
    if (table.note) instructionsRows.push([`${table.sheetName}: ${table.note}`]);
  }
  const introSheet = XLSX.utils.aoa_to_sheet(instructionsRows);
  introSheet['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, introSheet, 'Instructions');

  for (const table of Object.values(IMPORT_TABLES)) {
    const headers = table.columns.map((c) => c.label);
    const exampleRow = table.columns.map((c) => (c.example !== undefined ? c.example : ''));
    const rows = [headers, exampleRow];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = table.columns.map((c) => ({ wch: Math.max(18, c.label.length + 2) }));
    XLSX.utils.book_append_sheet(wb, sheet, table.sheetName);
  }

  return wb;
}

export function downloadTemplate() {
  const wb = buildTemplateWorkbook();
  XLSX.writeFile(wb, 'Henil-Enterprise-Import-Template.xlsx');
}

// ---------------- Parsing an uploaded file ----------------

/**
 * @param {File} file
 * @returns {Promise<{sheets: Record<string, object[]>, sheetNames: string[], isCsv: boolean}>}
 *   `sheets` keys are the RAW sheet names found in the file (or a
 *   single synthetic key for a CSV, since CSVs have no sheet name) —
 *   matching them to a known table happens in validateImportData so
 *   the UI can show "this sheet wasn't recognized" as a warning
 *   rather than silently dropping it.
 */
export async function parseWorkbookFile(file) {
  const buffer = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name);
  const wb = XLSX.read(buffer, { type: 'array' });

  const sheets = {};
  for (const sheetName of wb.SheetNames) {
    if (sheetName.toLowerCase() === 'instructions') continue;
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    sheets[sheetName] = rows;
  }

  return { sheets, sheetNames: Object.keys(sheets), isCsv };
}

/** Matches a raw sheet name from the uploaded file to a known table key, tolerant of case/whitespace. */
function matchTableForSheetName(sheetName) {
  const normalized = sheetName.trim().toLowerCase();
  for (const [key, table] of Object.entries(IMPORT_TABLES)) {
    if (table.sheetName.trim().toLowerCase() === normalized) return key;
  }
  return null;
}

/** Reverse-maps a row's human-readable column labels back to canonical field keys. */
function normalizeRow(rawRow, table) {
  const out = {};
  for (const col of table.columns) {
    // Tolerant match: exact label, or the raw key itself (in case a
    // user's CSV uses machine-readable headers instead of the
    // template's human-readable ones).
    const value =
      rawRow[col.label] !== undefined
        ? rawRow[col.label]
        : rawRow[col.key] !== undefined
        ? rawRow[col.key]
        : '';
    out[col.key] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
}

// ---------------- Lookup caches (existing DB records, for FK + duplicate resolution) ----------------

async function fetchAllRows(table, columns) {
  const all = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE_FETCH_SIZE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_FETCH_SIZE) break;
    from += PAGE_FETCH_SIZE;
  }
  return all;
}

async function buildLookupCaches() {
  const [clients, products, suppliers, quotations, invoices] = await Promise.all([
    fetchAllRows('clients', 'id, company_name'),
    fetchAllRows('products', 'id, sku'),
    fetchAllRows('suppliers', 'id, company_name'),
    fetchAllRows('quotations', 'id, quotation_number'),
    fetchAllRows('invoices', 'id, invoice_number'),
  ]);
  return {
    clients: { rows: clients, keyField: 'company_name' },
    products: { rows: products, keyField: 'sku' },
    suppliers: { rows: suppliers, keyField: 'company_name' },
    quotations: { rows: quotations, keyField: 'quotation_number' },
    invoices: { rows: invoices, keyField: 'invoice_number' },
  };
}

/** Finds matches for `value` against a cache's key field, case-insensitively. Returns the list of matching ids (0, 1, or >1 = ambiguous). */
function lookupIds(cache, value) {
  if (!value) return [];
  const needle = String(value).trim().toLowerCase();
  return cache.rows.filter((r) => String(r[cache.keyField] ?? '').trim().toLowerCase() === needle).map((r) => r.id);
}

export { buildLookupCaches, lookupIds, normalizeRow, matchTableForSheetName, fetchAllRows };

// ---------------- Validation ----------------

function isEmpty(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

function parseNumber(v) {
  if (isEmpty(v)) return null;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n; // undefined = "was present but not a valid number"
}

function parseDateStr(v) {
  if (isEmpty(v)) return null;
  const s = String(v).trim();
  // Accept plain YYYY-MM-DD, or an Excel-parsed JS Date already converted to an ISO-ish string.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

/**
 * @returns {Promise<{tables: Record<string, {sheetFound:boolean, rows: object[], counts: object}>, unmatchedSheets: string[]}>}
 */
export async function validateImportData(sheets) {
  const caches = await buildLookupCaches();
  // Staged business-key -> true, per table, for rows in THIS import
  // that passed validation and will exist once import runs — lets
  // dependent sheets (e.g. Quotations referencing a brand-new Client
  // in the same workbook) resolve correctly before anything is saved.
  const staged = {
    clients: new Set(),
    products: new Set(),
    suppliers: new Set(),
    quotations: new Set(),
    invoices: new Set(),
  };

  const sheetNameByTable = {};
  const unmatchedSheets = [];
  for (const rawName of Object.keys(sheets)) {
    const key = matchTableForSheetName(rawName);
    if (key) sheetNameByTable[key] = rawName;
    else unmatchedSheets.push(rawName);
  }

  const result = { tables: {}, unmatchedSheets };

  for (const tableKey of IMPORT_ORDER) {
    const table = IMPORT_TABLES[tableKey];
    const rawSheetName = sheetNameByTable[tableKey];
    if (!rawSheetName) {
      result.tables[tableKey] = { sheetFound: false, rows: [], counts: { valid: 0, warnings: 0, errors: 0, duplicates: 0 } };
      continue;
    }

    const rawRows = sheets[rawSheetName];
    const validatedRows = [];
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    rawRows.forEach((rawRow, idx) => {
      const excelRowNumber = idx + 2; // header is row 1
      const data = normalizeRow(rawRow, table);
      const messages = [];
      let hasError = false;

      // Skip fully-blank rows silently (common at the end of a sheet).
      const allBlank = table.columns.every((c) => isEmpty(data[c.key]));
      if (allBlank) return;

      for (const col of table.columns) {
        const value = data[col.key];
        if (col.required && isEmpty(value)) {
          messages.push({ level: 'error', text: `${col.label} is required.` });
          hasError = true;
          continue;
        }
        if (isEmpty(value)) continue;

        if (col.type === 'number') {
          const n = parseNumber(value);
          if (n === undefined) {
            messages.push({ level: 'error', text: `${col.label} must be a number (got "${value}").` });
            hasError = true;
          } else {
            data[col.key] = n;
          }
        }
        if (col.type === 'date') {
          const d = parseDateStr(value);
          if (d === undefined) {
            messages.push({ level: 'error', text: `${col.label} must be a valid date (got "${value}").` });
            hasError = true;
          } else {
            data[col.key] = d;
          }
        }
        if (col.type === 'boolean') {
          const s = String(value).trim().toLowerCase();
          data[col.key] = ['true', '1', 'yes', 'y'].includes(s);
        }

        if (col.refTable) {
          const cache = caches[col.refTable];
          const stagedSet = staged[col.refTable];
          const needle = String(value).trim().toLowerCase();
          const isStaged = stagedSet && stagedSet.has(needle);
          const matches = cache ? lookupIds(cache, value) : [];
          if (!isStaged && matches.length === 0) {
            messages.push({ level: 'error', text: `${col.label} "${value}" was not found in ${IMPORT_TABLES[col.refTable]?.sheetName ?? col.refTable} (existing records or this workbook).` });
            hasError = true;
          } else if (!isStaged && matches.length > 1) {
            messages.push({ level: 'error', text: `${col.label} "${value}" matches more than one existing record \u2014 rename one so it's unambiguous.` });
            hasError = true;
          }
        }
      }

      // Duplicate detection (business-key tables only).
      let isDuplicate = false;
      let existingId = null;
      if (!hasError && table.businessKey && table.businessKey !== 'singleton' && Array.isArray(table.businessKey)) {
        const keyCol = table.businessKey[0];
        const keyVal = data[keyCol];
        if (!isEmpty(keyVal)) {
          const cache = caches[tableKey];
          const matches = cache ? lookupIds(cache, keyVal) : [];
          if (matches.length === 1) {
            isDuplicate = true;
            existingId = matches[0];
            messages.push({ level: 'warning', text: `A ${table.label.replace(/s$/, '')} with this ${table.columns.find((c) => c.key === keyCol)?.label ?? keyCol} already exists.` });
          } else if (matches.length > 1) {
            messages.push({ level: 'error', text: `Multiple existing records already share this ${keyCol} \u2014 cannot safely determine which one this refers to.` });
            hasError = true;
          }
        }
      }

      const status = hasError ? 'error' : isDuplicate ? 'duplicate' : 'valid';
      if (status === 'error') errorCount += 1;
      else if (status === 'duplicate') duplicateCount += 1;
      else validCount += 1;
      if (messages.some((m) => m.level === 'warning') && status !== 'error') warningCount += 1;

      // Stage this row's business key so later sheets can reference it, even if it's a duplicate
      // (a duplicate still "exists" for FK-resolution purposes either way).
      if (status !== 'error' && table.businessKey && Array.isArray(table.businessKey) && staged[tableKey]) {
        const keyVal = data[table.businessKey[0]];
        if (!isEmpty(keyVal)) staged[tableKey].add(String(keyVal).trim().toLowerCase());
      }

      validatedRows.push({
        rowNumber: excelRowNumber,
        data,
        status,
        messages,
        resolution: status === 'duplicate' ? 'skip' : 'create',
        existingId,
      });
    });

    result.tables[tableKey] = {
      sheetFound: true,
      rows: validatedRows,
      counts: { valid: validCount, warnings: warningCount, errors: errorCount, duplicates: duplicateCount },
    };
  }

  return result;
}

// ---------------- Import execution ----------------

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {object} validationResult - from validateImportData()
 * @param {(progress: {tableKey:string, tableLabel:string, done:number, total:number}) => void} onProgress
 * @returns {Promise<{summary: Record<string, {created:number, updated:number, skipped:number, failed:number}>, errors: Array<{table:string, row:number, message:string}>}>}
 */
export async function executeImport(validationResult, onProgress) {
  const idMaps = { clients: new Map(), products: new Map(), suppliers: new Map(), quotations: new Map(), invoices: new Map() };
  // Falls back to here whenever a referenced business key wasn't
  // part of THIS import run at all \u2014 e.g. importing a Payments-only
  // file against invoices that already existed before this import.
  const existingCaches = await buildLookupCaches();
  const summary = {};
  const runErrors = [];

  function keyOf(v) {
    return String(v ?? '').trim().toLowerCase();
  }
  function resolveId(refTable, value) {
    const fromThisImport = idMaps[refTable]?.get(keyOf(value));
    if (fromThisImport) return fromThisImport;
    const cache = existingCaches[refTable];
    if (!cache) return null;
    const matches = lookupIds(cache, value);
    return matches.length === 1 ? matches[0] : null;
  }

  for (const tableKey of IMPORT_ORDER) {
    const table = IMPORT_TABLES[tableKey];
    const tableResult = validationResult.tables[tableKey];
    summary[tableKey] = { created: 0, updated: 0, skipped: 0, failed: 0 };
    if (!tableResult || !tableResult.sheetFound) continue;

    const rowsToProcess = tableResult.rows.filter((r) => r.status !== 'error');
    let done = 0;
    const total = rowsToProcess.length;

    for (const row of rowsToProcess) {
      onProgress?.({ tableKey, tableLabel: table.label, done, total });
      done += 1;
      try {
        await importOneRow(tableKey, row, idMaps, keyOf, resolveId);
        if (row.status === 'duplicate') {
          if (row.resolution === 'skip') summary[tableKey].skipped += 1;
          else if (row.resolution === 'update') summary[tableKey].updated += 1;
          else summary[tableKey].created += 1;
        } else {
          summary[tableKey].created += 1;
        }
      } catch (err) {
        summary[tableKey].failed += 1;
        runErrors.push({ table: table.label, row: row.rowNumber, message: err?.message || String(err) });
      }
    }
    onProgress?.({ tableKey, tableLabel: table.label, done: total, total });
  }

  return { summary, errors: runErrors };
}

async function importOneRow(tableKey, row, idMaps, keyOf, resolveId) {
  const { data, resolution, existingId } = row;

  if (tableKey === 'clients') {
    if (row.status === 'duplicate' && resolution === 'skip') {
      idMaps.clients.set(keyOf(data.company_name), existingId);
      return;
    }
    const payload = stripRefFields(data);
    const created =
      row.status === 'duplicate' && resolution === 'update'
        ? await updateClient(existingId, payload)
        : await createClient(payload);
    idMaps.clients.set(keyOf(data.company_name), created.id);
    return;
  }

  if (tableKey === 'products') {
    if (row.status === 'duplicate' && resolution === 'skip') {
      idMaps.products.set(keyOf(data.sku), existingId);
      return;
    }
    const payload = { ...stripRefFields(data), is_active: data.is_active === '' || data.is_active === undefined ? true : Boolean(data.is_active) };
    const created =
      row.status === 'duplicate' && resolution === 'update'
        ? await updateProduct(existingId, payload)
        : await createProduct(payload);
    idMaps.products.set(keyOf(data.sku), created.id);
    return;
  }

  if (tableKey === 'suppliers') {
    if (row.status === 'duplicate' && resolution === 'skip') {
      idMaps.suppliers.set(keyOf(data.company_name), existingId);
      return;
    }
    const payload = stripRefFields(data);
    const created =
      row.status === 'duplicate' && resolution === 'update'
        ? await updateSupplier(existingId, payload)
        : await createSupplier(payload);
    idMaps.suppliers.set(keyOf(data.company_name), created.id);
    return;
  }

  if (tableKey === 'inventory') {
    const productId = resolveId('products', data.product_sku);
    if (!productId) throw new Error(`Product SKU "${data.product_sku}" could not be resolved.`);
    if (Number(data.quantity) > 0) {
      await recordInventoryTransaction({
        product_id: productId,
        transaction_type: 'ADJUSTMENT',
        quantity: Number(data.quantity),
        reference: 'Opening stock (import)',
        notes: null,
      });
    }
    if (!isEmpty(data.minimum_stock)) {
      await updateMinimumStock(productId, Number(data.minimum_stock));
    }
    return;
  }

  if (tableKey === 'expenses') {
    await createExpense({
      date: data.date || todayIso(),
      category: data.category,
      description: data.description || null,
      amount: Number(data.amount),
      payment_method: data.payment_method || null,
      vendor: data.vendor || null,
      notes: data.notes || null,
    });
    return;
  }

  if (tableKey === 'quotations') {
    if (row.status === 'duplicate' && resolution === 'skip') {
      idMaps.quotations.set(keyOf(data.quotation_number), existingId);
      return;
    }
    const clientId = resolveId('clients', data.client_company_name);
    if (!clientId) throw new Error(`Client "${data.client_company_name}" could not be resolved.`);
    const created = await createQuotation(
      {
        client_id: clientId,
        quotation_date: data.quotation_date || todayIso(),
        valid_until: data.valid_until || null,
        discount: data.discount || 0,
        notes: data.notes || null,
      },
      []
    );
    if (data.status && data.status.toUpperCase() !== 'DRAFT') {
      await updateQuotationStatus(created.id, data.status.toUpperCase());
    }
    idMaps.quotations.set(keyOf(data.quotation_number || created.quotation_number), created.id);
    return;
  }

  if (tableKey === 'quotation_items') {
    const quotationId = resolveId('quotations', data.quotation_number);
    if (!quotationId) throw new Error(`Quotation "${data.quotation_number}" could not be resolved.`);
    const productId = data.product_sku ? resolveId('products', data.product_sku) : null;
    await appendQuotationItem(quotationId, {
      product_id: productId || null,
      description: data.description,
      quantity: Number(data.quantity),
      unit: data.unit || 'pcs',
      rate: Number(data.rate),
      gst_percentage: isEmpty(data.gst_percentage) ? 18 : Number(data.gst_percentage),
    });
    return;
  }

  if (tableKey === 'invoices') {
    if (row.status === 'duplicate' && resolution === 'skip') {
      idMaps.invoices.set(keyOf(data.invoice_number), existingId);
      return;
    }
    const clientId = resolveId('clients', data.client_company_name);
    if (!clientId) throw new Error(`Client "${data.client_company_name}" could not be resolved.`);
    const quotationId = data.quotation_number ? resolveId('quotations', data.quotation_number) : null;
    const created = await createInvoice(
      {
        client_id: clientId,
        quotation_id: quotationId || null,
        invoice_date: data.invoice_date || todayIso(),
        due_date: data.due_date,
        discount: data.discount || 0,
      },
      []
    );
    if (data.status && data.status.toUpperCase() !== 'DRAFT') {
      await updateInvoiceStatus(created.id, data.status.toUpperCase());
    }
    idMaps.invoices.set(keyOf(data.invoice_number || created.invoice_number), created.id);
    return;
  }

  if (tableKey === 'invoice_items') {
    const invoiceId = resolveId('invoices', data.invoice_number);
    if (!invoiceId) throw new Error(`Invoice "${data.invoice_number}" could not be resolved.`);
    const productId = data.product_sku ? resolveId('products', data.product_sku) : null;
    await appendInvoiceItem(invoiceId, {
      product_id: productId || null,
      description: data.description,
      quantity: Number(data.quantity),
      unit: data.unit || 'pcs',
      rate: Number(data.rate),
      gst_percentage: isEmpty(data.gst_percentage) ? 18 : Number(data.gst_percentage),
    });
    return;
  }

  if (tableKey === 'payments') {
    const invoiceId = resolveId('invoices', data.invoice_number);
    if (!invoiceId) throw new Error(`Invoice "${data.invoice_number}" could not be resolved.`);
    await createPayment({
      invoice_id: invoiceId,
      amount: Number(data.amount),
      payment_date: data.payment_date || todayIso(),
      payment_method: data.payment_method,
      reference_number: data.reference_number || null,
      notes: data.notes || null,
    });
    return;
  }

  if (tableKey === 'inventory_transactions') {
    const productId = resolveId('products', data.product_sku);
    if (!productId) throw new Error(`Product SKU "${data.product_sku}" could not be resolved.`);
    await recordInventoryTransaction({
      product_id: productId,
      transaction_type: String(data.transaction_type).toUpperCase(),
      quantity: Number(data.quantity),
      reference: data.reference || null,
      notes: data.notes || null,
    });
    return;
  }

  if (tableKey === 'company_settings') {
    const existing = await getCompanySettings();
    await updateCompanySettings({
      ...existing,
      company_name: data.company_name,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      gst_number: data.gst_number || null,
      website: data.website || null,
      quotation_prefix: data.quotation_prefix || existing.quotation_prefix,
      invoice_prefix: data.invoice_prefix || existing.invoice_prefix,
      default_gst: isEmpty(data.default_gst) ? existing.default_gst : Number(data.default_gst),
      payment_terms: data.payment_terms || null,
      quotation_terms: data.quotation_terms || null,
      invoice_terms: data.invoice_terms || null,
    });
    return;
  }

  throw new Error(`No import handler for table "${tableKey}".`);
}

function stripRefFields(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v === '' ? null : v;
  }
  return out;
}

// Line items must respect the same sort_order + amount-consistency
// rules as the rest of the app (see migration 28 and the security
// audit's financial-consistency constraints) — appending one row at
// a time via a plain insert, computing amount the same way
// computeQuotationTotals does, and updating the parent's totals to
// match, rather than writing a parallel insert path.
async function appendQuotationItem(quotationId, item) {
  const { data: existingItems, error: fetchErr } = await supabase
    .from('quotation_items')
    .select('*')
    .eq('quotation_id', quotationId)
    .order('sort_order', { ascending: true });
  if (fetchErr) throw fetchErr;

  const amount = computeItemAmount(item.quantity, item.rate);
  const { error: insertErr } = await supabase.from('quotation_items').insert({
    quotation_id: quotationId,
    product_id: item.product_id,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    rate: item.rate,
    gst_percentage: item.gst_percentage,
    amount,
    sort_order: existingItems.length,
  });
  if (insertErr) throw insertErr;

  const allItems = [...existingItems, { ...item, amount }];
  const { data: quotation, error: qErr } = await supabase.from('quotations').select('discount').eq('id', quotationId).single();
  if (qErr) throw qErr;
  const totals = computeQuotationTotals(allItems, quotation.discount);
  const { error: updateErr } = await supabase
    .from('quotations')
    .update({ subtotal: totals.subtotal, gst: totals.gst, total: totals.total })
    .eq('id', quotationId);
  if (updateErr) throw updateErr;
}

async function appendInvoiceItem(invoiceId, item) {
  const { data: existingItems, error: fetchErr } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true });
  if (fetchErr) throw fetchErr;

  const amount = computeItemAmount(item.quantity, item.rate);
  const { error: insertErr } = await supabase.from('invoice_items').insert({
    invoice_id: invoiceId,
    product_id: item.product_id,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    rate: item.rate,
    gst_percentage: item.gst_percentage,
    amount,
    sort_order: existingItems.length,
  });
  if (insertErr) throw insertErr;

  const allItems = [...existingItems, { ...item, amount }];
  const { data: invoice, error: iErr } = await supabase.from('invoices').select('discount').eq('id', invoiceId).single();
  if (iErr) throw iErr;
  const totals = computeQuotationTotals(allItems, invoice.discount);
  const { error: updateErr } = await supabase
    .from('invoices')
    .update({ subtotal: totals.subtotal, gst: totals.gst, total: totals.total })
    .eq('id', invoiceId);
  if (updateErr) throw updateErr;
}

// ---------------- Export ----------------

/**
 * Fetches every business table and builds one workbook with a sheet
 * per table, using the same human-readable column labels as the
 * import template (so an exported file can be re-imported elsewhere
 * as a genuine backup/migration, not just a read-only dump) and
 * resolving foreign keys back to business-key text (a client's real
 * name, not an opaque UUID no human could use).
 *
 * Deliberately excludes `users` and anything auth-related \u2014 no
 * passwords, API keys, or session data ever touch this file, only
 * the same business tables the rest of Data Management works with.
 */
export async function exportAllData(onProgress) {
  const wb = XLSX.utils.book_new();

  const [clients, products, suppliers, quotations, invoices] = await Promise.all([
    fetchAllRows('clients', '*'),
    fetchAllRows('products', '*'),
    fetchAllRows('suppliers', '*'),
    fetchAllRows('quotations', '*'),
    fetchAllRows('invoices', '*'),
  ]);
  const clientNameById = new Map(clients.map((c) => [c.id, c.company_name]));
  const productSkuById = new Map(products.map((p) => [p.id, p.sku]));
  const quotationNumberById = new Map(quotations.map((q) => [q.id, q.quotation_number]));
  const invoiceNumberById = new Map(invoices.map((i) => [i.id, i.invoice_number]));

  const tableData = {
    clients,
    products,
    suppliers,
    quotations,
    invoices,
  };

  const remaining = ['inventory', 'expenses', 'quotation_items', 'invoice_items', 'payments', 'inventory_transactions'];
  for (const key of remaining) {
    onProgress?.({ tableKey: key, tableLabel: IMPORT_TABLES[key].label });
    tableData[key] = await fetchAllRows(key, '*');
  }
  tableData.company_settings = [await getCompanySettings()];

  const resolvers = {
    client_id: (id) => clientNameById.get(id) || '',
    product_id: (id) => (id ? productSkuById.get(id) || '' : ''),
    quotation_id: (id) => (id ? quotationNumberById.get(id) || '' : ''),
    invoice_id: (id) => invoiceNumberById.get(id) || '',
  };

  for (const [tableKey, table] of Object.entries(IMPORT_TABLES)) {
    const rows = tableData[tableKey] || [];
    const headers = table.columns.map((c) => c.label);
    const aoa = [headers];
    for (const row of rows) {
      const line = table.columns.map((col) => {
        if (col.key === 'client_company_name') return resolvers.client_id(row.client_id);
        if (col.key === 'product_sku') return resolvers.product_id(row.product_id);
        if (col.key === 'quotation_number' && tableKey !== 'quotations') return resolvers.quotation_id(row.quotation_id);
        if (col.key === 'invoice_number' && tableKey !== 'invoices') return resolvers.invoice_id(row.invoice_id);
        const value = row[col.key];
        return value === null || value === undefined ? '' : value;
      });
      aoa.push(line);
    }
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet['!cols'] = table.columns.map((c) => ({ wch: Math.max(16, c.label.length + 2) }));
    XLSX.utils.book_append_sheet(wb, sheet, table.sheetName);
  }

  return wb;
}

export async function downloadFullExport() {
  const wb = await exportAllData();
  const stamp = todayIso();
  XLSX.writeFile(wb, `Henil-Enterprise-Export-${stamp}.xlsx`);
}

// ---------------- Error report ----------------

export function downloadErrorReport(validationResult) {
  const wb = XLSX.utils.book_new();
  const aoa = [['Sheet', 'Row', 'Level', 'Message']];
  for (const [tableKey, tableResult] of Object.entries(validationResult.tables)) {
    const table = IMPORT_TABLES[tableKey];
    for (const row of tableResult.rows) {
      for (const msg of row.messages) {
        aoa.push([table.sheetName, row.rowNumber, msg.level, msg.text]);
      }
    }
  }
  if (validationResult.unmatchedSheets.length > 0) {
    for (const name of validationResult.unmatchedSheets) {
      aoa.push([name, '', 'warning', 'This sheet name was not recognized and was skipped.']);
    }
  }
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, sheet, 'Import Report');
  XLSX.writeFile(wb, `Henil-Enterprise-Import-Report-${todayIso()}.xlsx`);
}
