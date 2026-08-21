/*
  Supabase/PostgREST errors come back as plain objects like
  { message, code, details, hint } — NOT JavaScript Error instances.
  `err instanceof Error` is false for them, so a naive
  `err instanceof Error ? err.message : String(err)` check prints
  "[object Object]" instead of the real message. This helper handles
  both real Error instances and Supabase-style error objects.
*/
export function getErrorMessage(err) {
  if (!err) return 'An unknown error occurred.';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
