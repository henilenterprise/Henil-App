/*
  SECURITY: sanitizes a user-supplied filename before it's used as
  part of a Supabase Storage object key. A browser File object's
  `.name` is fully attacker/user-controlled (it's just whatever the
  uploader's OS reports) and was previously interpolated directly
  into storage paths in filesService.js, expensesService.js, and
  companySettingsService.js with no sanitization at all.

  Supabase Storage keys are flat, S3-style strings, not real
  filesystem paths, so a value like "../../secret.pdf" doesn't
  actually traverse outside a bucket the way it would on a real
  filesystem — but stripping path separators and control characters
  here is still correct defense-in-depth: it keeps a malicious or
  malformed name from producing an object key with unexpected extra
  "/" segments (which could otherwise look like it belongs under a
  different owner's prefix, confuse anything that parses the path,
  or just produce a broken/unusable key), and removes non-printable
  characters some storage backends reject outright.
*/
export function sanitizeFilename(name) {
  const fallback = 'file';
  if (!name || typeof name !== 'string') return fallback;

  const base = name
    .replace(/[/\\]/g, '_') // path separators
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '') // control characters
    .replace(/^\.+/, '') // leading dots (hidden files, ".." segments)
    .trim();

  const cleaned = base || fallback;
  // Keep filenames reasonable for storage APIs and UI display.
  return cleaned.length > 200 ? cleaned.slice(-200) : cleaned;
}
