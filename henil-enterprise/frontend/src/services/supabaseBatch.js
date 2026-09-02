import { supabase } from './supabaseClient.js';
import { chunkArray } from '../utils/chunkArray.js';

/*
  Fixes the class of bug where `.in(column, values)` is built from
  every row of a growing table (e.g. every product id) with no upper
  bound. Supabase/PostgREST puts that value list directly into the
  request URL (`?product_id=in.(uuid1,uuid2,...)`), and past a few
  thousand UUIDs the URL exceeds the server's max length and the
  whole request is rejected with 400 Bad Request — this is a hard
  ceiling, not a gradual slowdown, so it can go from "works fine in
  testing" to "completely broken" the moment the underlying table
  crosses that row count.

  This is the ONLY place that knows how to batch an .in() query — any
  service that filters by a potentially-large id list should call
  this rather than writing `.in(...)` directly, so every such query
  scales the same way and gets the same partial-failure handling.
*/

const DEFAULT_BATCH_SIZE = 180; // comfortably under URL length limits (UUIDs are 36 chars each) with real margin

/**
 * Runs `select` against `table` filtered by `column IN (values)`,
 * splitting `values` into batches so the request URL never grows
 * unbounded. Batches run in parallel and their rows are merged.
 *
 * Handles, per the batching requirements this exists to satisfy:
 *  - Empty `values` → returns [] immediately, no request made.
 *  - Duplicate values → de-duplicated before batching (fewer
 *    requests, no duplicate rows back).
 *  - Partial batch failure → a single failed batch (network blip,
 *    transient error) does NOT fail the whole call. The successful
 *    batches' rows are still returned, and the failure is logged
 *    with enough detail to diagnose, so a caller like the Dashboard
 *    can keep rendering with whatever data did come back rather than
 *    showing nothing at all.
 *  - Total failure (every batch fails) → throws the first error, so
 *    a genuinely broken query (bad column name, RLS denial, etc.)
 *    still surfaces clearly instead of silently returning [].
 *
 * @param {object} params
 * @param {string} params.table
 * @param {string} params.select - same string you'd pass to `.select()`
 * @param {string} params.column - the column being filtered with IN
 * @param {Array<string|number>} params.values
 * @param {number} [params.batchSize]
 * @param {(query: any) => any} [params.refineQuery] - optional hook to chain
 *   additional filters (e.g. a date range) onto every batch's query, for
 *   callers that need more than a plain `select().in()`.
 * @returns {Promise<object[]>}
 */
export async function selectInBatches({ table, select = '*', column, values, batchSize = DEFAULT_BATCH_SIZE, refineQuery }) {
  const uniqueValues = Array.from(new Set((values || []).filter((v) => v !== null && v !== undefined && v !== '')));
  if (uniqueValues.length === 0) return [];

  const batches = chunkArray(uniqueValues, batchSize);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[selectInBatches] ${table}.${column}: ${uniqueValues.length} values, batch size ${batchSize}, ${batches.length} batch(es)`);
  }

  const settled = await Promise.allSettled(
    batches.map((batch) => {
      let query = supabase.from(table).select(select).in(column, batch);
      if (refineQuery) query = refineQuery(query);
      return query;
    })
  );

  const rows = [];
  const failures = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled' && !result.value.error) {
      rows.push(...(result.value.data ?? []));
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug(`[selectInBatches] ${table}.${column} batch ${i + 1}/${batches.length}: ${batches[i].length} values ✓`);
      }
    } else {
      const error = result.status === 'fulfilled' ? result.value.error : result.reason;
      failures.push({ batchIndex: i, batchSize: batches[i].length, error });
    }
  });

  if (failures.length > 0) {
    const allFailed = failures.length === batches.length;
    const detail = `${failures.length}/${batches.length} batch(es) failed for ${table}.${column}`;
    if (allFailed) {
      // Every batch failed — this isn't a transient blip, it's a real
      // query problem (bad RLS, bad column, etc). Surface it clearly
      // rather than silently returning an empty result.
      const err = failures[0].error;
      err.message = `${detail}. First error: ${err.message}`;
      throw err;
    }
    // Partial failure: log for diagnosis, but still return whatever
    // batches DID succeed so the caller can render partial data
    // instead of nothing.
    // eslint-disable-next-line no-console
    console.error(`[selectInBatches] ${detail} — returning partial results.`, failures);
  }

  return rows;
}
