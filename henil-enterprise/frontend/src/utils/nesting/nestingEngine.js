/*
  Rectangle nesting / 2D bin-packing engine.

  A real guillotine-split, best-area-fit algorithm — not a naive
  "place things in a grid" placeholder. Parts are sorted largest-area
  first (a standard, well-justified heuristic: placing big pieces
  first and filling in smaller ones around them consistently
  outperforms placing in input order), then each part instance is
  placed into whichever free rectangle (across all currently-open
  sheets, in either orientation if rotation is allowed) leaves the
  least wasted area, using a guillotine split — the free rectangle
  the part lands in divides cleanly into a "right of the part" and
  "below the part" remainder, with no overlap and no gaps other than
  the part itself.

  This module deliberately knows nothing about React, Supabase, or
  the database — it's a pure function of its inputs, which is what
  makes it practical to unit-test exhaustively (see
  nestingEngine.test approach) and what the project brief's "the
  architecture should allow a more advanced nesting engine to be
  integrated later" is asking for: runNesting() is a clean seam a
  smarter algorithm (true MaxRects with rectangle merging, genetic/
  simulated-annealing approaches, irregular/polygon nesting for
  non-rectangular parts) could replace without touching any UI code.
*/

function area(w, h) {
  return w * h;
}

function splitFreeRect(free, placedW, placedH) {
  // Guillotine split: the placed footprint sits flush in the
  // free rectangle's top-left corner. The remaining L-shaped area
  // divides into a piece to the right and a piece below — together
  // they exactly tile the rest of the free rectangle with no
  // overlap and no gap.
  const pieces = [];
  const rightW = free.w - placedW;
  if (rightW > 0.001) {
    pieces.push({ x: free.x + placedW, y: free.y, w: rightW, h: placedH });
  }
  const bottomH = free.h - placedH;
  if (bottomH > 0.001) {
    pieces.push({ x: free.x, y: free.y + placedH, w: free.w, h: bottomH });
  }
  return pieces;
}

/**
 * @param {object} params
 * @param {number} params.sheetWidth
 * @param {number} params.sheetHeight
 * @param {number} [params.kerf=0]
 * @param {number} [params.spacing=0]
 * @param {number} [params.edgeMargin=0]
 * @param {boolean} [params.allowRotation=true] - job-level default
 * @param {Array<{id:string, name:string, width:number, height:number, quantity:number, allowRotation?:boolean}>} params.parts
 * @returns {{
 *   sheetsRequired: number,
 *   totalRequested: number,
 *   totalPlaced: number,
 *   utilizationPct: number,
 *   wasteArea: number,
 *   sheetArea: number,
 *   placements: Array<{sheetIndex:number, partId:string, name:string, x:number, y:number, w:number, h:number, rotated:boolean}>,
 *   unplaced: Array<{partId:string, name:string, quantity:number, reason:string}>,
 * }}
 */
export function runNesting({ sheetWidth, sheetHeight, kerf = 0, spacing = 0, edgeMargin = 0, allowRotation = true, parts }) {
  const usableW = sheetWidth - 2 * edgeMargin;
  const usableH = sheetHeight - 2 * edgeMargin;
  const gap = kerf + spacing;

  if (usableW <= 0 || usableH <= 0) {
    return {
      sheetsRequired: 0,
      totalRequested: parts.reduce((s, p) => s + p.quantity, 0),
      totalPlaced: 0,
      utilizationPct: 0,
      wasteArea: 0,
      sheetArea: sheetWidth * sheetHeight,
      placements: [],
      unplaced: parts.map((p) => ({ partId: p.id, name: p.name, quantity: p.quantity, reason: 'Edge margin leaves no usable sheet area.' })),
    };
  }

  // Expand quantities into individual instances, then sort largest-area-first.
  const instances = [];
  for (const part of parts) {
    for (let i = 0; i < part.quantity; i += 1) {
      instances.push({
        partId: part.id,
        name: part.name,
        width: part.width,
        height: part.height,
        allowRotation: part.allowRotation ?? allowRotation,
      });
    }
  }
  instances.sort((a, b) => area(b.width, b.height) - area(a.width, a.height));

  const sheets = []; // each: { freeRects: [...] }
  const placements = [];
  const unplacedCounts = new Map(); // partId -> { name, quantity, reason }

  function tryPlaceOnSheet(sheetIndex, instance) {
    const sheet = sheets[sheetIndex];
    const orientations = [{ w: instance.width, h: instance.height, rotated: false }];
    if (instance.allowRotation && instance.width !== instance.height) {
      orientations.push({ w: instance.height, h: instance.width, rotated: true });
    }

    let best = null; // { freeIdx, orientation, leftoverArea }
    for (let fi = 0; fi < sheet.freeRects.length; fi += 1) {
      const free = sheet.freeRects[fi];
      for (const o of orientations) {
        const footprintW = o.w + gap;
        const footprintH = o.h + gap;
        if (footprintW <= free.w + 0.001 && footprintH <= free.h + 0.001) {
          const leftover = free.w * free.h - footprintW * footprintH;
          if (!best || leftover < best.leftoverArea) {
            best = { freeIdx: fi, orientation: o, leftoverArea: leftover, footprintW, footprintH };
          }
        }
      }
    }

    if (!best) return false;

    const free = sheet.freeRects[best.freeIdx];
    placements.push({
      sheetIndex,
      partId: instance.partId,
      name: instance.name,
      x: free.x,
      y: free.y,
      w: best.orientation.w,
      h: best.orientation.h,
      rotated: best.orientation.rotated,
    });
    const newPieces = splitFreeRect(free, best.footprintW, best.footprintH);
    sheet.freeRects.splice(best.freeIdx, 1, ...newPieces);
    return true;
  }

  for (const instance of instances) {
    let placed = false;
    for (let s = 0; s < sheets.length && !placed; s += 1) {
      placed = tryPlaceOnSheet(s, instance);
    }
    if (!placed) {
      // Does it even fit alone on a fresh sheet, in any allowed orientation?
      const fitsNormal = instance.width + gap <= usableW + 0.001 && instance.height + gap <= usableH + 0.001;
      const fitsRotated =
        instance.allowRotation && instance.height + gap <= usableW + 0.001 && instance.width + gap <= usableH + 0.001;
      if (!fitsNormal && !fitsRotated) {
        const key = instance.partId;
        const existing = unplacedCounts.get(key);
        if (existing) existing.quantity += 1;
        else
          unplacedCounts.set(key, {
            partId: instance.partId,
            name: instance.name,
            quantity: 1,
            reason: `${instance.width} \u00d7 ${instance.height} does not fit within the usable sheet area (${usableW.toFixed(1)} \u00d7 ${usableH.toFixed(1)}) in any allowed orientation.`,
          });
        continue;
      }
      sheets.push({ freeRects: [{ x: 0, y: 0, w: usableW, h: usableH }] });
      placed = tryPlaceOnSheet(sheets.length - 1, instance);
      // Should always succeed given the fit check above; if it
      // somehow doesn't (defensive), report rather than silently drop.
      if (!placed) {
        const key = instance.partId;
        const existing = unplacedCounts.get(key);
        if (existing) existing.quantity += 1;
        else unplacedCounts.set(key, { partId: instance.partId, name: instance.name, quantity: 1, reason: 'Could not be placed by the current algorithm.' });
      }
    }
  }

  // Shift placements from usable-area-relative to full-sheet-relative coordinates.
  const shiftedPlacements = placements.map((p) => ({ ...p, x: p.x + edgeMargin, y: p.y + edgeMargin }));

  const sheetArea = sheetWidth * sheetHeight;
  const totalUsedArea = placements.reduce((s, p) => s + p.w * p.h, 0);
  const sheetsRequired = sheets.length;
  const totalRequested = parts.reduce((s, p) => s + p.quantity, 0);

  return {
    sheetsRequired,
    totalRequested,
    totalPlaced: placements.length,
    utilizationPct: sheetsRequired > 0 ? round2((totalUsedArea / (sheetsRequired * sheetArea)) * 100) : 0,
    wasteArea: round2(sheetsRequired * sheetArea - totalUsedArea),
    sheetArea,
    placements: shiftedPlacements,
    unplaced: Array.from(unplacedCounts.values()),
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
