import { supabase } from './supabaseClient.js';
import { config } from '../config/env.js';
import { sanitizeFilename } from '../utils/sanitizeFilename.js';

const BUCKET = 'project-files';

export const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'dxf', 'dwg'];
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB, matches the bucket's file_size_limit

const PREVIEWABLE_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg']);

/*
  Files service layer — Storage bucket "project-files" (see
  database/migrations/20260815100600_project_files_storage.sql) for
  client/quotation/invoice attachments (customer drawings, project
  files). Expense receipts use a separate bucket/service
  (expensesService.js) with looser file-type rules.

  Type checking is allow-list by EXTENSION, not MIME type: browsers
  report inconsistent (or no) MIME type for CAD formats like DXF/DWG,
  so extension is the only reliable signal, both here and in the
  database's own CHECK constraint. An allow-list (only pdf/png/jpg/
  jpeg/dxf/dwg can ever be selected) is also what actually satisfies
  "reject dangerous executable files" — nothing else gets through,
  which is stronger than trying to blocklist every dangerous
  extension individually.

  Upload progress: supabase-js's storage.upload() does not expose
  progress events (it wraps fetch, not XHR). To get real byte-level
  progress, uploadFile() below talks to the Storage REST endpoint
  directly via XMLHttpRequest, then uses supabase-js normally for
  the metadata insert, signed URLs, and delete.
*/

function getExtension(filename) {
  const parts = (filename || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

export function validateFile(file) {
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
  return PREVIEWABLE_IMAGE_EXTENSIONS.has(ext) || ext === 'pdf';
}

export function isPreviewableImage(fileNameOrExt) {
  const ext = fileNameOrExt.includes('.') ? getExtension(fileNameOrExt) : fileNameOrExt.toLowerCase();
  return PREVIEWABLE_IMAGE_EXTENSIONS.has(ext);
}

function ownerFolder({ clientId, quotationId, invoiceId }) {
  if (clientId) return `client/${clientId}`;
  if (quotationId) return `quotation/${quotationId}`;
  if (invoiceId) return `invoice/${invoiceId}`;
  throw new Error('A file must belong to a client, quotation, or invoice.');
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token;
}

function buildStorageUploadUrl(path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${config.supabaseUrl}/storage/v1/object/${BUCKET}/${encodedPath}`;
}

/**
 * @param {{file:File, clientId?:string, quotationId?:string, invoiceId?:string, onProgress?:(percent:number)=>void}} params
 */
export function uploadFile({ file, clientId, quotationId, invoiceId, onProgress }) {
  const validation = validateFile(file);
  if (!validation.valid) {
    return Promise.reject(new Error(validation.error));
  }

  let folder;
  try {
    folder = ownerFolder({ clientId, quotationId, invoiceId });
  } catch (err) {
    return Promise.reject(err);
  }
  const path = `${folder}/${Date.now()}-${sanitizeFilename(file.name)}`;

  return new Promise((resolve, reject) => {
    getAccessToken()
      .then((token) => {
        if (!token) {
          reject(new Error('You must be signed in to upload files.'));
          return;
        }

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
              const { data, error } = await supabase
                .from('files')
                .insert({
                  client_id: clientId || null,
                  quotation_id: quotationId || null,
                  invoice_id: invoiceId || null,
                  file_name: file.name,
                  file_path: path,
                  file_type: getExtension(file.name),
                  file_size: file.size,
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

export async function listFiles({ clientId, quotationId, invoiceId }) {
  let query = supabase.from('files').select('*').order('created_at', { ascending: false });
  if (clientId) query = query.eq('client_id', clientId);
  if (quotationId) query = query.eq('quotation_id', quotationId);
  if (invoiceId) query = query.eq('invoice_id', invoiceId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Short-lived signed URL — the only way this bucket's files are ever accessed. */
export async function getSignedUrl(filePath, { download } = {}) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 300, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFile(file) {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([file.file_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from('files').delete().eq('id', file.id);
  if (error) throw error;
}
