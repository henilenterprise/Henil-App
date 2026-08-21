import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes.js';
import { config } from './config/env.js';

/*
  This backend intentionally only exposes health-check routes. Every
  data operation (clients, products, quotations, invoices, payments,
  finance, expenses, inventory, files, reports, settings, auth) goes
  frontend -> Supabase directly via @supabase/supabase-js. PostgREST
  (Supabase's auto-generated REST API) is the real API surface for
  this application, secured by the Row Level Security policies in
  database/migrations — not by a custom Express layer. See
  database/migrations/20260815100700_role_based_access_control.sql
  for the full authorization model.

  CORS_ORIGIN must be set to the real frontend URL in production
  (see backend/.env.example) — the http://localhost:5173 default
  below only applies when the env var isn't set.
*/
const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.use('/api/health', healthRoutes);

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler.
// SECURITY: never echo a raw error message to the client by default —
// only a route explicitly marking an error safe via `err.expose = true`
// gets its message forwarded (matches the common http-errors
// convention). Everything else returns a generic message; full
// details always go to the server log, never over the wire.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const message = err.expose && err.message ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
});

export default app;
