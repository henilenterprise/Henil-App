import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Textarea from '../ui/Textarea.jsx';
import Button from '../ui/Button.jsx';
import Alert from '../ui/Alert.jsx';
import { validateArtworkForm } from '../../utils/validators.js';
import { getErrorMessage } from '../../utils/getErrorMessage.js';
import './ArtworkFormModal.css';

const EMPTY_FORM = {
  artwork_name: '',
  client_id: '',
  product_id: '',
  material: '',
  thickness: '',
  width: '',
  height: '',
  quantity: '',
  notes: '',
  tags: '',
  status: 'ACTIVE',
};

function toFormValues(artwork) {
  if (!artwork) return EMPTY_FORM;
  return {
    artwork_name: artwork.artwork_name ?? '',
    client_id: artwork.client_id ?? '',
    product_id: artwork.product_id ?? '',
    material: artwork.material ?? '',
    thickness: artwork.thickness ?? '',
    width: artwork.width ?? '',
    height: artwork.height ?? '',
    quantity: artwork.quantity ?? '',
    notes: artwork.notes ?? '',
    tags: (artwork.tags || []).join(', '),
    status: artwork.status ?? 'ACTIVE',
  };
}

/*
  Shared modal for "Add artwork" and "Edit artwork" metadata. File
  upload is a separate action on the detail page (an artwork can
  exist with zero versions while metadata is being set up, and
  versions accumulate over the artwork's life — they don't belong in
  a single create form).
*/
function ArtworkFormModal({ isOpen, onClose, artwork, clients, products, onSubmit }) {
  const isEdit = Boolean(artwork);
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setValues(toFormValues(artwork));
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen, artwork]);

  function setField(field) {
    return (e) => {
      const value = typeof e === 'string' ? e : e.target.value;
      setValues((v) => ({ ...v, [field]: value }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validateArtworkForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        artwork_name: values.artwork_name.trim(),
        client_id: values.client_id || null,
        product_id: values.product_id || null,
        material: values.material.trim() || null,
        thickness: values.thickness.trim() || null,
        width: values.width === '' ? null : Number(values.width),
        height: values.height === '' ? null : Number(values.height),
        quantity: values.quantity === '' ? null : Number(values.quantity),
        notes: values.notes.trim() || null,
        tags: values.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        status: values.status,
      };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? 'Edit artwork' : 'Add artwork'}
      description={isEdit ? `Update details for ${artwork?.artwork_name ?? 'this artwork'}.` : 'Add a new artwork record to the vault.'}
      size="lg"
      closeOnOverlayClick={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {isEdit ? 'Save changes' : 'Add artwork'}
          </Button>
        </>
      }
    >
      <form className="artwork-form" onSubmit={handleSubmit} noValidate>
        {submitError && (
          <Alert tone="danger" title="Couldn't save this artwork">
            {submitError}
          </Alert>
        )}

        <div className="artwork-form__grid">
          <Input
            label="Artwork name"
            required
            value={values.artwork_name}
            onChange={setField('artwork_name')}
            error={errors.artwork_name}
            disabled={submitting}
            className="artwork-form__full"
          />
          <Select
            label="Client"
            placeholder="No client"
            options={clients.map((c) => ({ value: c.id, label: c.company_name }))}
            value={values.client_id}
            onChange={setField('client_id')}
            disabled={submitting}
          />
          <Select
            label="Product"
            placeholder="No product"
            options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
            value={values.product_id}
            onChange={setField('product_id')}
            disabled={submitting}
          />
          <Input label="Material" value={values.material} onChange={setField('material')} disabled={submitting} />
          <Input label="Thickness" value={values.thickness} onChange={setField('thickness')} disabled={submitting} helperText="e.g. 6mm" />
          <Input
            label="Width"
            type="number"
            min="0"
            step="0.01"
            value={values.width}
            onChange={setField('width')}
            error={errors.width}
            disabled={submitting}
          />
          <Input
            label="Height"
            type="number"
            min="0"
            step="0.01"
            value={values.height}
            onChange={setField('height')}
            error={errors.height}
            disabled={submitting}
          />
          <Input
            label="Quantity"
            type="number"
            min="0"
            value={values.quantity}
            onChange={setField('quantity')}
            error={errors.quantity}
            disabled={submitting}
          />
          <Select
            label="Status"
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'ARCHIVED', label: 'Archived' },
            ]}
            value={values.status}
            onChange={setField('status')}
            disabled={submitting}
          />
          <Input
            label="Tags"
            value={values.tags}
            onChange={setField('tags')}
            disabled={submitting}
            helperText="Comma-separated, e.g. machine guard, safety"
            className="artwork-form__full"
          />
          <Textarea
            label="Notes"
            rows={3}
            value={values.notes}
            onChange={setField('notes')}
            disabled={submitting}
            className="artwork-form__full"
          />
        </div>
      </form>
    </Modal>
  );
}

export default ArtworkFormModal;
