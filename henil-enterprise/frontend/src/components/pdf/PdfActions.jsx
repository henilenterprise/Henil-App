import { useRef, useState } from 'react';
import { Eye, Download, Printer } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';
import Alert from '../ui/Alert.jsx';
import { getErrorMessage } from '../../utils/getErrorMessage.js';
import './PdfActions.css';

/*
  Preview / Download / Print for a lazily-generated PDF.

  The PDF is only built when first needed (not eagerly on page load),
  then cached in memory so switching between Preview/Download/Print
  doesn't regenerate it. Preview renders the real PDF bytes in an
  <iframe> (the browser's own PDF viewer — genuine PDF rendering, not
  a screenshot of anything). Print opens the same PDF in a hidden
  iframe and calls the browser's native print dialog on it, so only
  the PDF itself prints, never the surrounding web page.
*/
function PdfActions({ generatePdf, fileName, label = 'PDF' }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingAction, setLoadingAction] = useState(null); // 'preview' | 'download' | 'print' | null
  const [error, setError] = useState(null);
  const cachedBytesRef = useRef(null);

  async function ensureBytes() {
    if (cachedBytesRef.current) return cachedBytesRef.current;
    const bytes = await generatePdf();
    cachedBytesRef.current = bytes;
    return bytes;
  }

  function makeBlobUrl(bytes) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  }

  async function handlePreview() {
    setLoadingAction('preview');
    setError(null);
    try {
      const bytes = await ensureBytes();
      setPreviewUrl(makeBlobUrl(bytes));
      setPreviewOpen(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDownload() {
    setLoadingAction('download');
    setError(null);
    try {
      const bytes = await ensureBytes();
      const url = makeBlobUrl(bytes);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePrint() {
    setLoadingAction('print');
    setError(null);
    try {
      const bytes = await ensureBytes();
      const url = makeBlobUrl(bytes);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }, 150);
      };
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 60000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingAction(null);
    }
  }

  function closePreview() {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }

  return (
    <div className="pdf-actions">
      <div className="pdf-actions__buttons">
        <Button variant="outline" icon={Eye} onClick={handlePreview} loading={loadingAction === 'preview'}>
          Preview PDF
        </Button>
        <Button variant="outline" icon={Download} onClick={handleDownload} loading={loadingAction === 'download'}>
          Download PDF
        </Button>
        <Button variant="outline" icon={Printer} onClick={handlePrint} loading={loadingAction === 'print'}>
          Print
        </Button>
      </div>

      {error && (
        <Alert tone="danger" title="Couldn't generate PDF" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Modal
        isOpen={previewOpen}
        onClose={closePreview}
        title={`${label} \u2014 ${fileName}.pdf`}
        size="xl"
        footer={
          <>
            <Button variant="outline" icon={Download} onClick={handleDownload} loading={loadingAction === 'download'}>
              Download
            </Button>
            <Button icon={Printer} onClick={handlePrint} loading={loadingAction === 'print'}>
              Print
            </Button>
          </>
        }
      >
        {previewUrl && <iframe src={previewUrl} title={`${fileName} preview`} className="pdf-actions__iframe" />}
      </Modal>
    </div>
  );
}

export default PdfActions;
