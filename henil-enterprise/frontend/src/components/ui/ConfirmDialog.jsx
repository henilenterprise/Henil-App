import { AlertTriangle } from 'lucide-react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import './ConfirmDialog.css';

/*
  tone: 'danger' | 'default'
*/
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="confirm-dialog">
        {tone === 'danger' && (
          <div className="confirm-dialog__icon">
            <AlertTriangle size={20} />
          </div>
        )}
        <div>
          <p className="confirm-dialog__title">{title}</p>
          {description && <p className="confirm-dialog__description">{description}</p>}
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
