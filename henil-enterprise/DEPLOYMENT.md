# Deployment Checklist

This application has **not been deployed yet**. Work through this
checklist in order before taking it live. Nothing here should be
treated as optional — each section maps to a real check that was
performed (and, where a real gap was found, fixed) during production
readiness review.

---

## 1. Frontend build

- [ ] `cd frontend && npm install` — installs `vite`, `@vitejs/plugin-react`,
      and all runtime dependencies (`react`, `react-dom`,
      `react-router-dom`, `lucide-react`, `@supabase/supabase-js`,
      `pdf-lib`) from the real npm registry.
- [ ] `npm run build` — runs `vite build`. This must complete with
      **zero errors**. The source itself was validated with a
      production-equivalent build (real `react`/`react-dom`/`pdf-lib`,
      minified, `NODE_ENV=production`, source maps) during
      development — that build produced a working bundle with **zero
      errors** and gzipped to ~292 KB JS + ~10 KB CSS. Vite's actual
      Rollup-based build should be run as the final confirmation
      before deploying, since the sandbox this app was built in has
      no network access to install `vite` itself.
- [ ] Confirm `frontend/dist/` was produced and contains `index.html`
      plus hashed JS/CSS assets.
- [ ] **Environment variables are baked in at build time, not runtime.**
      `frontend/.env` (or your CI/CD platform's environment variable
      settings) must contain the real `VITE_SUPABASE_URL` and
      `VITE_SUPABASE_ANON_KEY` **before** running `npm run build`.
      Rebuilding is required if these ever change — editing the
      deployed `dist/` files or setting env vars on the host
      afterward has no effect.
- [ ] Serve `frontend/dist/` as a static site (Vercel, Netlify,
      Cloudflare Pages, S3+CloudFront, or any static host). Configure
      a SPA fallback (all routes serve `index.html`) — this app uses
      client-side routing (`react-router-dom`), so a direct request to
      e.g. `/quotations/abc123` must not 404 at the host level.

## 2. Backend build

- [ ] `cd backend && npm install` — installs `express`, `cors`,
      `dotenv`, `@supabase/supabase-js`.
- [ ] No build/transpile step exists or is needed (plain ESM
      JavaScript, no TypeScript). `npm start` runs `node
      src/server.js` directly.
- [ ] Every backend file was syntax-checked and its full import graph
      verified to resolve correctly during development.
- [ ] Remember this backend **only serves health-check endpoints**
      (`/api/health`, `/api/health/db`) — see the Architecture section
      in `README.md`. It is not a required dependency for the app's
      core functionality (all real data operations go frontend →
      Supabase directly), but deploy it anyway if you want uptime
      monitoring or a place to add real endpoints later.
- [ ] Run it as a long-lived process (a process manager like `pm2`,
      or your host's native process supervision — e.g. Render,
      Railway, Fly.io, a systemd service) — `npm start` alone exits if
      the process crashes, with nothing to restart it.
- [ ] Confirm `GET /api/health` returns `200` with `status: "ok"`.
- [ ] Confirm `GET /api/health/db` returns `status: "connected"` once
      `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are set — this proves
      the deployed backend can actually reach your Supabase project.

## 3. Environment variables

See the [README's Environment Variables section](./README.md#environment-variables)
for the full table. Set these on your hosting platform's environment
variable configuration (Vercel/Netlify project settings, your
container orchestrator's secrets, etc.) — never commit real values.

**Frontend** (baked in at build time — see section 1):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` — the backend's real production URL

**Backend** (read at runtime):
- `PORT`
- `CORS_ORIGIN` — the frontend's real production URL, **exact match**
  including scheme (`https://`) and no trailing slash
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Dashboard → Project
  Settings → API → click "Reveal" next to `service_role`

- [ ] Confirmed: no `.env` file (only `.env.example`) is committed to
      git, in the current tree or anywhere in git history.
- [ ] Confirmed: `frontend/.env.example` contains only the anon key
      variable name, never `service_role`.
- [ ] Confirmed: `.gitignore` covers `.env`, `.env.local`, and
      `.env.*.local` at the root (applies to both `frontend/` and
      `backend/`).

## 4. Database

- [ ] Run every file in `database/migrations/` **in filename order**
      against your production Supabase project's SQL Editor (they are
      timestamp-prefixed — alphabetical order is chronological order).
      27 migrations total as of this checklist.
- [ ] Confirm all 3 Storage buckets exist afterward: `attachments`
      (public, 10 MB limit), `project-files` (private, 20 MB limit),
      `company-assets` (public, 2 MB limit) — Dashboard → Storage.
- [ ] Create your first real user (Dashboard → Authentication → Users
      → Add user), then promote it to `admin`:
      ```sql
      update public.users set role = 'admin' where email = 'you@example.com';
      ```
- [ ] Verify Row Level Security is enabled on every table — every
      table created by the migrations already has it enabled (this
      was cross-checked table-by-table during development), but worth
      a final confirmation via Dashboard → Database → Tables → each
      table's RLS toggle.
- [ ] Consider your Supabase project's compute/database tier for
      expected production load — the free tier pauses after
      inactivity, which is fine for evaluation but not for a live
      business tool.
- [ ] Set up Supabase's automated daily backups (paid tiers) or a
      manual backup routine before real business data accumulates.

## 5. Supabase Auth

- [ ] Dashboard → Authentication → URL Configuration: set **Site
      URL** to your real production frontend URL.
- [ ] Add your production frontend URL to **Redirect URLs** (needed
      for any auth flows that redirect back to the app, e.g. password
      reset).
- [ ] Decide on **email confirmation**: Dashboard → Authentication →
      Providers → Email. Since users are created manually by an admin
      (Dashboard → Authentication → Users → Add user) rather than via
      public self-signup, email confirmation can typically stay off
      for this app's workflow — but review this against your actual
      onboarding process.
- [ ] Review the default **rate limits** (Dashboard → Authentication
      → Rate Limits) — the defaults are reasonable for most small
      teams, but confirm they fit your expected login volume.
- [ ] There is no public sign-up page in this app (users are
      provisioned by an admin) — confirm that's the intended
      onboarding model, or add one if not.

## 6. Supabase Storage

- [ ] Confirm bucket privacy settings match intent: `attachments` and
      `company-assets` are **public** (by design — `company-assets`
      needs a directly-fetchable URL for PDF generation;
      `attachments` trades stricter privacy for simplicity on expense
      receipts). `project-files` (customer drawings) is **private**,
      accessed only via short-lived signed URLs.
- [ ] Confirm file size limits are in effect: 10 MB (`attachments`),
      20 MB (`project-files`), 2 MB (`company-assets`) — set at the
      database level in the migrations, so they apply regardless of
      any client-side check.
- [ ] Confirm Storage RLS policies exist for all 3 buckets (Dashboard
      → Storage → Policies) — write access is role-gated to match the
      RBAC matrix (e.g. only Admin/Accounts can upload expense
      receipts), not just "any signed-in user."

## 7. CORS

- [ ] Set `CORS_ORIGIN` (backend) to your **exact** production
      frontend origin — scheme, domain, and no trailing slash (e.g.
      `https://app.henilenterprise.com`, not
      `https://app.henilenterprise.com/`).
- [ ] If you deploy a staging environment too, either deploy a
      separate backend instance per environment (simplest), or extend
      `backend/src/config/env.js` to parse a comma-separated list and
      pass an array to the `cors()` middleware in `backend/src/app.js`
      — the current single-origin-string config is intentionally
      simple and works correctly for one frontend origin, but wasn't
      built to parse multiple.
- [ ] Note: CORS only governs the Express health-check API. It has no
      bearing on the frontend's direct calls to Supabase — those are
      governed by Supabase's own API Gateway settings and RLS, not
      this backend's CORS config.

## 8. Security

A full security audit was performed and every finding fixed (not just
documented) — see `database/migrations/20260815100900_security_audit_fixes.sql`
and its README section for the complete list. As of this checklist:

- [ ] Confirmed: frontend only ever uses the Supabase **anon** key;
      `service_role` is isolated to `backend/` and never bundled into
      browser code.
- [ ] Confirmed: no hardcoded secrets/credentials anywhere in the
      repository or its git history.
- [ ] Confirmed: every database table has RLS enabled with a real
      per-role permission matrix, not just "any signed-in user."
- [ ] Confirmed: no SQL injection surface (no dynamic/string-concatenated
      SQL anywhere in the schema).
- [ ] Confirmed: no XSS surface (no `dangerouslySetInnerHTML`, `eval`,
      or raw `innerHTML`; React's default escaping is relied on
      throughout).
- [ ] Confirmed: CSV report exports are protected against
      formula/CSV injection.
- [ ] Confirmed: file uploads sanitize user-controlled filenames
      before they become Storage object keys, and are restricted by
      an allow-list of extensions (not just a spoofable MIME-type
      check) plus a database-enforced size limit.
- [ ] Confirmed: `target="_blank"`/`window.open()` calls to
      third-party URLs use `noopener,noreferrer` (prevents reverse
      tabnabbing).
- [ ] Confirmed: the privilege-escalation trigger prevents a
      non-admin from changing their own `role` or `assigned_modules`
      via a direct API call, not just via the UI.
- [ ] **Recommended before going live**: rotate the Supabase
      `service_role` key if it was ever pasted anywhere outside
      `backend/.env` during setup/testing (Dashboard → Project
      Settings → API → "Roll" next to `service_role`).
- [ ] **Recommended**: enable Supabase's database SSL enforcement
      and review the project's network restrictions (Dashboard →
      Settings → Database) if your compliance requirements call for it.

## 9. Error handling

- [ ] A top-level React error boundary now wraps the entire app
      (`frontend/src/components/error/ErrorBoundary.jsx`, wired in
      `main.jsx`) — **this was a real gap found and fixed during
      production readiness review**: previously, any uncaught render
      error anywhere in the component tree would unmount the whole
      app and show a blank white screen with no recovery path. It now
      shows a friendly "Something went wrong" screen with a reload
      button; the raw error/stack is only shown in dev mode, never in
      production (matches the same "don't leak internals" principle
      applied to backend error responses).
- [ ] Confirmed: the backend's global error handler never echoes a
      raw error message to the client by default (requires an
      explicit `err.expose = true` opt-in) — full details always go
      to server logs only.
- [ ] Confirmed: `/api/health/db` (unauthenticated by design) no
      longer returns raw Postgres/Supabase error text — logs
      server-side, returns a generic message over the wire.
- [ ] Every list/detail page in the app distinguishes a genuine empty
      state ("No clients yet") from a load failure ("Couldn't load
      clients" + Try again) — verified during end-to-end testing by
      simulating a backend outage.
- [ ] Consider wiring `ErrorBoundary`'s `componentDidCatch` and the
      backend's error handler to a real error-tracking service
      (Sentry or similar) before launch — currently both only log to
      the console/server logs, which isn't durable or searchable at
      production scale.

## 10. API configuration

- [ ] `VITE_API_BASE_URL` (frontend) points to the backend's real
      production URL.
- [ ] `frontend/src/config/env.js` is the single source of truth for
      every frontend env var — confirm no other file reads
      `import.meta.env` directly (all consumers import from here).
- [ ] `backend/src/config/env.js` is the equivalent single source of
      truth for the backend.
- [ ] Health check monitoring: point your uptime monitor at
      `GET {backend URL}/api/health` (process liveness) and/or
      `GET {backend URL}/api/health/db` (confirms Supabase
      connectivity) once deployed.

---

## Summary: exactly which environment variables you need in production

| Variable | Where | Example / notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `frontend/.env` (build time) | `https://xxxxxxxxxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `frontend/.env` (build time) | Supabase Dashboard → Project Settings → API → `anon`/`public` |
| `VITE_API_BASE_URL` | `frontend/.env` (build time) | Your deployed backend's URL, e.g. `https://api.henilenterprise.com` |
| `PORT` | `backend/.env` (runtime) | Usually set automatically by your host (Render/Railway/etc.); `5000` if self-managed |
| `CORS_ORIGIN` | `backend/.env` (runtime) | Your deployed frontend's exact URL, e.g. `https://app.henilenterprise.com` |
| `SUPABASE_URL` | `backend/.env` (runtime) | Same value as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` (runtime) | Supabase Dashboard → Project Settings → API → `service_role` (click "Reveal") — **treat as a password, never expose to the browser** |

That's **7 variables across 2 files**. Nothing else is required to
run this application in production.
