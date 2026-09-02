/*
  Pure, dependency-free normalization helpers for the invoice
  importer. Nothing here talks to Supabase or React — this file (and
  the rest of utils/invoiceImport/) is deliberately framework-free so
  it can be unit-tested in isolation, same philosophy as
  quotationCalculations.js.
*/

export function isEmptyCell(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

export function cellText(v) {
  if (isEmptyCell(v)) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/**
 * Parses a number that may be formatted as an Indian invoice would
 * show it: "45000", "45,000", "₹45,000.00", "Rs. 45000", "(500)" for
 * a negative/adjustment, or already a plain JS number.
 * @returns {number|null} null if the cell is empty or not numeric at all.
 */
export function normalizeAmount(v) {
  if (isEmptyCell(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s);
  s = s.replace(/^\(|\)$/g, '');
  s = s.replace(/[₹$]|rs\.?|inr/gi, '');
  s = s.replace(/,/g, '');
  s = s.trim();
  if (s === '' || s === '-') return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}

/**
 * Parses a percentage that may appear as "4%", "4", or a fraction
 * like 0.04 IF the source explicitly marked it as a fraction (the
 * caller decides that — this function never silently assumes 0.04
 * means 4%, per the "don't turn 0.04 into 4" requirement). Use
 * `treatFractionAsPercent: true` only when you already know the cell
 * is a fraction-of-one representation (e.g. Excel's own "Percentage"
 * cell format), not just because the value happens to be under 1.
 */
export function normalizePercent(v, { treatFractionAsPercent = false } = {}) {
  if (isEmptyCell(v)) return null;
  if (typeof v === 'number') {
    return treatFractionAsPercent ? v * 100 : v;
  }
  const s = String(v).trim();
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (m) return Number(m[1]);
  const n = Number(s.replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  return treatFractionAsPercent ? n * 100 : n;
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Normalizes a date to YYYY-MM-DD. Handles:
 *  - JS Date objects (SheetJS with cellDates:true hands these back
 *    already correctly converted from Excel's serial number)
 *  - Excel serial numbers (if a cell came through as a raw number)
 *  - DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, YYYY-MM-DD text
 *  - "3-Jun-2017" / "03 Jun 2017" style text
 *
 * Day/month ambiguity (e.g. "03/04/2026"): resolved DAY-FIRST, matching
 * this application's Indian locale (see utils/indianStates.js and the
 * GST-format invoices) — NOT swapped to month-first. When a value is
 * unambiguous (day > 12) it's used as-is regardless of position.
 *
 * @returns {string|null} ISO date, or null if genuinely unparseable
 *   (caller must treat null as "needs review", never guess a date).
 */
export function normalizeDate(v) {
  if (isEmptyCell(v)) return null;

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return toIso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }

  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel serial date (days since 1899-12-30, matching Excel's own
    // leap-year-bug epoch, which SheetJS's own conversion also uses).
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86400000);
    if (Number.isNaN(d.getTime())) return null;
    return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  const s = String(v).trim();
  if (!s) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));

  // DD Mon YYYY / DD-Mon-YYYY / DD Mon YY  (e.g. "3-Jun-2017")
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,})[\s-]+(\d{2,4})$/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (month) return toIso(fullYear(Number(m[3])), month, Number(m[1]));
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD.MM.YYYY — day-first (locale rule above)
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = fullYear(Number(m[3]));
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return toIso(year, month, day);
    return null; // e.g. "13/13/2026" — genuinely invalid, don't guess
  }

  // Last resort: let the JS Date parser try (handles things like
  // "2026-04-18T00:00:00.000Z" that already came through as ISO text).
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());

  return null;
}

function fullYear(y) {
  if (y >= 100) return y;
  return y <= 49 ? 2000 + y : 1900 + y;
}

function toIso(y, m, d) {
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Uppercase, punctuation/whitespace-collapsed form, for matching client names and detecting duplicate labels. */
export function normalizeKey(s) {
  return cellText(s)
    .toUpperCase()
    .replace(/[.,'’"()/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein edit distance — small and dependency-free, only used for short company-name strings. */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** 1.0 = identical (after normalizeKey), 0.0 = completely different. */
export function similarity(a, b) {
  const na = normalizeKey(a);
  const nb = normalizeKey(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

export function round2(n) {
  const v = Number(n) || 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
