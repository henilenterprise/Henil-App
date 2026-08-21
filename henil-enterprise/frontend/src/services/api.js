import { config } from '../config/env.js';

/*
  Backend API service helper.
  Real API service modules (auth, clients, products, etc.) will be
  added alongside their respective backend routes in later phases.
*/
export async function getBackendHealth() {
  const response = await fetch(`${config.apiBaseUrl}/api/health`);
  if (!response.ok) {
    throw new Error(`Backend health check failed: ${response.status}`);
  }
  return response.json();
}

export async function getBackendDatabaseHealth() {
  const response = await fetch(`${config.apiBaseUrl}/api/health/db`);
  const body = await response.json();
  // Don't throw on non-2xx here — the /db endpoint intentionally
  // returns a 200 with status: "not_configured" or "error" so the
  // caller can render the reason, not just a generic failure.
  return body;
}
