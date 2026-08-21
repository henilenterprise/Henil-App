import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Alert from '../ui/Alert.jsx';
import { getSignedUrl, isPreviewableImage } from '../../services/filesService.js';
import { getErrorMessage } from '../../utils/getErrorMessage.js';
import './FilePreviewModal.css';

function FilePreviewModal({ isOpen, onClose, file }) {
  const [url, setUrl] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !file) return;
    setLoading(true);
    setError(null);
    setUrl(null);
    Promise.all([getSignedUrl(file.file_path), getSignedUrl(file.file_path, { download: file.file_name })])
      .then(([viewUrl, dlUrl]) => {
        setUrl(viewUrl);
        setDownloadUrl(dlUrl);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isOpen, file]);

  if (!file) return null;

  const isImage = isPreviewableImage(file.file_type || file.file_name);
  const isPdf = (file.file_type || '').toLowerCase() === 'pdf';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={file.file_name}
      size="lg"
      footer={
        <Button icon={Download} onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')} disabled={!downloadUrl}>
          Download
        </Button>
      }
    >
      {error && (
        <Alert tone="danger" title="Couldn't load this file">
          {error}
        </Alert>
      )}

      {!error && loading && (
        <div className="file-preview__loading">
          <Loader2 size={22} className="file-preview__spinner" />
          <span>Loading preview…</span>
        </div>
      )}

      {!error && !loading && url && isImage && (
        <img src={url} alt={file.file_name} className="file-preview__image" />
      )}

      {!error && !loading && url && isPdf && (
        <iframe src={url} title={file.file_name} className="file-preview__pdf" />
      )}

      {!error && !loading && url && !isImage && !isPdf && (
        <div className="file-preview__unsupported">
          <p>Preview isn&rsquo;t available for this file type.</p>
          <p className="text-muted">Download it to view with the appropriate software.</p>
        </div>
      )}
    </Modal>
  );
}

export default FilePreviewModal;
