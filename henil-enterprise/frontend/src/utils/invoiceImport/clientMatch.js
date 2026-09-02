import { normalizeKey, similarity } from './normalize.js';

const EXACT_THRESHOLD = 1.0;
const POSSIBLE_THRESHOLD = 0.82; // e.g. "LIGHTRONICS" vs "Lightronics Pvt Ltd" territory — tune here only, nowhere else

/**
 * @param {string} buyerName
 * @param {{id:string, company_name:string}[]} existingClients
 * @returns {{status:'exact'|'possible'|'none', clientId:string|null, candidates:{id:string, company_name:string, score:number}[]}}
 */
export function matchClient(buyerName, existingClients) {
  if (!buyerName || !buyerName.trim()) return { status: 'none', clientId: null, candidates: [] };

  const target = normalizeKey(buyerName);
  const exact = existingClients.find((c) => normalizeKey(c.company_name) === target);
  if (exact) return { status: 'exact', clientId: exact.id, candidates: [{ id: exact.id, company_name: exact.company_name, score: 1 }] };

  const scored = existingClients
    .map((c) => ({ id: c.id, company_name: c.company_name, score: similarity(c.company_name, buyerName) }))
    .filter((c) => c.score >= POSSIBLE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) return { status: 'possible', clientId: null, candidates: scored.slice(0, 5) };
  return { status: 'none', clientId: null, candidates: [] };
}
