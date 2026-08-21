import { useEffect, useRef, useState } from 'react';
import { Paperclip, X, ExternalLink } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Textarea from '../ui/Textarea.jsx';
import DatePicker from '../ui/DatePicker.jsx';
import Button from '../ui/Button.jsx';
import Alert from '../ui/Alert.jsx';
import { PAYMENT_METHODS } from '../../services/paymentsService.js';
import {
  createExpense,
  updateExpense,
  getExpenseAttachment,
  uploadExpenseAttachment,
  deleteExpenseAttachment,
} from '../../services/expensesService.js';
import { validateExpenseForm } from '../../utils/validators.js';
import { getErrorMessage } from '../../utils/getErrorMessage.js';
import './ExpenseFormModal.css';

const METHOD_OPTIONS = PAYMENT_METHODS.map((m) => ({ value: m, label: m }));

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  category: '',
  description: '',
  amount: '',
  payment_method: 'Cash',
  vendor: '',
  notes: '',
};

function toFormValues(expense) {
  if (!expense) return EMPTY_FORM;
  const result = { ...EMPTY_FORM };
  for (const key of Object.keys(EMPTY_FORM)) {
    result[key] = expense[key] ?? EMPTY_FORM[key];
  }
  return result;
}

function parseIsoDate(v) {
  return v ? new Date(`${v}T00:00:00`) : null;
}
function toIsoDate(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/*
  Shared modal for both "Add expense" and "Edit expense" — pass
  `expense` (an existing row) to edit, or omit it to create a new one.
*/
function ExpenseFormModal({ isOpen, onClose, expense, onSubmit }) {
  const isEdit = Boolean(expense);
  const fileInputRef = useRef(null);

  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [existingAttachment, setExistingAttachment] = useState(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [newFile, setNewFile] = useState(null);
  const [removeExisting, setRemoveExisting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValues(toFormValues(expense));
      setErrors({});
      setSubmitError(null);
      setNewFile(null);
      setRemoveExisting(false);
      setExistingAttachment(null);

      if (expense) {
        setAttachmentLoading(true);
        getExpenseAttachment(expense.id)
          .then(setExistingAttachment)
          .catch(() => setExistingAttachment(null))
          .finally(() => setAttachmentLoading(false));
      }
    }
  }, [isOpen, expense]);

  function setField(field) {
    return (e) => {
      const value = typeof e === 'string' ? e : e.target.value;
      setValues((v) => ({ ...v, [field]: value }));
    };
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setNewFile(file);
      setRemoveExisting(false);
    }
  }

  function handleRemoveAttachment() {
    setNewFile(null);
    setRemoveExisting(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validateExpenseForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        date: values.date,
        category: values.category.trim(),
        description: values.description.trim(),
        amount: Number(values.amount),
        payment_method: values.payment_method,
        vendor: values.vendor.trim() || null,
        notes: values.notes.trim() || null,
      };

      let expenseId;
      if (isEdit) {
        const updated = await updateExpense(expense.id, payload);
        expenseId = updated.id;
      } else {
        const created = await createExpense(payload);
        expenseId = created.id;
      }

      if (removeExisting && existingAttachment) {
        await deleteExpenseAttachment(existingAttachment);
      }
      if (newFile) {
        await uploadExpenseAttachment(expenseId, newFile);
      }

      await onSubmit();
      onClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const showExisting = existingAttachment && !removeExisting && !newFile;

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? 'Edit expense' : 'Add expense'}
      description={isEdit ? 'Update this expense record.' : 'Record a new business expense.'}
      size="lg"
      closeOnOverlayClick={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {isEdit ? 'Save changes' : 'Add expense'}
          </Button>
        </>
      }
    >
      <form className="expense-form" onSubmit={handleSubmit} noValidate>
        {submitError && (
          <Alert tone="danger" title="Couldn't save this expense">
            {submitError}
          </Alert>
        )}

        <div className="expense-form__grid">
          <DatePicker
            label="Date"
            required
            value={parseIsoDate(values.date)}
            onChange={(d) => setValues((v) => ({ ...v, date: toIsoDate(d) }))}
            error={errors.date}
          />
          <Input
            label="Category"
            required
            value={values.category}
            onChange={setField('category')}
            error={errors.category}
            placeholder="e.g. Materials, Rent, Utilities"
            disabled={submitting}
          />
          <Input
            label="Description"
            required
            value={values.description}
            onChange={setField('description')}
            error={errors.description}
            disabled={submitting}
            className="expense-form__full"
          />
          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            required
            value={values.amount}
            onChange={setField('amount')}
            error={errors.amount}
            disabled={submitting}
          />
          <Select
            label="Payment method"
            required
            options={METHOD_OPTIONS}
            value={values.payment_method}
            onChange={setField('payment_method')}
            error={errors.payment_method}
            disabled={submitting}
          />
          <Input
            label="Vendor"
            value={values.vendor}
            onChange={setField('vendor')}
            placeholder="Who was paid"
            disabled={submitting}
          />
          <Textarea
            label="Notes"
            rows={2}
            value={values.notes}
            onChange={setField('notes')}
            disabled={submitting}
            className="expense-form__full"
          />

          <div className="expense-form__full">
            <p className="field__label">Attachment</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="expense-form__file-input"
            />

            {attachmentLoading && <p className="expense-form__attachment-hint">Checking for an existing attachment…</p>}

            {!attachmentLoading && showExisting && (
              <div className="expense-form__attachment">
                <Paperclip size={15} />
                <a href={existingAttachment.publicUrl} target="_blank" rel="noreferrer" className="expense-form__attachment-name">
                  {existingAttachment.file_name}
                </a>
                {existingAttachment.file_size != null && (
                  <span className="expense-form__attachment-size">{formatFileSize(existingAttachment.file_size)}</span>
                )}
                <a href={existingAttachment.publicUrl} target="_blank" rel="noreferrer" className="expense-form__attachment-action" aria-label="Open attachment">
                  <ExternalLink size={14} />
                </a>
                <button type="button" className="expense-form__attachment-action" onClick={handleRemoveAttachment} aria-label="Remove attachment">
                  <X size={14} />
                </button>
              </div>
            )}

            {!attachmentLoading && newFile && (
              <div className="expense-form__attachment">
                <Paperclip size={15} />
                <span className="expense-form__attachment-name">{newFile.name}</span>
                <span className="expense-form__attachment-size">{formatFileSize(newFile.size)}</span>
                <button
                  type="button"
                  className="expense-form__attachment-action"
                  onClick={() => {
                    setNewFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  aria-label="Remove selected file"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {!attachmentLoading && !showExisting && !newFile && (
              <p className="expense-form__attachment-hint">
                No attachment yet. Choose an image or PDF above (e.g. a receipt or bill).
              </p>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default ExpenseFormModal;
