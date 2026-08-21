import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, Box, Eye, Download, Trash2, RotateCcw } from 'lucide-react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import Alert from '../ui/Alert.jsx';
import Spinner from '../ui/Spinner.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import FilePreviewModal from './FilePreviewModal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  listFiles,
  uploadFile,
  deleteFile,
  getSignedUrl,
  canPreview,
  ALLOWED_EXTENSIONS,
} from '../../services/filesService.js';
import { formatFileSize } from '../../utils/formatFileSize.js';
import { formatDate } from '../../utils/formatDate.js';
import { getErrorMessage } from '../../utils/getErrorMessage.js';
import './FilesPanel.css';

const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');

function fileIcon(ext) {
  const e = (ext || '').toLowerCase();
  if (e === 'pdf') return FileText;
  if (e === 'png' || e === 'jpg' || e === 'jpeg') return ImageIcon;
  return Box; // dxf / dwg — no dedicated CAD icon, a generic file box reads fine
}

function FilesPanel({ clientId, quotationId, invoiceId, title = 'Files' }) {
  const toast = useToast();
  const { isManagerOrAdmin } = useAuth();
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingName, setUploadingName] = useState('');
  const [uploadError, setUploadError] = useState(null);

  const [previewFile, setPreviewFile] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFiles({ clientId, quotationId, invoiceId });
      setFiles(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clientId, quotationId, invoiceId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  function handleChooseFile() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadingName(file.name);
    setUploadError(null);

    uploadFile({
      file,
      clientId,
      quotationId,
      invoiceId,
      onProgress: setUploadProgress,
    })
      .then(() => {
        toast.success('File uploaded', `${file.name} was uploaded successfully.`);
        fetchFiles();
      })
      .catch((err) => {
        setUploadError(getErrorMessage(err));
      })
      .finally(() => {
        setUploading(false);
      });
  }

  async function handleDownload(file) {
    setDownloadingId(file.id);
    try {
      const url = await getSignedUrl(file.file_path, { download: file.file_name });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error('Couldn\u2019t download file', getErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFile(deleteTarget);
      toast.success('File deleted', `${deleteTarget.file_name} was removed.`);
      setDeleteTarget(null);
      fetchFiles();
    } catch (err) {
      toast.error('Couldn\u2019t delete file', getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card
      title={title}
      subtitle={`PDF, PNG, JPG, JPEG, DXF, DWG \u2014 up to 20 MB`}
      actions={
        <Button size="sm" icon={Upload} onClick={handleChooseFile} loading={uploading} disabled={uploading}>
          Upload file
        </Button>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={handleFileSelected}
        className="files-panel__hidden-input"
      />

      {uploadError && (
        <Alert tone="danger" title="Upload failed" onDismiss={() => setUploadError(null)}>
          {uploadError}
        </Alert>
      )}

      {uploading && (
        <div className="files-panel__progress">
          <div className="files-panel__progress-label">
            <span>Uploading {uploadingName}…</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="files-panel__progress-track">
            <div className="files-panel__progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {error && (
        <>
          <Alert tone="danger" title="Couldn't load files">
            {error}
          </Alert>
          <div className="files-panel__retry">
            <Button variant="outline" icon={RotateCcw} onClick={fetchFiles}>
              Try again
            </Button>
          </div>
        </>
      )}

      {!error && loading && <Spinner size="md" label="Loading files…" />}

      {!error && !loading && files.length === 0 && (
        <EmptyState
          icon={Upload}
          title="No files yet"
          description="Upload drawings or project files to attach them here."
        />
      )}

      {!error && !loading && files.length > 0 && (
        <ul className="files-panel__list">
          {files.map((file) => {
            const Icon = fileIcon(file.file_type);
            return (
              <li key={file.id} className="files-panel__item">
                <Icon size={18} className="files-panel__item-icon" />
                <div className="files-panel__item-info">
                  <p className="files-panel__item-name">{file.file_name}</p>
                  <p className="files-panel__item-meta">
                    {formatFileSize(file.file_size)} · {formatDate(file.created_at)}
                  </p>
                </div>
                <div className="files-panel__item-actions">
                  {canPreview(file.file_type || file.file_name) && (
                    <button
                      type="button"
                      className="files-panel__action"
                      onClick={() => setPreviewFile(file)}
                      aria-label="Preview"
                    >
                      <Eye size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="files-panel__action"
                    onClick={() => handleDownload(file)}
                    aria-label="Download"
                    disabled={downloadingId === file.id}
                  >
                    <Download size={15} />
                  </button>
                  {isManagerOrAdmin && (
                    <button
                      type="button"
                      className="files-panel__action files-panel__action--danger"
                      onClick={() => setDeleteTarget(file)}
                      aria-label="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FilePreviewModal isOpen={Boolean(previewFile)} onClose={() => setPreviewFile(null)} file={previewFile} />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        tone="danger"
        title="Delete this file?"
        description={deleteTarget ? `This will permanently remove ${deleteTarget.file_name}. This action cannot be undone.` : ''}
        confirmLabel="Delete"
      />
    </Card>
  );
}

export default FilesPanel;
