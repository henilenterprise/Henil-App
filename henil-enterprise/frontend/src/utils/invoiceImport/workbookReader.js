import * as XLSX from 'xlsx';

/**
 * @typedef {object} SheetGrid
 * @property {string} name
 * @property {any[][]} rows - 0-indexed rows of 0-indexed cells; value is null for empty
 * @property {number} rowCount
 * @property {number} colCount
 */

/**
 * Reads an uploaded .xlsx/.xls File into one grid per sheet.
 * cellDates:true so Excel serial dates arrive as real JS Date
 * objects (see normalizeDate) instead of raw serial numbers whenever
 * SheetJS can tell the cell was date-formatted.
 *
 * Merged cells: SheetJS's sheet_to_json only fills the TOP-LEFT cell
 * of a merged range; every other cell in that range comes back
 * empty. Real invoices merge cells constantly (a title spanning
 * several columns, a wrapped address cell), so every cell in a merge
 * is explicitly back-filled with the range's value here — the
 * detector and extractors below never need to know a merge happened.
 *
 * @param {File} file
 * @returns {Promise<{fileName:string, fileSize:number, sheets: SheetGrid[]}>}
 */
export async function readWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });

    // Normalize into a rectangular grid (missing trailing cells become null).
    const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
    const grid = rows.map((r) => {
      const row = r.slice(0, colCount);
      while (row.length < colCount) row.push(null);
      return row.map((v) => (v === '' ? null : v));
    });

    for (const merge of ws['!merges'] || []) {
      const topLeft = grid[merge.s.r]?.[merge.s.c] ?? null;
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        if (!grid[r]) continue;
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (r === merge.s.r && c === merge.s.c) continue;
          if (c < grid[r].length) grid[r][c] = topLeft;
        }
      }
    }

    return { name, rows: grid, rowCount: grid.length, colCount };
  });

  return { fileName: file.name, fileSize: file.size, sheets };
}

export function cellAt(grid, r, c) {
  return grid.rows[r]?.[c] ?? null;
}

/** First non-empty cell strictly to the right of (r,c) in the same row. */
export function firstNonEmptyRight(grid, r, c) {
  const row = grid.rows[r] || [];
  for (let cc = c + 1; cc < row.length; cc++) {
    if (row[cc] !== null && row[cc] !== undefined && String(row[cc]).trim() !== '') return { row: r, col: cc, value: row[cc] };
  }
  return null;
}

/** First non-empty cell directly below (r,c), searching down to `maxDown` rows. */
export function firstNonEmptyBelow(grid, r, c, maxDown = 3) {
  for (let rr = r + 1; rr <= r + maxDown && rr < grid.rows.length; rr++) {
    const v = grid.rows[rr]?.[c];
    if (v !== null && v !== undefined && String(v).trim() !== '') return { row: rr, col: c, value: v };
  }
  return null;
}

/** True if every cell in the row range [r] is empty. */
export function isBlankRow(grid, r) {
  const row = grid.rows[r] || [];
  return row.every((v) => v === null || v === undefined || String(v).trim() === '');
}
