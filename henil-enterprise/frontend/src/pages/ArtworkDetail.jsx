import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Pencil,
  Trash2,
  Upload,
  Download,
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  FileImage,
  Layers,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Alert from '../components/ui/Alert.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import Textarea from '../components/ui/Textarea.jsx';
import ArtworkFormModal from '../components/artwork/ArtworkFormModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  getArtworkWithVersions,
  updateArtwork,
  deleteArtwork,
  uploadArtworkVersion,
  setCurrentVersion,
  getVersionSignedUrl,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from '../services/artworkService.js';
import { listClients } from '../services/clientsService.js';
import { listActiveProductsForPicker } from '../services/productsService.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import { formatFileSize } from '../utils/formatFileSize.js';
import { formatDate } from '../utils/formatDate.js';
import './ArtworkDetail.css';

function ArtworkDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [artwork, setArtwork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchArtwork = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getArtworkWithVersions(id);
      setArtwork(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchArtwork();
  }, [fetchArtwork]);

  useEffect(() => {
    listClients({ pageSize: 500, sortBy: 'company_name', ascending: true }).then((res) => setClients(res.data)).catch(() => setClients([]));
    listActiveProductsForPicker().then(setProducts).catch(() => setProducts([]));
  }, []);

  async function handleEditSubmit(payload) {
    await updateArtwork(id, payload);
    toast.success('Artwork updated', 'Changes were saved successfully.');
    fetchArtwork();
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await deleteArtwork(id);
      toast.success('Artwork deleted', `${artwork.artwork_code} and all its versions were removed.`);
      navigate('/artwork-vault');
    } catch (err) {
      toast.error("Couldn't delete artwork", getErrorMessage(err));
      setDeleting(false);
    }
  }

  function handleChooseFile() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadArtworkVersion({
        artworkId: id,
        file,
        notes: uploadNotes.trim() || null,
        onProgress: setUploadProgress,
      });
      toast.success('Version uploaded', `${file.name} is now the current version.`);
      setUploadNotes('');
      fetchArtwork();
    } catch (err) {
      toast.error("Couldn't upload version", getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleMakeCurrent(versionId) {
    try {
      await setCurrentVersion(id, versionId);
      toast.success('Current version updated', '');
      fetchArtwork();
    } catch (err) {
      toast.error("Couldn't update current version", getErrorMessage(err));
    }
  }

  async function handleDownload(version) {
    setDownloadingId(version.id);
    try {
      const url = await getVersionSignedUrl(version.file_path, version.file_name);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error("Couldn't download file", getErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return <Spinner size="lg" label="Loading artwork…" />;
  }

  if (error) {
    return (
      <>
        <button type="button" className="artwork-detail__back" onClick={() => navigate('/artwork-vault')}>
          <ArrowLeft size={14} /> Back to Artwork Vault
        </button>
        <Alert tone="danger" title="Couldn't load this artwork">
          {error}
        </Alert>
        <div className="artwork-detail__retry">
          <Button variant="outline" icon={RotateCcw} onClick={fetchArtwork}>
            Try again
          </Button>
        </div>
      </>
    );
  }

  const currentVersion = artwork.versions.find((v) => v.is_current);

  return (
    <>
      <button type="button" className="artwork-detail__back" onClick={() => navigate('/artwork-vault')}>
        <ArrowLeft size={14} /> Back to Artwork Vault
      </button>

      <PageHeader
        title={artwork.artwork_name}
        description={`${artwork.artwork_code}${artwork.status === 'ARCHIVED' ? ' \u00b7 Archived' : ''}`}
        actions={
          <>
            <Button variant="outline" icon={Pencil} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="danger" icon={Trash2} onClick={() => setDeleteConfirmOpen(true)}>
              Delete
            </Button>
          </>
        }
      />

      <div className="artwork-detail__grid">
        <Card title="Versions" className="artwork-detail__versions">
          <div className="artwork-detail__upload-row">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
              onChange={handleFileSelected}
              className="artwork-detail__hidden-input"
            />
            <Textarea
              placeholder="Notes for this version (optional)"
              rows={1}
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              disabled={uploading}
              aria-label="Version notes"
            />
            <Button icon={Upload} onClick={handleChooseFile} loading={uploading}>
              {uploading ? `Uploading ${uploadProgress}%` : 'Upload New Version'}
            </Button>
          </div>
          <p className="artwork-detail__upload-hint">
            {ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(', ')} — up to {MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB. The new upload becomes the current version automatically.
          </p>

          {artwork.versions.length === 0 ? (
            <p className="artwork-detail__no-versions">No versions uploaded yet.</p>
          ) : (
            <ul className="artwork-detail__version-list">
              {artwork.versions.map((v) => (
                <li key={v.id} className="artwork-detail__version-row">
                  <div className="artwork-detail__version-icon">
                    <FileImage size={16} />
                  </div>
                  <div className="artwork-detail__version-info">
                    <p className="artwork-detail__version-name">
                      V{v.version_number} — {v.file_name}
                      {v.is_current && (
                        <Badge tone="success" className="artwork-detail__current-badge">
                          Current Version
                        </Badge>
                      )}
                    </p>
                    <p className="artwork-detail__version-meta">
                      {formatDate(v.created_at)} · {formatFileSize(v.file_size)}
                      {v.notes ? ` \u00b7 ${v.notes}` : ''}
                    </p>
                  </div>
                  <div className="artwork-detail__version-actions">
                    {!v.is_current && (
                      <Button variant="ghost" size="sm" icon={CheckCircle2} onClick={() => handleMakeCurrent(v.id)}>
                        Make Current
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Download}
                      onClick={() => handleDownload(v)}
                      loading={downloadingId === v.id}
                    >
                      Download
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="artwork-detail__side">
          <Card title="Details">
            <dl className="artwork-detail__facts">
              <div>
                <dt>Client</dt>
                <dd>{artwork.client?.company_name || '\u2014'}</dd>
              </div>
              <div>
                <dt>Product</dt>
                <dd>{artwork.product ? `${artwork.product.name} (${artwork.product.sku})` : '\u2014'}</dd>
              </div>
              <div>
                <dt>Material</dt>
                <dd>{artwork.material || '\u2014'}</dd>
              </div>
              <div>
                <dt>Thickness</dt>
                <dd>{artwork.thickness || '\u2014'}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>{artwork.width && artwork.height ? `${artwork.width} \u00d7 ${artwork.height} mm` : '\u2014'}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{artwork.quantity ?? '\u2014'}</dd>
              </div>
            </dl>
            {artwork.tags?.length > 0 && (
              <div className="artwork-detail__tags">
                {artwork.tags.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            {artwork.notes && <p className="artwork-detail__notes">{artwork.notes}</p>}
          </Card>
        </div>
      </div>

      <ArtworkFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        artwork={artwork}
        clients={clients}
        products={products}
        onSubmit={handleEditSubmit}
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        tone="danger"
        title="Delete this artwork?"
        description={`This will permanently remove ${artwork.artwork_code} and all ${artwork.versions.length} of its version(s), including the stored files. This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </>
  );
}

export default ArtworkDetail;
