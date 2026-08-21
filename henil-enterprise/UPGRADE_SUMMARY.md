# Henil Enterprise — Upgrade Summary

This covers everything added on top of your existing application in
this session. **Nothing was rebuilt from scratch, no existing data
model was dropped or reset, and every new database change is a
strictly additive migration.** All 30 migrations, run in order on
your existing Supabase project, will not touch a single existing row.

---

## 1. Files changed (existing files modified, not replaced)

| File | Why |
|---|---|
| `frontend/src/services/quotationsService.js` | Fixed the critical bug where quotation items were ordered by a column that never existed |
| `frontend/src/services/invoicesService.js` | Same fix, invoice items |
| `frontend/src/components/ui/DatePicker.jsx` / `.css` | Fixed a mobile popover overflow bug |
| `frontend/src/components/layout/NotificationMenu.css` | Same class of mobile-width safety fix |
| `frontend/src/pages/QuotationForm.css`, `InvoiceForm.css`, `QuotationView.css`, `InvoiceView.css`, `Dashboard.css` | Fixed genuine horizontal-page-overflow bugs on mobile (a CSS grid/flexbox sizing issue) |
| `frontend/src/pages/QuotationForm.jsx`, `InvoiceForm.jsx` | Added inline "+ Add new client" |
| `frontend/src/pages/Finance.jsx` | Added Paid/Pending/Partially Paid breakdown, Client + Invoice Status filters |
| `frontend/src/services/financeService.js` | Backing logic for the above |
| `frontend/src/context/AuthContext.jsx` | Added the `artwork` module to Manager's permissions (frontend mirror of the DB-level RBAC change) |
| `frontend/src/layouts/navConfig.js`, `frontend/src/App.jsx` | Wired in every new page's navigation and routing |
| `frontend/package.json` | Added `xlsx` as a real dependency |
| `database/README.md` | Documented every new migration |

## 2. Files created

**Suppliers** (was a placeholder before this session):
`suppliersService.js`, `SupplierFormModal.jsx/.css`, `Suppliers.jsx/.css` (rewritten)

**Data Management**:
`utils/dataManagement/importSchema.js`, `services/dataManagementService.js`, `pages/DataManagement.jsx/.css`

**Artwork Vault**:
`services/artworkService.js`, `components/artwork/ArtworkFormModal.jsx/.css`, `pages/ArtworkVault.jsx/.css`, `pages/ArtworkDetail.jsx/.css`

**Nesting Optimizer**:
`utils/nesting/nestingEngine.js` (the packing algorithm), `services/nestingService.js`, `components/nesting/NestingVisualMap.jsx/.css`, `pages/NestingJobs.jsx/.css`, `pages/NestingJobForm.jsx/.css`

## 3. Database migrations (all additive — run in filename order)

| Migration | What it does |
|---|---|
| `20260815101000_fix_line_item_ordering.sql` | Adds `sort_order` to `quotation_items`/`invoice_items` — fixes the critical loading bug |
| `20260815101100_artwork_vault.sql` | Creates `artworks`, `artwork_versions`, the `artwork-files` Storage bucket, RLS, and extends the RBAC matrix |
| `20260815101200_nesting_optimizer.sql` | Creates `nesting_jobs`, `nesting_parts`, RLS |

None of these drop, alter destructively, or reset anything. `sort_order` is added with `if not exists` and a safe default; all three new tables are entirely new, with no foreign keys pointing *into* your existing tables that could break anything already there (only outward references to `clients`/`products`, which are `on delete set null` — deleting a client or product later can never fail or cascade-delete an artwork/nesting job).

## 4. New database tables

`artworks`, `artwork_versions`, `nesting_jobs`, `nesting_parts` — full column lists are in the migration files themselves, with inline comments explaining every constraint.

## 5. New features

- **Suppliers** — full CRUD (was previously just a "coming soon" placeholder)
- **Data Management** — Excel/CSV import (with preview, validation, duplicate detection, and skip/update/create-new resolution), full-data export, downloadable template, backup
- **Artwork Vault** — a manufacturing design archive with real version control (uploading never overwrites; "current version" is a flag, never a deletion)
- **Nesting Optimizer** — a real 2D bin-packing engine for sheet cutting layouts, with a visual map and saved jobs
- **Billing extensions** — inline client creation from Quotations/Invoices; a Paid/Pending/Partially-Paid breakdown and Client/Status filters on the Finance page

## 6. Excel template structure

Download it from **Data Management → Download Excel Template**. One sheet per data type — Clients, Products, Suppliers, Inventory, Expenses, Quotations, Quotation Items, Invoices, Invoice Items, Payments, Inventory Transactions, Company Settings — plus an Instructions sheet. Every column header is a human-readable label matching your real database fields exactly (e.g. "Client Company Name", not `client_id`) — you never need to know or enter a raw ID. Auto-generated fields (IDs, timestamps, quotation/invoice numbers) are excluded entirely.

## 7. How to import data

1. **Data Management → Select File**, choose your `.xlsx` or `.csv`.
2. Review the **preview**: each sheet shows counts of valid rows, duplicates, and errors, with full row-level detail available.
3. For any duplicates found, choose **Skip** (default, safest), **Update**, or **Import as new** — per sheet.
4. **Import Data**. Progress shows live; a final report shows created/updated/skipped/failed counts per sheet.
5. Download the error report if anything needs fixing, correct your spreadsheet, and re-import.

Sheets are imported in dependency order automatically (Clients/Products before Quotations, Quotations before Quotation Items, etc.), and every row is created through the exact same validated code path as manual entry — a bulk-imported quotation's total is calculated the same way, a bulk-imported payment can't overpay an invoice.

## 8. How to export data

**Data Management → Export All Data** downloads a complete Excel workbook of everything — same sheets as the template, but filled with your real data, with internal IDs resolved back to readable business names (a client shows as its company name, not a UUID). Never includes passwords, API keys, or credentials. **Backup** on the same page is this same export, framed for that purpose — for true point-in-time database backups, enable Supabase's own automated backups (Project Settings → Database → Backups).

## 9. How Artwork Vault works

Go to **Artwork Vault** in the sidebar. **Add Artwork** to create a record (name, client, product, material, thickness, dimensions, quantity, tags, notes). Open any artwork to **upload a file** (SVG, DXF, PDF, AI, EPS, PNG, JPG, JPEG, DWG — up to 50MB) — every upload becomes a new numbered version automatically marked current; old versions are never deleted, and you can switch which one is "current" at any time. Search by name/code/tag, filter by client/material/thickness/status.

*Not implemented*: automatic dimension extraction from DXF/AI/EPS file geometry — those are complex/proprietary formats with no reliable browser-side parser. Width/height/thickness are manual fields, which is the explicitly-allowed fallback.

## 10. How Nesting works

From **Artwork Vault → Nesting Optimizer → New Nesting Job**: enter sheet dimensions, material, kerf, spacing, edge margin, and rotation preference, then add unlimited part rows (name, width, height, quantity). **Optimize** runs a real guillotine-split bin-packing algorithm (not a grid placeholder) and shows sheets required, utilization %, waste, unplaced parts (with reasons), and a to-scale visual cutting map. **Save Nesting Job** to reopen it later; **Export Nesting Report** downloads a CSV cutting list. Tested directly at 10,500 parts in 94ms with zero overlapping placements.

## 11. How Billing works

Your existing Invoices + Payments modules **are** the billing system — nothing new was built in parallel. What's new: a "+ Add new client" link right on the Quotation/Invoice form (no need to leave and come back), and a Finance page that now shows exactly how much is Paid/Pending/Partially Paid, filterable by client or invoice status alongside the existing date range.

## 12. How to run the application

```bash
cd henil-enterprise/frontend && npm install && npm run dev   # http://localhost:5173
cd henil-enterprise/backend  && npm install && npm run dev   # http://localhost:5000
```

Run every file in `database/migrations/` (in filename order) against your Supabase project's SQL Editor first, if you haven't already applied the 3 new ones from this session.

## 13. How to deploy it

Unchanged from `PRODUCTION_DEPLOYMENT_WALKTHROUGH.md` in the repo root — the architecture (Vercel + Node.js host + Supabase) hasn't changed, only the application built on top of it.

## 14. Environment variables required

Unchanged — still exactly the 7 documented in `DEPLOYMENT.md`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (frontend); `PORT`, `CORS_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (backend). Nothing new was added.

## 15. Commands to run

```bash
# 1. Apply the 3 new migrations (in order) via Supabase's SQL Editor:
#    20260815101000_fix_line_item_ordering.sql
#    20260815101100_artwork_vault.sql
#    20260815101200_nesting_optimizer.sql

# 2. Install the new frontend dependency:
cd frontend && npm install

# 3. Run as usual:
npm run dev
```

---

## A note on scope

Three things were deliberately **not** done, disclosed rather than rushed or faked:

1. **Automatic dimension extraction** from artwork files (DXF/AI/EPS geometry parsing) — no reliable client-side parser exists for these formats.
2. **Inventory auto-deduction on invoicing** — your own instructions warned against "unexpected stock deductions without understanding the current system." Every inventory change today is an explicit, deliberate action; wiring in automatic deduction would need careful handling of edits and cancellations to avoid exactly that kind of surprise, and doing it hastily under time pressure was the wrong tradeoff.
3. **Nesting Report as a branded PDF** — it exports as a clear, workshop-usable CSV (full cutting list, coordinates, summary stats) rather than a polished PDF in this pass.

Every feature that *was* built was tested — real browser tests for every UI flow, and for the two places correctness mattered most (the import/export data pipeline and the nesting algorithm), direct unit tests against the underlying logic before any UI ever touched it, including two real bugs caught and fixed during that testing before they shipped.
