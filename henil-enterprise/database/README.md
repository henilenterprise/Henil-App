# Henil Enterprise — Database

PostgreSQL schema for Henil Enterprise, designed to run on **Supabase**.
This is architecture only: the frontend is **not** connected to this
database yet, and no data is seeded.

## What's here

```
database/
└── migrations/
    ├── 20260815090000_extensions_and_enums.sql
    ├── 20260815090100_users.sql
    ├── 20260815090200_clients.sql
    ├── 20260815090300_products.sql
    ├── 20260815090400_quotations.sql
    ├── 20260815090500_quotation_items.sql
    ├── 20260815090600_invoices.sql
    ├── 20260815090700_invoice_items.sql
    ├── 20260815090800_payments.sql
    ├── 20260815090900_expenses.sql
    ├── 20260815091000_suppliers.sql
    ├── 20260815091100_inventory.sql
    ├── 20260815091200_inventory_transactions.sql
    ├── 20260815091300_files.sql
    ├── 20260815091400_company_settings.sql
    ├── 20260815091500_updated_at_triggers.sql
    ├── 20260815091600_row_level_security.sql
    ├── 20260815100000_quotation_numbering.sql
    ├── 20260815100100_invoice_numbering.sql
    ├── 20260815100200_fix_payment_method_constraint.sql
    ├── 20260815100300_prevent_payment_overpayment.sql
    ├── 20260815100400_expense_attachments.sql
    ├── 20260815100500_inventory_transaction_types_and_rpc.sql
    ├── 20260815100600_project_files_storage.sql
    ├── 20260815100700_role_based_access_control.sql
    ├── 20260815100800_company_settings_module.sql
    ├── 20260815100900_security_audit_fixes.sql
    └── 20260815101000_fix_line_item_ordering.sql
```

Each file is numbered so it can be run **in order** — later files
depend on tables/types created earlier (foreign keys, triggers, RLS
policies all reference tables from prior files).

## How to run this in Supabase

You have two options. Pick whichever fits how you work.

### Option A — Supabase Dashboard SQL Editor (simplest, no local setup)

1. Create a Supabase project at [supabase.com](https://supabase.com) if you don't have one yet.
2. Open your project → **SQL Editor**.
3. Open `20260815090000_extensions_and_enums.sql` in this repo, copy its contents, paste into a new SQL Editor query, and click **Run**.
4. Repeat for each file **in filename order** (they're numbered so this is just top-to-bottom in your file explorer).
5. After the last file runs, go to **Table Editor** and confirm all 14 tables listed below appear under the `public` schema.

This is the fastest way to get the schema live and is fine even for a production project — Supabase doesn't require the CLI.

### Option B — Supabase CLI (recommended once you're doing this repeatedly)

If you'd rather manage migrations with the CLI and keep history in sync with a linked project:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>

# Copy this folder's contents into the CLI's expected migrations folder
mkdir -p supabase/migrations
cp database/migrations/*.sql supabase/migrations/

supabase db push
```

The filenames are already in the `<timestamp>_description.sql` format the Supabase CLI expects, so no renaming is needed.

## Schema overview

14 tables, matching the brief exactly:

| Table | Purpose |
|---|---|
| `users` | App profile + role for each Supabase Auth user (1:1 with `auth.users`) |
| `clients` | Client companies |
| `products` | Acrylic/polycarbonate products and fabrication items |
| `quotations` | Quotations issued to clients |
| `quotation_items` | Line items on a quotation |
| `invoices` | Invoices issued to clients, optionally from a quotation |
| `invoice_items` | Line items on an invoice |
| `payments` | Payments recorded against an invoice (supports partial payments) |
| `expenses` | Operating expenses, independent of invoicing |
| `suppliers` | Raw material / component suppliers |
| `inventory` | Current stock level per product |
| `inventory_transactions` | Append-only stock movement ledger (IN / OUT / ADJUSTMENT) |
| `files` | Metadata for files in Supabase Storage (drawings, signed documents, etc.) |
| `company_settings` | Single-row table of company profile & document defaults |

### Relationships

```
clients ─┬──< quotations ──< quotation_items
         │         │
         │         └──< invoices (quotation_id nullable — an invoice
         │                        doesn't have to come from a quotation)
         └──< invoices ──< invoice_items
                  │
                  └──< payments

products ──< quotation_items
products ──< invoice_items
products ──< inventory (1:1, one stock row per product)
products ──< inventory_transactions

clients / quotations / invoices ──< files (each link is optional and independent)
```

- `clients.id` and `invoices.client_id` / `quotations.client_id` use
  `ON DELETE RESTRICT` — you can't delete a client that has quotation
  or invoice history, so financial records never lose their client.
- `quotations.id → invoices.quotation_id` uses `ON DELETE SET NULL` —
  deleting a quotation doesn't delete invoices already raised from it.
- Line item tables (`quotation_items`, `invoice_items`) use
  `ON DELETE CASCADE` on their parent — delete the quotation/invoice
  and its line items go with it.
- `quotation_items.product_id` / `invoice_items.product_id` use
  `ON DELETE SET NULL` — deleting a product doesn't delete historical
  line items that referenced it; the item keeps its own description/rate.

### Two tables without an explicit column spec in the brief

The brief listed `suppliers` and didn't give it a column list, and
`invoice_items` wasn't given its own section (only `invoices` was).
Both were designed to be consistent with the rest of the schema:

- **`suppliers`** mirrors `clients` — same shape (company name, contact,
  GST, address, notes), since a supplier is the same kind of business
  entity as a client, just on the purchasing side.
- **`invoice_items`** mirrors `quotation_items` exactly — same columns,
  same constraints, same `ON DELETE` behavior — since invoice line
  items and quotation line items serve an identical purpose.

## Status enums

### `quotation_status`
```
DRAFT · SENT · VIEWED · ACCEPTED · REJECTED · EXPIRED
```

### `invoice_status`
```
DRAFT · SENT · PENDING · PARTIALLY_PAID · PAID · OVERDUE · CANCELLED
```

**Note on "payment statuses":** the brief asked for payment statuses
`PENDING / PARTIALLY_PAID / PAID / OVERDUE` separately from invoice
statuses. Those four values are already part of `invoice_status`
above — an invoice's status *is* its payment status once it's been
sent (an invoice can't be both "sent, unpaid" and have a separate
independent payment-status field without the two getting out of sync).
So there is one `invoice_status` enum, not two, and it's a superset
that includes both the document workflow states (`DRAFT`, `SENT`,
`CANCELLED`) and the payment states. The `payments` table itself has
no status column — it doesn't need one, since each row is just a
record of money received; the running payment state lives on the
invoice.

### `inventory_transaction_type`
```
PURCHASE · USAGE · ADJUSTMENT · DAMAGE · RETURN
```
Redefined by migration 23 below — see that section for the original
placeholder values this replaced and the full direction/sign rules.

## Row Level Security

Every table has RLS **enabled**, so as soon as this schema is live,
even a request using only the public `anon` key is rejected by
default — nothing is readable or writable until a real signed-in
Supabase Auth user makes the request. This is safe to leave in place
before the frontend is connected.

Role model (stored in `users.role`, a `user_role` enum: `admin` /
`manager` / `staff`):

| Action | admin | manager | staff |
|---|---|---|---|
| Read any business table | ✅ | ✅ | ✅ |
| Create / update records | ✅ | ✅ | ✅ |
| Delete records | ✅ | ✅ | ❌ |
| Change company settings | ✅ | ✅ | ❌ (read-only) |
| Manage other users | ✅ | ❌ | ❌ |

`inventory_transactions` has no UPDATE policy at all (by design) — it's
an append-only ledger, so historical stock movements can't be edited,
only inserted (or deleted by a manager/admin correcting a mistake).

A new row is automatically inserted into `public.users` (with role
`staff`) whenever someone signs up via Supabase Auth, via the
`handle_new_auth_user()` trigger on `auth.users`. You'll want to
manually promote your own account to `admin` after your first sign-up:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

This role model is easy to change later — everything routes through
`public.current_user_role()`, `public.is_staff_or_above()`, and
`public.is_manager_or_admin()`, so adjusting access only means editing
those three functions rather than every policy.

## Verifying it worked

After running all 17 files, in the SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

You should see all 14 tables listed above. Then:

```sql
select * from public.company_settings;
```

should return zero rows (nothing is seeded) without an error — that
confirms the table and its RLS policy both exist correctly.

## What's intentionally NOT done here

- No data is seeded (not even a `company_settings` row).
- No Supabase Storage buckets are created for the `files` table's
  file objects, except the `attachments` bucket added in migration 22
  for expense receipts — client/quotation/invoice attachment upload
  UI is still a later phase, even though the DB link columns
  (`client_id`, `quotation_id`, `invoice_id` on `public.files`)
  already exist for it.
- The frontend imports `@supabase/supabase-js` against this schema as
  of the Quotations/Invoices modules — see `frontend/src/services/`.
- Invoice status is currently a manually-set field (via the UI's
  "Change status" control), even though `PENDING`/`PARTIALLY_PAID`/
  `PAID`/`OVERDUE` conceptually describe payment state. Once the
  Payments module is built, those four transitions could become
  automatic based on `payments` recorded against the invoice vs its
  `total` — nothing in the schema blocks that later.

## Migration 18: quotation auto-numbering

`quotation_number` is generated automatically as `QT-00001`,
`QT-00002`, ... by a Postgres sequence (`quotation_number_seq`) plus a
`BEFORE INSERT` trigger (`trg_set_quotation_number`) on
`public.quotations`. The application never constructs this number
itself — it simply omits the column on insert and Postgres fills it
in, which is also safe under concurrent inserts (an app-side
`SELECT MAX() + 1` is not, since two simultaneous requests could read
the same max before either commits).

The prefix is the literal `'QT-'`, matching the brief's example,
rather than `company_settings.quotation_prefix` (which defaults to
`'QUO-'`). If the prefix needs to become configurable later, update
`set_quotation_number()` to read from `company_settings` instead.

## Migration 19: invoice auto-numbering

Identical pattern to migration 18: `invoice_number_seq` plus a
`BEFORE INSERT` trigger (`trg_set_invoice_number`) generate
`INV-00001`, `INV-00002`, ... automatically. Same reasoning, same
prefix caveat (literal `'INV-'` rather than
`company_settings.invoice_prefix`, which defaults to `'INV-'` anyway
so there's no mismatch here, unlike the quotation prefix).

## Migration 20: payment_method constraint correction

The original `chk_payments_method` constraint (migration 9) allowed
`'Card'` as a reasonable guess before the Payments module's exact
field list existed. That list specifies exactly: Cash, Bank Transfer,
UPI, Cheque, Other — so this migration drops and recreates the
constraint to match precisely (Postgres has no `ALTER CONSTRAINT` for
changing a `CHECK` expression in place).

## Migration 21: prevent payment overpayment

A `BEFORE INSERT OR UPDATE` trigger (`trg_check_payment_within_balance`)
rejects any payment that would push an invoice's total payments past
its `total`. This exists **in addition to** the application-layer
check in `frontend/src/services/paymentsService.js`, not instead of
it — the DB trigger is what actually prevents a race condition where
two payments are submitted concurrently and each passes app-side
validation against a stale "remaining balance" read before either has
committed. The app-side check still exists because it gives a fast,
friendly error without a round trip that fails; the DB trigger is the
backstop that's actually authoritative.

## Migration 22: expense attachments

Creates a public Storage bucket named `attachments` (via a direct
`insert into storage.buckets`, which works from the SQL editor/a
migration — bucket creation isn't only a dashboard action) plus RLS
policies on `storage.objects` scoped to that bucket, and adds
`expense_id` to `public.files` following the same pattern as its
existing `client_id`/`quotation_id`/`invoice_id` columns.

The bucket is public for simplicity (`getPublicUrl()` instead of
signed URLs) — see the migration file's comment for the tradeoff and
how to switch to signed URLs later if needed. Deleting an expense
removes its `files` row via the FK's `on delete cascade`, but does
**not** automatically remove the underlying Storage object — the
application (`frontend/src/services/expensesService.js`) handles that
explicitly before deleting the expense row.

## Migration 23: inventory transaction types + atomic stock RPC

Two things change here:

1. **`inventory_transaction_type` is redefined** from its original
   placeholder values (`IN`/`OUT`/`ADJUSTMENT`, chosen before the
   Inventory module existed) to the module's exact 5 types:
   `PURCHASE`, `USAGE`, `ADJUSTMENT`, `DAMAGE`, `RETURN`. Safe to do
   directly since no rows existed yet. `PURCHASE`/`RETURN` add to
   stock, `USAGE`/`DAMAGE` remove from it, and `ADJUSTMENT` is the one
   type that can go either direction (correcting a physical stock
   count) — so its `quantity` may be negative (never zero), while
   every other type's `quantity` must be a positive magnitude. The
   updated `chk_inventory_transactions_quantity` constraint enforces
   exactly that split.

2. **`record_inventory_transaction()` is added as the only safe way
   to change stock.** `public.inventory.quantity` is never set
   directly by the application — this function inserts the ledger row
   and updates the running balance in one atomic transaction (a
   PL/pgSQL function body is part of the caller's transaction; a
   `raise exception` rolls back everything it did), using
   `select ... for update` to lock the row so two concurrent changes
   to the same product can't silently clobber each other, and
   rejecting anything that would take stock negative. "Opening stock"
   isn't a separate mechanism — it's just the first `ADJUSTMENT` ever
   recorded for a product (the function auto-creates the
   `public.inventory` row starting at 0 if none exists yet), going
   through the exact same path as every later change.

   `frontend/src/services/inventoryService.js` never does its own
   `insert`/`update` against `inventory`/`inventory_transactions` for
   quantity changes — every stock change calls this RPC via
   `supabase.rpc('record_inventory_transaction', {...})`.


## Migration 24: project files (Storage + access control)

A second Storage bucket, `project-files`, distinct from the
`attachments` bucket added in migration 22. Where `attachments` is
public (expense receipts — convenience over strict privacy),
`project-files` is **private**: the only way to view or download a
file is a short-lived signed URL generated for an authenticated
request (`frontend/src/services/filesService.js`), which is what
"implement access control" means in practice here.

RLS on `storage.objects` for this bucket: any signed-in (staff+) user
can upload or view, but only `manager`/`admin` can delete — mirroring
the existing `public.files` table policy, and matching the same
elevated-permission-for-delete pattern used elsewhere (Products
deactivate, Clients delete).

`chk_files_file_type` restricts `file_type` (the lowercase file
extension, not a MIME type — DXF/DWG have no standardized MIME string
across browsers, so extension is the reliable signal) to
`pdf`/`png`/`jpg`/`jpeg`/`dxf`/`dwg`, but **only** for rows where
`expense_id` is null — expense receipts (migration 22) were never
restricted to this exact list, so this only tightens the new
project-files use case without breaking that existing feature.

## Migration 25: role-based access control (5 roles)

Replaces the original 3-role, "any signed-in user can read/write
everything" model (migration 17) with 5 roles and an explicit
per-module permission matrix:

| Role | Modules |
|---|---|
| `admin` | everything |
| `manager` | clients, products, quotations, invoices, inventory, reports |
| `sales` | clients, products, quotations |
| `accounts` | invoices, payments, finance, expenses, reports |
| `staff` | inventory, + `assigned_modules` (per-user extra grants) |

**`has_module_access(module)`** is the single source of truth,
checked by every table's RLS policy. `role_has_module()` encodes the
matrix above; `assigned_modules` (a new `text[]` column on
`public.users`) lets an admin grant one specific user extra modules
beyond their role's defaults — e.g. one staff member also handling
Products — without changing their role or the whole role's
definition. There's no UI for managing `assigned_modules` yet; it's
set directly via SQL until a User Management module exists.

**`can_delete_module(module)`** additionally requires `admin` or
`manager` — deleting is more consequential than reading/writing
within a module a role otherwise has, matching the original
"staff cannot delete" intent, generalized across all 5 roles.

**`payments` SELECT is intentionally broader** than the `payments`
module alone: `MANAGER` has `invoices` but not `payments`, yet still
needs payment amounts to compute a "remaining balance" (invoice view,
Outstanding/Overdue reports). Writing to the payments ledger itself
still requires true `payments` access.

**Found and fixed a real privilege-escalation gap** while writing
this: the original `users_update` policy let any signed-in user
update their own row, which included the `role` column — nothing
stopped a `staff` user from calling `update users set role='admin'
where id=auth.uid()` directly against the API. A new
`prevent_unauthorized_role_change()` trigger closes this regardless
of what the RLS policy's `USING`/`WITH CHECK` clauses allow.

**`suppliers` appears in no role's list** in the brief, so only
`admin` (the catch-all) can reach it.

**`company_settings` write access is tightened** from
manager-or-admin to admin-only, since "Settings" isn't in any other
role's module list. Read stays broad — every role that can generate a
quotation/invoice PDF needs company details.

## Migration 26: Company Settings module

Two things close out "do not hardcode company information":

1. A public `company-assets` Storage bucket for the logo (public,
   like `attachments`, unlike the private `project-files` — PDF
   generation does a plain `fetch(url)` on the logo while building a
   document, which needs a directly-fetchable URL). Write access is
   gated on `has_module_access('settings')`, which resolves to
   ADMIN-only under the existing matrix (no other role lists
   `'settings'`), matching "ADMIN should be able to configure."

2. `set_quotation_number()`/`set_invoice_number()` (migrations 18, 19)
   previously used a literal `'QT-'`/`'INV-'` prefix — both README
   sections for those migrations explicitly flagged this as deferred
   ("if the prefix needs to become configurable later..."). This is
   that later: both functions now read `quotation_prefix`/
   `invoice_prefix` from `company_settings`, falling back to the
   original literals only if no settings row exists yet. Changing a
   prefix in Settings only affects new documents going forward —
   existing quotation/invoice numbers are never rewritten.

## Migration 27: security audit fixes

Findings from a full security audit, fixed rather than just noted:

1. **Missing Storage size limits.** `project-files` got a 20MB
   `file_size_limit` in migration 24, but `attachments` (expense
   receipts) and `company-assets` (logo) never did — meaning any user
   with write access to those buckets could upload an arbitrarily
   large file. Fixed: 10MB for `attachments`, 2MB for `company-assets`
   (the logo is fetched into memory on every PDF generation, so an
   oversized one would affect every user generating a document, not
   just the uploader).

2. **Unverified financial totals.** `quotations.total`,
   `invoices.total`, and `quotation_items`/`invoice_items.amount`
   were documented as "computed and stored by the application layer"
   with no independent database check — RLS restricted *who* could
   write, but nothing stopped an authorized user (e.g. SALES, who can
   create quotations) from calling the API directly and storing a
   self-inconsistent total, which would then flow into Reports and
   Finance as real data. Added constraints that exactly match
   `frontend/src/utils/quotationCalculations.js`'s formulas
   (`item.amount = quantity * rate`, `total = greatest(0, subtotal -
   discount + gst)`) — money columns are `numeric(12,2)`, exact
   decimal arithmetic, so there's no rounding false-positive risk
   against values the app itself computes.

   **Known residual gap, not fixed here:** these constraints verify
   each item's `amount` and each document's `total` individually, but
   not that `subtotal`/`gst` equal the *sum* of the item rows —
   that's a cross-row aggregate relationship a `CHECK` constraint
   can't express (it can only see one row at a time). Enforcing it
   would need a trigger recalculating and verifying on every
   `quotation_items`/`invoice_items` change, which is a larger
   structural change than this pass covers safely.

See the full security audit summary for everything else reviewed
(RLS coverage, secret handling, file upload validation, CSV/formula
injection, CORS, error-message hygiene, and more).

## Migration 28: fix quotation_items/invoice_items ordering (critical bug)

Found via a real production deployment (not caught in development,
which used an offline query-builder stub that never validated real
column existence): both `quotationsService.js` and `invoicesService.js`
queried their line items with `order('created_at', ...)`, but neither
`quotation_items` nor `invoice_items` has ever had a `created_at`
column (migrations 06 and 08). **Every attempt to view or edit any
quotation or invoice failed outright** with `column
quotation_items.created_at does not exist`.

The fix adds a `sort_order` column to both tables rather than simply
adding `created_at`. Line items are always inserted as one batch (a
single multi-row `INSERT` per save), and Postgres evaluates a
column's `default now()` once per *statement*, not once per row —
every item in the same save would get the identical timestamp, so
ordering by `created_at` would not have reliably preserved the order
the user actually entered items in, even once the missing-column
error was fixed. `sort_order` is set explicitly from each item's
position in the array by the application at insert time, which is
the only way to guarantee correct ordering.

Existing rows saved before this migration have no recoverable signal
for their original order and default to `sort_order = 0` — strictly
better than before, since those rows were completely unviewable
until this migration (the page errored outright regardless of
order), not a regression.
