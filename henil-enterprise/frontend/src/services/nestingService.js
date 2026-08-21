import { supabase } from './supabaseClient.js';
import { runNesting } from '../utils/nesting/nestingEngine.js';

const JOBS_TABLE = 'nesting_jobs';
const PARTS_TABLE = 'nesting_parts';

/*
  Nesting Optimizer service layer. Lives inside the Artwork Vault
  (shares its 'artwork' RBAC module). The actual packing math is in
  utils/nesting/nestingEngine.js, a pure function with no database
  knowledge — this file's job is only persistence: save a job's
  sheet/part setup, run the engine, store the result, load it back.
*/

export async function listNestingJobs({ search = '', page = 1, pageSize = 12 } = {}) {
  let query = supabase.from(JOBS_TABLE).select('*, client:clients(id, company_name)', { count: 'exact' });
  const term = search.trim();
  if (term) {
    query = query.or([`job_name.ilike.%${term}%`, `job_code.ilike.%${term}%`].join(','));
  }
  query = query.order('created_at', { ascending: false });
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function getNestingJobWithParts(id) {
  const { data: job, error } = await supabase.from(JOBS_TABLE).select('*, client:clients(id, company_name)').eq('id', id).single();
  if (error) throw error;
  const { data: parts, error: partsError } = await supabase
    .from(PARTS_TABLE)
    .select('*')
    .eq('nesting_job_id', id)
    .order('sort_order', { ascending: true });
  if (partsError) throw partsError;
  return { ...job, parts: parts ?? [] };
}

function toPartRow(jobId, part, index) {
  return {
    nesting_job_id: jobId,
    artwork_id: part.artwork_id || null,
    part_name: part.part_name,
    width: Number(part.width),
    height: Number(part.height),
    quantity: Number(part.quantity),
    allow_rotation: part.allow_rotation === undefined || part.allow_rotation === null ? null : Boolean(part.allow_rotation),
    sort_order: index,
  };
}

export async function createNestingJob(job, parts) {
  const { data: created, error } = await supabase
    .from(JOBS_TABLE)
    .insert({
      job_name: job.job_name,
      client_id: job.client_id || null,
      material: job.material || null,
      thickness: job.thickness || null,
      sheet_width: Number(job.sheet_width),
      sheet_height: Number(job.sheet_height),
      kerf: Number(job.kerf) || 0,
      spacing: Number(job.spacing) || 0,
      edge_margin: Number(job.edge_margin) || 0,
      allow_rotation: Boolean(job.allow_rotation),
      notes: job.notes || null,
    })
    .select()
    .single();
  if (error) throw error;

  if (parts.length > 0) {
    const rows = parts.map((p, i) => toPartRow(created.id, p, i));
    const { error: partsError } = await supabase.from(PARTS_TABLE).insert(rows);
    if (partsError) throw partsError;
  }
  return created;
}

export async function updateNestingJob(id, job, parts) {
  const { error } = await supabase
    .from(JOBS_TABLE)
    .update({
      job_name: job.job_name,
      client_id: job.client_id || null,
      material: job.material || null,
      thickness: job.thickness || null,
      sheet_width: Number(job.sheet_width),
      sheet_height: Number(job.sheet_height),
      kerf: Number(job.kerf) || 0,
      spacing: Number(job.spacing) || 0,
      edge_margin: Number(job.edge_margin) || 0,
      allow_rotation: Boolean(job.allow_rotation),
      notes: job.notes || null,
    })
    .eq('id', id);
  if (error) throw error;

  const { error: deleteErr } = await supabase.from(PARTS_TABLE).delete().eq('nesting_job_id', id);
  if (deleteErr) throw deleteErr;
  if (parts.length > 0) {
    const rows = parts.map((p, i) => toPartRow(id, p, i));
    const { error: insertErr } = await supabase.from(PARTS_TABLE).insert(rows);
    if (insertErr) throw insertErr;
  }
}

export async function deleteNestingJob(id) {
  const { error } = await supabase.from(JOBS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

/**
 * Runs the packing engine against a job's current sheet settings and
 * parts, and persists the result onto the job row. Does not require
 * the job to have been saved first — pass unsaved `parts` directly
 * to preview a calculation before saving.
 */
export function calculateNesting(job, parts) {
  return runNesting({
    sheetWidth: Number(job.sheet_width),
    sheetHeight: Number(job.sheet_height),
    kerf: Number(job.kerf) || 0,
    spacing: Number(job.spacing) || 0,
    edgeMargin: Number(job.edge_margin) || 0,
    allowRotation: Boolean(job.allow_rotation),
    parts: parts.map((p, i) => ({
      id: p.id || p.tempId || `part-${i}`,
      name: p.part_name,
      width: Number(p.width),
      height: Number(p.height),
      quantity: Number(p.quantity),
      allowRotation: p.allow_rotation === undefined || p.allow_rotation === null ? undefined : Boolean(p.allow_rotation),
    })),
  });
}

export async function saveNestingResult(id, result) {
  const { error } = await supabase
    .from(JOBS_TABLE)
    .update({
      result_computed_at: new Date().toISOString(),
      result_sheets_required: result.sheetsRequired,
      result_total_requested: result.totalRequested,
      result_total_placed: result.totalPlaced,
      result_utilization_pct: result.utilizationPct,
      result_waste_area: result.wasteArea,
      result_placements: result.placements,
      result_unplaced: result.unplaced,
    })
    .eq('id', id);
  if (error) throw error;
}
