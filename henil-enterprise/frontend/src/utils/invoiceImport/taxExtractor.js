import { cellText, normalizeAmount, normalizePercent } from './normalize.js';
import { TAX_NAME_PATTERNS, TAX_LINE_EXCLUDE, matchesAny } from './markers.js';

/**
 * Scans rows [fromRow, toRow] (inclusive) — normally "just after the
 * item table" through "end of the invoice block" — for named tax
 * lines. Deliberately does NOT hardcode a single tax type: any label
 * cell matching one of markers.TAX_NAME_PATTERNS and not matching
 * TAX_LINE_EXCLUDE (subtotal/total/boilerplate/tax-number lines) is
 * treated as a tax line.
 *
 * Rate resolution order (see the "0.04 vs 4" requirement):
 *   1. An explicit "%N" in the label text itself (e.g. "CGST-9%",
 *      "OUTPUT VAT@4%") — always trusted first, it's unambiguous.
 *   2. A same-row numeric cell that is itself < 1, treated as a
 *      fraction (→ ×100) ONLY as a fallback when the label had no
 *      inline "%".
 *   3. Otherwise the rate is left null (still imports the amount,
 *      just without a rate — never guessed).
 *
 * @returns {{name:string, rate:number|null, amount:number, sourceRow:number}[]}
 */
export function extractTaxLines(grid, block, fromRow, toRow) {
  const lines = [];
  for (let r = Math.max(fromRow, block.startRow); r <= Math.min(toRow, block.endRow); r++) {
    const row = grid.rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const text = cellText(row[c]);
      if (!text) continue;
      if (matchesAny(text, TAX_LINE_EXCLUDE)) continue;

      const pattern = TAX_NAME_PATTERNS.find((p) => p.re.test(text));
      if (!pattern) continue;

      const inlineRate = normalizePercent(text);
      let rate = inlineRate;
      const numericCells = row
        .map((v, idx) => ({ idx, v: normalizeAmount(v) }))
        .filter((cell) => cell.v !== null && cell.idx !== c);

      if (rate === null) {
        const fractionCell = numericCells.find((cell) => cell.v > 0 && cell.v < 1);
        if (fractionCell) rate = normalizePercent(fractionCell.v, { treatFractionAsPercent: true });
      }

      // Amount = the rightmost numeric cell in the row that isn't the
      // fractional rate cell we just consumed for `rate`.
      const rateCellIdx = rate !== null && inlineRate === null ? numericCells.find((cell) => cell.v > 0 && cell.v < 1)?.idx : null;
      const amountCells = numericCells.filter((cell) => cell.idx !== rateCellIdx);
      const amount = amountCells.length > 0 ? amountCells[amountCells.length - 1].v : null;

      if (amount === null) continue; // a tax keyword with no discernible amount isn't a usable tax line

      lines.push({ name: pattern.name, rate, amount, sourceRow: r });
      break; // one tax line per row
    }
  }
  return lines;
}
