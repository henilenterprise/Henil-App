import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Textarea from '../ui/Textarea.jsx';
import Button from '../ui/Button.jsx';
import Alert from '../ui/Alert.jsx';
import { INDIAN_STATES } from '../../utils/indianStates.js';
import { validateClientForm } from '../../utils/validators.js';
import { getErrorMessage } from '../../utils/getErrorMessage.js';
import './ClientFormModal.css';

const EMPTY_FORM = {
  company_name: '',
  contact_person: '',
  phone: '',
  email: '',
  gst_number: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  notes: '',
};

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));

// Database columns are nullable; controlled inputs need '' not null,
// and handleSubmit calls .trim() on every field, so null would crash it.
function toFormValues(client) {
  if (!client) return EMPTY_FORM;
  const result = { ...EMPTY_FORM };
  for (const key of Object.keys(EMPTY_FORM)) {
    result[key] = client[key] ?? '';
  }
  return result;
}

/*
  Shared modal for both "Add client" and "Edit client" — pass
  `client` (an existing row) to edit, or omit it to create a new one.
*/
function ClientFormModal({ isOpen, onClose, client, onSubmit }) {
  const isEdit = Boolean(client);
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setValues(toFormValues(client));
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen, client]);

  function setField(field) {
    return (e) => {
      const value = typeof e === 'string' ? e : e.target.value;
      setValues((v) => ({ ...v, [field]: value }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validateClientForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        company_name: values.company_name.trim(),
        contact_person: values.contact_person.trim() || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        gst_number: values.gst_number.trim().toUpperCase() || null,
        address: values.address.trim() || null,
        city: values.city.trim() || null,
        state: values.state || null,
        pincode: values.pincode.trim() || null,
        notes: values.notes.trim() || null,
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
      title={isEdit ? 'Edit client' : 'Add client'}
      description={
        isEdit ? `Update details for ${client?.company_name ?? 'this client'}.` : 'Add a new client company.'
      }
      size="lg"
      closeOnOverlayClick={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {isEdit ? 'Save changes' : 'Add client'}
          </Button>
        </>
      }
    >
      <form className="client-form" onSubmit={handleSubmit} noValidate>
        {submitError && (
          <Alert tone="danger" title="Couldn't save this client">
            {submitError}
          </Alert>
        )}

        <div className="client-form__grid">
          <Input
            label="Company name"
            required
            value={values.company_name}
            onChange={setField('company_name')}
            error={errors.company_name}
            disabled={submitting}
            className="client-form__full"
          />
          <Input
            label="Contact person"
            value={values.contact_person}
            onChange={setField('contact_person')}
            disabled={submitting}
          />
          <Input
            label="Phone"
            type="tel"
            value={values.phone}
            onChange={setField('phone')}
            disabled={submitting}
          />
          <Input
            label="Email"
            type="email"
            value={values.email}
            onChange={setField('email')}
            error={errors.email}
            disabled={submitting}
          />
          <Input
            label="GST number"
            value={values.gst_number}
            onChange={setField('gst_number')}
            error={errors.gst_number}
            helperText={!errors.gst_number ? '15-character GSTIN, optional' : undefined}
            disabled={submitting}
          />
          <Input
            label="Address"
            value={values.address}
            onChange={setField('address')}
            disabled={submitting}
            className="client-form__full"
          />
          <Input
            label="City"
            value={values.city}
            onChange={setField('city')}
            disabled={submitting}
          />
          <Select
            label="State"
            placeholder="Select state"
            options={STATE_OPTIONS}
            value={values.state}
            onChange={setField('state')}
            disabled={submitting}
          />
          <Input
            label="Pincode"
            value={values.pincode}
            onChange={setField('pincode')}
            error={errors.pincode}
            disabled={submitting}
          />
          <Textarea
            label="Notes"
            rows={3}
            value={values.notes}
            onChange={setField('notes')}
            disabled={submitting}
            className="client-form__full"
          />
        </div>
      </form>
    </Modal>
  );
}

export default ClientFormModal;
