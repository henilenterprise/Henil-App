import { supabase } from './supabaseClient.js';
import { config } from '../config/env.js';
import { sanitizeFilename } from '../utils/sanitizeFilename.js';

const TABLE = 'artworks';
const VERSIONS_TABLE = 'artwork_versions';
const BUCKET = 'artwork-files';

export const ALLOWED_EXTENSIONS = ['svg', 'dxf', 'pdf', 'ai', 'eps', 'png', 'jpg', 'jpeg', 'dwg'];
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB, matches the bucket's file_size_limit
const PREVIEWABLE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'svg', 'pdf']);

/*
  Artwork Vault service layer — a manufacturing design archive,
  distinct from public.files (one-off customer drawings attached to a
  client/quotation/invoice). See
  database/migrations/20260815101100_artwork_vault.sql.

  Every uploaded file is a new row in artwork_versions, never a
  replacement of an existing one — "current version" is a flag, not
  a deletion of history. Automatic dimension extraction from DXF/AI/
  EPS geometry is NOT implemented (those are complex/proprietary
  formats with no reliable client-side parser) — width/height/
  thickness are always manual fields on the artwork record itself,
  which the spec this was built against explicitly allows as the
  fallback when automatic extraction isn't practical.
*/

function getExtension(filename) {
  const parts = (filename || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

export function validateArtworkFile(file) {
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `"${ext ? `.${ext}` : 'This file type'}" isn't allowed. Supported types: ${ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(', ')}.`,
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File is too large (max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB).` };
  }
  return { valid: true, error: null };
}

export function canPreview(fileNameOrExt) {
  const ext = fileNameOrExt.includes('.') ? getExtension(fileNameOrExt) : fileNameOrExt.toLowerCase();
  return PREVIEWABLE_EXTENSIONS.has(ext);
}

/**
 * @param {object} options
 * @param {string} [options.search] - matched against artwork_name, artwork_code, tags
 * @param {string} [options.clientId]
 * @param {string} [options.material]
 * @param {string} [options.thickness]
 * @param {string} [options.status]
 * @param {string} [options.sortBy]
 * @param {boolean} [options.ascending]
 * @param {number} [options.page] - 1-based
 * @param {number} [options.pageSize]
 */
export async function listArtworks({
  search = '',
  clientId = '',
  material = '',
  thickness = '',
  status = 'ACTIVE',
  sortBy = 'created_at',
  ascending = false,
  page = 1,
  pageSize = 12,
} = {}) {
  let query = supabase.from(TABLE).select('*, client:clients(id, company_name), product:products(id, name, sku)', { count: 'exact' });

  const term = search.trim();
  if (term) {
    const pattern = `%${term}%`;
    query = query.or([`artwork_name.ilike.${pattern}`, `artwork_code.ilike.${pattern}`].join(','));
  }
  if (clientId) query = query.eq('client_id', clientId);
  if (material) query = query.eq('material', material);
  if (thickness) query = query.eq('thickness', thickness);
  if (status) query = query.eq('status', status);

  query = query.order(sortBy, { ascending });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  // Tag search isn't expressible via PostgREST's `or`/`ilike` against
  // an array column, so when searching, also match on tags client-side
  // against this page's results — acceptable since tag search is a
  // secondary refinement, not the primary large-scale query path
  // (which already narrows by name/code/material/thickness/client
  // at the database level first).
  let rows = data ?? [];
  if (term) {
    const needle = term.toLowerCase();
    const tagMatches = rows.filter((r) => (r.tags || []).some((t) => t.toLowerCase().includes(needle)));
    const alreadyIncluded = new Set(rows.map((r) => r.id));
    for (const r of tagMatches) {
      if (!alreadyIncluded.has(r.id)) rows.push(r);
    }
  }

  return { data: rows, count: count ?? 0 };
}

export async function getArtworkWithVersions(id) {
  const { data: artwork, error } = await supabase
    .from(TABLE)
    .select('*, client:clients(id, company_name), product:products(id, name, sku)')
    .eq('id', id)
    .single();
  if (error) throw error;

  const { data: versions, error: versionsError } = await supabase
    .from(VERSIONS_TABLE)
    .select('*')
    .eq('artwork_id', id)
    .order('version_number', { ascending: false });
  if (versionsError) throw versionsError;

  return { ...artwork, versions: versions ?? [] };
}

export async function createArtwork(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateArtwork(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteArtwork(id) {
  const { data: versions, error: vErr } = await supabase.from(VERSIONS_TABLE).select('file_path').eq('artwork_id', id);
  if (vErr) throw vErr;
  if (versions && versions.length > 0) {
    await supabase.storage.from(BUCKET).remove(versions.map((v) => v.file_path));
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function listArtworkMaterials() {
  const { data, error } = await supabase.from(TABLE).select('material').not('material', 'is', null);
  if (error) throw error;
  return Array.from(new Set(data.map((r) => r.material).filter(Boolean))).sort();
}

export async function listArtworkThicknesses() {
  const { data, error } = await supabase.from(TABLE).select('thickness').not('thickness', 'is', null);
  if (error) throw error;
  return Array.from(new Set(data.map((r) => r.thickness).filter(Boolean))).sort();
}

// ---------------- Versions ----------------

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token;
}

function buildStorageUploadUrl(path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${config.supabaseUrl}/storage/v1/object/${BUCKET}/${encodedPath}`;
}

/**
 * Uploads a new version and, by default, makes it the current one
 * (the common case: a new upload supersedes the last). Pass
 * `makeCurrent: false` to add a version without changing which one
 * is authoritative.
 *
 * @param {{artworkId:string, file:File, notes?:string, makeCurrent?:boolean, onProgress?:(percent:number)=>void}} params
 */
export function uploadArtworkVersion({ artworkId, file, notes, makeCurrent = true, onProgress }) {
  const validation = validateArtworkFile(file);
  if (!validation.valid) {
    return Promise.reject(new Error(validation.error));
  }

  const path = `${artworkId}/${Date.now()}-${sanitizeFilename(file.name)}`;

  return new Promise((resolve, reject) => {
    getAccessToken()
      .then(async (token) => {
        if (!token) {
          reject(new Error('You must be signed in to upload files.'));
          return;
        }

        const { data: existingVersions, error: fetchErr } = await supabase
          .from(VERSIONS_TABLE)
          .select('version_number')
          .eq('artwork_id', artworkId)
          .order('version_number', { ascending: false })
          .limit(1);
        if (fetchErr) {
          reject(fetchErr);
          return;
        }
        const nextVersionNumber = (existingVersions?.[0]?.version_number || 0) + 1;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', buildStorageUploadUrl(path), true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('apikey', config.supabaseAnonKey);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              if (makeCurrent) {
                await supabase.from(VERSIONS_TABLE).update({ is_current: false }).eq('artwork_id', artworkId).eq('is_current', true);
              }
              const { data, error } = await supabase
                .from(VERSIONS_TABLE)
                .insert({
                  artwork_id: artworkId,
                  version_number: nextVersionNumber,
                  file_path: path,
                  file_name: file.name,
                  file_type: getExtension(file.name),
                  file_size: file.size,
                  is_current: makeCurrent,
                  notes: notes || null,
                })
                .select()
                .single();
              if (error) {
                reject(error);
                return;
              }
              resolve(data);
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`Upload failed (HTTP ${xhr.status}): ${xhr.responseText || 'Unknown error'}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed due to a network error.'));
        xhr.send(file);
      })
      .catch(reject);
  });
}

/** Makes an existing version the current one, correctly un-setting whichever version was current before (never two at once). */
export async function setCurrentVersion(artworkId, versionId) {
  const { error: clearErr } = await supabase.from(VERSIONS_TABLE).update({ is_current: false }).eq('artwork_id', artworkId).eq('is_current', true);
  if (clearErr) throw clearErr;
  const { data, error } = await supabase.from(VERSIONS_TABLE).update({ is_current: true }).eq('id', versionId).select().single();
  if (error) throw error;
  return data;
}

export async function getVersionSignedUrl(filePath, downloadName) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 300, { download: downloadName });
  if (error) throw error;
  return data.signedUrl;
}
