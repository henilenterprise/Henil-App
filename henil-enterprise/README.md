# Henil Enterprise — Business Management System

**Henil Enterprise** — Acrylic & Polycarbonate Manufacturing and Fabrication.

A full-featured business management application: clients, products,
quotations, invoices, payments, finance, expenses, inventory, file
storage, PDF generation, reporting, role-based access control, and
company settings.

## Status: feature-complete, pre-deployment

Every module below is built and tested. This repository has **not
been deployed**. See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full
production checklist, and
[`PRODUCTION_DEPLOYMENT_WALKTHROUGH.md`](./PRODUCTION_DEPLOYMENT_WALKTHROUGH.md)
for the exact, ordered step-by-step deployment sequence (GitHub →
Vercel → Node.js hosting → Supabase → custom domain → HTTPS) before
taking it live.

## Features

- **Clients** — full CRUD, search/filter/sort, per-client detail page
- **Products** — full CRUD, categories, active/inactive, GST %, default rate
- **Quotations** — line items, discount, per-item GST, auto-numbering, status workflow, PDF
- **Invoices** — quotation-to-invoice conversion, auto-numbering, status workflow, PDF
- **Payments** — record against invoices, automatic status transitions, overpayment prevention (client- and database-enforced)
- **Finance** — real-time KPIs (sales, collected, outstanding, overdue, expenses, net revenue)
- **Expenses** — categorized tracking with receipt attachments
- **Inventory** — full transaction ledger (Purchase/Usage/Adjustment/Damage/Return), low-stock warnings, never allows negative stock
- **File storage** — customer drawings/project files (PDF/PNG/JPG/JPEG/DXF/DWG) via Supabase Storage, with preview, download, and access control
- **PDF generation** — professional A4 quotation/invoice PDFs (real vector PDFs via `pdf-lib`, not screenshots), automatically using Company Settings
- **Reports** — Sales, Quotations, Invoices, Payments, Outstanding, Overdue, Expenses, Inventory, each with filters and CSV export
- **Role-based access control** — 5 roles (Admin, Manager, Sales, Accounts, Staff), enforced in the database (Row Level Security), not just hidden UI
- **Company Settings** — company profile, logo, document number prefixes, default GST, terms & conditions, bank details — used automatically everywhere, nothing hardcoded

## Tech Stack

- **Frontend**: React 18 + Vite + JavaScript + React Router v6 + `lucide-react`
- **Backend**: Node.js + Express (health checks only — see [Architecture](#architecture) below)
- **Database & Auth**: Supabase (PostgreSQL + Supabase Auth + Row Level Security)
- **Storage**: Supabase Storage (3 buckets: expense receipts, project files, company assets)
- **PDF generation**: `pdf-lib` (client-side, real vector PDFs)
- **Design**: Black / White / Gold — CSS custom properties in `frontend/src/styles/tokens.css`

## Architecture

This backend is intentionally minimal. **Every data operation goes
directly from the frontend to Supabase** via `@supabase/supabase-js`
— there is no custom Express CRUD layer. PostgREST (Supabase's
auto-generated REST API) is the real API surface, and it's secured
entirely by the Row Level Security policies in `database/migrations/`.
The Express server only serves `/api/health` endpoints, useful for
uptime monitoring and confirming the deployment's environment
variables are wired correctly.

This means: **the database migrations are the authorization system**,
not a nice-to-have. Anyone with the app's public (anon) key who
bypasses the UI and calls the Supabase API directly is still subject
to the exact same RLS rules as a real user. See
`database/migrations/20260815100700_role_based_access_control.sql`
for the full permission matrix.

## Project Structure

```
henil-enterprise/
├── frontend/                 React + Vite app
│   ├── src/
│   │   ├── components/       reusable UI, by feature area
│   │   ├── pages/             route-level pages
│   │   ├── layouts/           app shell (sidebar, top nav, mobile nav)
│   │   ├── services/          Supabase queries, one file per domain
│   │   ├── hooks/              useAuth, useCompany
│   │   ├── context/            AuthContext, CompanyContext, ToastContext
│   │   ├── utils/               calculations, formatting, validation, PDF generation
│   │   └── styles/              design tokens
│   ├── .env.example
│   └── package.json
├── backend/                  Express health-check server (see Architecture above)
│   ├── src/
│   │   ├── config/            env + Supabase (service_role) client
│   │   ├── controllers/, routes/, services/
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── database/
│   ├── migrations/            27 SQL migrations — run these, in order, on a fresh Supabase project
│   └── README.md              full schema + migration-by-migration rationale
├── DEPLOYMENT.md              production deployment checklist
├── .gitignore
└── README.md                  this file
```

## Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project (free tier is fine to start)
- Git

## Getting Started (local development)

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run every file in `database/migrations/` **in
   filename order** (they're timestamp-prefixed, so sorting
   alphabetically is sorting chronologically). See `database/README.md`
   for details on what each one does.
3. Create your first user: Supabase Dashboard → Authentication →
   Users → Add user. Then, in the SQL Editor:
   ```sql
   update public.users set role = 'admin' where email = 'you@example.com';
   ```
   (The `handle_new_auth_user` trigger auto-creates the `public.users`
   profile row with the default `staff` role when the auth user is
   created — this just promotes it to `admin`.)

### 2. Configure environment variables

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Fill in the real values — see [Environment Variables](#environment-variables) below for exactly which ones and where to find them.

### 3. Install and run

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
cd backend  && npm install && npm run dev   # http://localhost:5000
```

Sign in with the user you promoted to `admin` above.

## Environment Variables

See `frontend/.env.example` and `backend/.env.example` for the
authoritative, commented list (kept in sync with the code — this
section is a quick reference, not the source of truth).

| File | Variable | Used for |
|---|---|---|
| `frontend/.env` | `VITE_SUPABASE_URL` | Supabase project URL |
| `frontend/.env` | `VITE_SUPABASE_ANON_KEY` | Supabase **anon/public** key — safe to ship to the browser |
| `frontend/.env` | `VITE_API_BASE_URL` | Base URL of the backend health-check API |
| `backend/.env` | `PORT` | Port the Express server listens on |
| `backend/.env` | `CORS_ORIGIN` | The frontend's URL (must match exactly in production) |
| `backend/.env` | `SUPABASE_URL` | Same Supabase project URL |
| `backend/.env` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service_role** key — server-side only, bypasses RLS, never expose to the browser |

**Never** put `SUPABASE_SERVICE_ROLE_KEY` in `frontend/`, and never
prefix it with `VITE_` — Vite bundles anything with that prefix
straight into the browser-visible JavaScript.

## Testing

No automated test suite is included. Every module was manually
verified end-to-end (real calculations, real multi-step workflows,
role-permission boundaries, mobile viewport, invalid-input handling,
simulated network failures) during development against a local
Supabase-API-compatible test harness. See `database/README.md` and
the migration file comments for the reasoning behind specific
business-logic and security decisions.

## License

Private/proprietary — not licensed for reuse.
