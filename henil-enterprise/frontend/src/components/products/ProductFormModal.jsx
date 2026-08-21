import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Textarea from '../ui/Textarea.jsx';
import Button from '../ui/Button.jsx';
import Alert from '../ui/Alert.jsx';
import { validateProductForm } from '../../utils/validators.js';
import { getErrorMessage } from '../../utils/getErrorMessage.js';
import { getCompanySettings } from '../../services/companySettingsService.js';
import './ProductFormModal.css';

const EMPTY_FORM = {
  name: '',
  sku: '',
  category: '',
  description: '',
  material: '',
  thickness: '',
  unit: 'pcs',
  default_rate: '',
  gst_percentage: '18',
  is_active: 'true',
};

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

// Database columns are nullable; controlled inputs need '' not null.
function toFormValues(product) {
  if (!product) return EMPTY_FORM;
  const result = { ...EMPTY_FORM };
  for (const key of Object.keys(EMPTY_FORM)) {
    if (key === 'is_active') {
      result[key] = String(product.is_active ?? true);
    } else if (key === 'default_rate' || key === 'gst_percentage') {
      result[key] = product[key] === null || product[key] === undefined ? '' : String(product[key]);
    } else {
      result[key] = product[key] ?? (key === 'unit' ? 'pcs' : '');
    }
  }
  return result;
}

/*
  Shared modal for both "Add product" and "Edit product" — pass
  `product` (an existing row) to edit, or omit it to create a new one.
*/
function ProductFormModal({ isOpen, onClose, product, onSubmit }) {
  const isEdit = Boolean(product);
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setValues(toFormValues(product));
      setErrors({});
      setSubmitError(null);
      if (!product) {
        getCompanySettings()
          .then((settings) => {
            setValues((v) => ({ ...v, gst_percentage: String(settings.default_gst ?? 18) }));
          })
          .catch(() => {});
      }
    }
  }, [isOpen, product]);

  function setField(field) {
    return (e) => {
      const value = typeof e === 'string' ? e : e.target.value;
      setValues((v) => ({ ...v, [field]: value }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validateProductForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        name: values.name.trim(),
        sku: values.sku.trim(),
        category: values.category.trim() || null,
        description: values.description.trim() || null,
        material: values.material.trim() || null,
        thickness: values.thickness.trim() || null,
        unit: values.unit.trim() || 'pcs',
        default_rate: Number(values.default_rate),
        gst_percentage: values.gst_percentage === '' ? 18 : Number(values.gst_percentage),
        is_active: values.is_active === 'true',
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
      title={isEdit ? 'Edit product' : 'Add product'}
      description={isEdit ? `Update details for ${product?.name ?? 'this product'}.` : 'Add a new product.'}
      size="lg"
      closeOnOverlayClick={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {isEdit ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <form className="product-form" onSubmit={handleSubmit} noValidate>
        {submitError && (
          <Alert tone="danger" title="Couldn't save this product">
            {submitError}
          </Alert>
        )}

        <div className="product-form__grid">
          <Input
            label="Product name"
            required
            value={values.name}
            onChange={setField('name')}
            error={errors.name}
            disabled={submitting}
            className="product-form__full"
          />
          <Input
            label="SKU"
            required
            value={values.sku}
            onChange={setField('sku')}
            error={errors.sku}
            helperText={!errors.sku ? 'Must be unique across all products.' : undefined}
            disabled={submitting}
          />
          <Input
            label="Category"
            value={values.category}
            onChange={setField('category')}
            placeholder="e.g. Sheet Stock, Fabrication"
            disabled={submitting}
          />
          <Input
            label="Material"
            value={values.material}
            onChange={setField('material')}
            placeholder="e.g. Acrylic, Polycarbonate"
            disabled={submitting}
          />
          <Input
            label="Thickness"
            value={values.thickness}
            onChange={setField('thickness')}
            placeholder="e.g. 6mm"
            disabled={submitting}
          />
          <Input
            label="Unit"
            value={values.unit}
            onChange={setField('unit')}
            placeholder="e.g. sheets, pcs, rolls"
            disabled={submitting}
          />
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={values.is_active}
            onChange={setField('is_active')}
            disabled={submitting}
          />
          <Input
            label="Default rate"
            type="number"
            min="0"
            step="0.01"
            required
            value={values.default_rate}
            onChange={setField('default_rate')}
            error={errors.default_rate}
            disabled={submitting}
          />
          <Input
            label="GST percentage"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={values.gst_percentage}
            onChange={setField('gst_percentage')}
            error={errors.gst_percentage}
            disabled={submitting}
          />
          <Textarea
            label="Description"
            rows={3}
            value={values.description}
            onChange={setField('description')}
            disabled={submitting}
            className="product-form__full"
          />
        </div>
      </form>
    </Modal>
  );
}

export default ProductFormModal;
