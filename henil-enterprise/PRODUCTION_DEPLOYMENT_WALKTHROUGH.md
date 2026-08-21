# Production Deployment Walkthrough

This is the exact, ordered sequence to take Henil Enterprise from "code
on GitHub" to "working in production" for this target architecture:

```
GitHub
  ↓
Frontend → Vercel
Backend  → Node.js cloud hosting (Render used as the worked example;
            Railway and Fly.io work identically in spirit)
Database → Supabase
Storage  → Supabase Storage
Domain   → Custom domain, HTTPS automatic on both Vercel and Render
```

This walkthrough assumes its sibling file, `DEPLOYMENT.md`, has
already been read once — that file is the *checklist* (what must be
true); this file is the *sequence* (what to click/type, in what
order). Neither replaces the other.

I cannot perform any of these steps for you — they require your real
GitHub, Vercel, Render, and Supabase accounts. Every command below is
exact and safe to copy-paste; every placeholder (`YOUR-...`) is
clearly marked.

---

## Step 0 — Push to GitHub

If you haven't already, follow the previous guide (`git remote add
origin ...`, `git push -u origin main`). Confirm before continuing:

```bash
git remote -v
git log --oneline origin/main -1
```

Both should show real output, not errors. Everything below assumes
your code is now on GitHub.

---

## Step 1 — Create production environment variables

Do this now, as a worksheet, before touching Vercel or Render — you'll
paste these values into both platforms' dashboards in later steps.

Open your Supabase project (or create one now at
[supabase.com](https://supabase.com) if you haven't) → **Project
Settings → API**. Collect:

| Value | Where in Supabase | You'll paste it into |
|---|---|---|
| Project URL | Project Settings → API → "Project URL" | Both Vercel and Render |
| `anon` / `public` key | Project Settings → API → "Project API keys" | Vercel only |
| `service_role` key | Project Settings → API → "Project API keys" → click "Reveal" | Render only — **never Vercel** |

You do not yet know your Vercel URL or Render URL — those are
generated in Steps 3 and 4. You'll come back and fill in
`CORS_ORIGIN` (Render) and `VITE_API_BASE_URL` (Vercel) once you have
them. That's expected; note it and move on.

**Run the database migrations now, before deploying**, so the app has
something real to connect to the moment it's live:

1. Supabase Dashboard → SQL Editor.
2. Open each file in `database/migrations/` **in filename order**
   (they're timestamp-prefixed) and run it. 27 files as of this
   guide.
3. Dashboard → Authentication → Users → Add user (your own email).
4. Back in SQL Editor:
   ```sql
   update public.users set role = 'admin' where email = 'you@example.com';
   ```

---

## Step 2 — Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub login is
   the simplest option — it also grants the repo access you need in
   the next step).
2. **Add New → Project.**
3. **Import Git Repository** → find and select your `henil-enterprise`
   repo. If it doesn't appear, click "Adjust GitHub App Permissions"
   and grant Vercel access to it.

---

## Step 3 — Deploy the frontend (Vercel)

This repo is a monorepo (`frontend/` and `backend/` as subdirectories
of one repo) — the single most common mistake here is leaving the
root directory as `/`. Fix it explicitly:

1. On the "Configure Project" screen, under **Root Directory**, click
   **Edit** and set it to `frontend`.
2. **Framework Preset**: Vercel should auto-detect "Vite" once the
   root directory is set correctly. If it doesn't, select it manually.
3. **Build Command**: `npm run build` (should be pre-filled).
4. **Output Directory**: `dist` (should be pre-filled — this matches
   `vite build`'s actual output folder).
5. **Environment Variables** — add these three (Project Settings →
   Environment Variables, or inline on this same screen):
   ```
   VITE_SUPABASE_URL=<your Project URL from Step 1>
   VITE_SUPABASE_ANON_KEY=<your anon key from Step 1>
   VITE_API_BASE_URL=https://placeholder-until-step-4.example.com
   ```
   That third one is intentionally a placeholder — you don't have a
   real backend URL yet. You'll update it and redeploy in Step 5.
6. Click **Deploy**.

Vercel will run `npm install && npm run build` in `frontend/` and
serve the `dist/` output. `frontend/vercel.json` (already in the repo)
tells Vercel to serve `index.html` for every route — without it, a
direct browser request to e.g. `/quotations/abc123` would 404 at the
host level instead of letting `react-router-dom` handle it client-side.

When it finishes, Vercel gives you a URL like
`https://henil-enterprise-xyz123.vercel.app`. **Copy it** — you need
it in the next two steps.

---

## Step 4 — Deploy the backend (Node.js cloud hosting)

Worked example using **Render** (render.com) — Railway and Fly.io
follow the same shape (connect repo → set root directory → set
build/start commands → set env vars → deploy).

1. Go to [render.com](https://render.com), sign in with GitHub.
2. **New → Web Service.**
3. Connect the same `henil-enterprise` repository.
4. Configure:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` (runs `node src/server.js` — no
     build/transpile step exists for this backend, it's plain ESM
     JavaScript)
   - **Instance Type**: the free tier works for evaluating this, but
     free-tier services on most hosts sleep after inactivity and take
     ~30–60s to wake on the next request — fine for testing, not for
     a live business tool with real users.
5. **Environment Variables**:
   ```
   PORT=10000
   CORS_ORIGIN=https://henil-enterprise-xyz123.vercel.app
   SUPABASE_URL=<your Project URL from Step 1>
   SUPABASE_SERVICE_ROLE_KEY=<your service_role key from Step 1>
   ```
   Use your **real Vercel URL from Step 3** for `CORS_ORIGIN` — exact
   match, `https://`, no trailing slash. (Some hosts set their own
   `PORT` automatically; if Render does on your plan, remove your
   manual `PORT` line and let the platform's own value take
   precedence.)
6. Click **Create Web Service**.

Render gives you a URL like `https://henil-enterprise-backend.onrender.com`.
**Copy it.**

---

## Step 5 — Go back and fix `VITE_API_BASE_URL`

Now that you have the real backend URL:

1. Vercel → your project → **Settings → Environment Variables**.
2. Edit `VITE_API_BASE_URL` to your real Render URL from Step 4.
3. **Deployments** tab → click the "⋯" on the latest deployment →
   **Redeploy**.

Remember: Vite bakes `VITE_*` variables into the built JavaScript at
**build time**, not read at runtime — editing the env var alone does
nothing until you redeploy.

---

## Step 6 — Configure CORS

Already done in Step 4 (`CORS_ORIGIN` on Render), but the causality is
worth being explicit about: **CORS only governs requests to the
Express backend** (the `/api/health*` routes) — it has no bearing on
the frontend's direct calls to Supabase, which are governed by
Supabase's own API settings and Row Level Security, not this backend.

If `CORS_ORIGIN` is wrong, you'll see a browser console error like
`has been blocked by CORS policy` specifically when the frontend calls
`VITE_API_BASE_URL` (i.e., the health check) — not when it talks to
Supabase directly.

---

## Step 7 — Configure Supabase for production

Already substantially covered by running the migrations in Step 1.
Two more things:

1. **Dashboard → Settings → Database**: confirm SSL enforcement is on
   (default) and review network restrictions if your organization
   requires them.
2. **Dashboard → Settings → Database → Backups**: enable automated
   backups if your plan supports it, before real business data
   accumulates.

---

## Step 8 — Configure Supabase Storage

The 3 buckets (`attachments`, `project-files`, `company-assets`) were
already created by the migrations in Step 1 — this is just
verification:

1. Dashboard → **Storage**. Confirm all 3 buckets exist.
2. Click into each → confirm the size limits match: 10 MB
   (`attachments`), 20 MB (`project-files`), 2 MB (`company-assets`).
3. Confirm `attachments` and `company-assets` show as **Public**,
   `project-files` as **Private**.
4. **Storage → Policies**: confirm each bucket has policies listed
   (not empty) — these were created by the migrations and enforce the
   same role-based access as the rest of the app.

---

## Step 9 — Configure Authentication URLs

This step is why login/redirect flows can silently break in
production even when everything else works:

1. Supabase Dashboard → **Authentication → URL Configuration**.
2. **Site URL**: set to your real Vercel URL from Step 3 (you'll
   update this again to your custom domain in Step 10).
3. **Redirect URLs**: add the same URL (and `/**` wildcard if the UI
   offers it) — needed for any auth flow that redirects back into the
   app (e.g. password reset, if you add that later).

---

## Step 10 — Connect the custom domain

On **Vercel** (frontend):
1. Your project → **Settings → Domains** → enter your domain (e.g.
   `app.henilenterprise.com`) → **Add**.
2. Vercel shows you the exact DNS record(s) to create — typically a
   `CNAME` record pointing your subdomain to `cname.vercel-dns.com`,
   or an `A` record for an apex/root domain. Go to your domain
   registrar (GoDaddy, Namecheap, Cloudflare, wherever you bought the
   domain) and add exactly the record Vercel shows you.
3. Propagation can take a few minutes to a few hours. Vercel's Domains
   page shows a live status and turns green once it's verified.

On **Render** (backend, optional — you can also keep using the
`.onrender.com` URL indefinitely):
1. Your service → **Settings → Custom Domain** → add e.g.
   `api.henilenterprise.com`.
2. Add the CNAME record Render shows you, same process as above.

**Once your custom domain is live, update these to match** (both
env-var changes require a redeploy to take effect on Vercel; Render
picks up runtime env var changes automatically):
- Render: `CORS_ORIGIN` → your new custom frontend domain
- Vercel: `VITE_API_BASE_URL` → your new custom backend domain (if you set one)
- Supabase: **Authentication → URL Configuration → Site URL** and
  **Redirect URLs** → your new custom frontend domain

---

## Step 11 — HTTPS

**Nothing to configure manually.** Both Vercel and Render provision
and auto-renew HTTPS certificates (via Let's Encrypt) automatically
once your domain's DNS is correctly pointed at them — this happens as
part of Step 10, not as a separate task. Supabase's own API is HTTPS
by default and not something you configure.

Confirm it worked: visit your custom domain and check for the padlock
icon / `https://` in the address bar with no browser warning.

---

## Step 12 — Testing production APIs

Before testing the full application, confirm the infrastructure
itself is wired correctly:

```bash
# Backend process is up:
curl https://YOUR-BACKEND-URL/api/health
# Expect: {"status":"ok","service":"henil-enterprise-backend","timestamp":"..."}

# Backend can reach Supabase:
curl https://YOUR-BACKEND-URL/api/health/db
# Expect: "database":{"status":"connected","message":"Connected to Supabase with the service_role key. company_settings has 1 row(s)."}
```

If the second call shows `"status":"not_configured"` — `SUPABASE_URL`
or `SUPABASE_SERVICE_ROLE_KEY` is missing/wrong on Render. If it shows
`"status":"error"` — check Render's logs (the real Postgres error is
logged server-side only, by design; it's never returned in the HTTP
response — see `DEPLOYMENT.md` §9).

Also open your browser's DevTools Network tab while loading the
deployed frontend, and confirm requests to
`https://YOUR-PROJECT.supabase.co/rest/v1/...` are succeeding (status
200), not failing with a CORS or 401/403 error.

---

## Step 13 — Full application test (do this in order)

Sign in with the admin account you created in Step 1, and work through
every module in this exact sequence — it mirrors the same real-world
workflow already validated during development, so a pass here confirms
production matches what was proven locally.

1. **Login** — sign in at your production URL. Confirm you land on
   `/dashboard`, not an error or blank screen.
2. **Dashboard** — confirm it loads without a console error (it will
   show placeholder/zero data until you create real records below —
   that's expected, not a bug).
3. **Clients** — create one real client. Confirm it appears in the
   list immediately after saving.
4. **Products** — create one real product with a rate and GST %.
5. **Quotations** — create a quotation for your test client, add 2+
   line items, apply a discount, confirm the GST and total calculate
   correctly, save it. Confirm the auto-generated number follows your
   Settings → Document defaults prefix.
6. **PDFs (quotation)** — on the saved quotation, click **Preview
   PDF**. Confirm it renders your real company name/address (from
   Settings) and the correct line items and totals. Try **Download**
   and **Print** too.
7. Change the quotation's status to **Accepted**, then **Create
   invoice** from it.
8. **Invoices** — confirm the new invoice shows "Converted from
   quotation" and carries over the correct line items/total.
9. **PDFs (invoice)** — repeat the Preview/Download/Print check.
10. **Payments** — record a partial payment against the invoice.
    Confirm the status becomes `PARTIALLY_PAID`. Record the remaining
    balance. Confirm it becomes `PAID`.
11. **Finance** — confirm Total Sales, Total Collected, and Net
    Revenue reflect the invoice and payment you just created.
12. **Expenses** — add one real expense. Confirm Finance's Expenses
    and Net Revenue figures update to include it.
13. **Inventory** — set opening stock for your test product, then
    record a Purchase (stock increases) and a Usage (stock
    decreases). Confirm the displayed quantity is correct after each.
14. **Files** — on your test client (or the quotation/invoice), upload
    a real PDF or image as a "customer drawing." Confirm it appears in
    the list, then **Download** it and confirm the file that opens is
    the same one you uploaded.
15. **Reports** — generate at least the Sales and Inventory reports.
    Confirm the numbers match what you created above. Try **Export
    CSV** and confirm the downloaded file opens correctly and contains
    real data.
16. **Logout** — confirm you're returned to the login screen, and that
    navigating directly to `/dashboard` afterward redirects back to
    login rather than showing cached data.

If every one of these 16 checks passes, production is working.
