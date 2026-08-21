import { useEffect, useRef, useState } from 'react';
import { Upload, X, Save } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';
import Textarea from '../components/ui/Textarea.jsx';
import Button from '../components/ui/Button.jsx';
import Alert from '../components/ui/Alert.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useCompany } from '../hooks/useCompany.js';
import { updateCompanySettings, uploadCompanyLogo } from '../services/companySettingsService.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './Settings.css';

const EMPTY_FORM = {
  company_name: '',
  logo: '',
  address: '',
  phone: '',
  email: '',
  gst_number: '',
  website: '',
  quotation_prefix: '',
  invoice_prefix: '',
  default_gst: '',
  payment_terms: '',
  quotation_terms: '',
  invoice_terms: '',
  bank_name: '',
  bank_account_number: '',
  bank_ifsc: '',
  bank_branch: '',
};

function toFormValues(company) {
  if (!company) return EMPTY_FORM;
  const bank = company.bank_details || {};
  return {
    company_name: company.company_name ?? '',
    logo: company.logo ?? '',
    address: company.address ?? '',
    phone: company.phone ?? '',
    email: company.email ?? '',
    gst_number: company.gst_number ?? '',
    website: company.website ?? '',
    quotation_prefix: company.quotation_prefix ?? '',
    invoice_prefix: company.invoice_prefix ?? '',
    default_gst: company.default_gst === null || company.default_gst === undefined ? '' : String(company.default_gst),
    payment_terms: company.payment_terms ?? '',
    quotation_terms: company.quotation_terms ?? '',
    invoice_terms: company.invoice_terms ?? '',
    bank_name: bank.bank_name ?? '',
    bank_account_number: bank.account_number ?? '',
    bank_ifsc: bank.ifsc ?? '',
    bank_branch: bank.branch ?? '',
  };
}

function validate(values) {
  const errors = {};
  if (!values.company_name?.trim()) errors.company_name = 'Company name is required.';
  if (values.email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!values.quotation_prefix?.trim()) errors.quotation_prefix = 'Required (e.g. QT-).';
  if (!values.invoice_prefix?.trim()) errors.invoice_prefix = 'Required (e.g. INV-).';
  const gst = values.default_gst;
  if (gst === '' || gst === null || Number.isNaN(Number(gst)) || Number(gst) < 0 || Number(gst) > 100) {
    errors.default_gst = 'Enter a GST percentage between 0 and 100.';
  }
  return errors;
}

function Settings() {
  const toast = useToast();
  const { company, loading, refetch } = useCompany();
  const fileInputRef = useRef(null);

  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [pendingLogoUrl, setPendingLogoUrl] = useState(null);

  useEffect(() => {
    if (company) {
      setValues(toFormValues(company));
      setPendingLogoUrl(null);
    }
  }, [company]);

  function setField(field) {
    return (e) => {
      const value = typeof e === 'string' ? e : e.target.value;
      setValues((v) => ({ ...v, [field]: value }));
    };
  }

  function handleChooseLogo() {
    fileInputRef.current?.click();
  }

  async function handleLogoSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const ALLOWED_LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg'];
    if (!file.type.startsWith('image/') || !ALLOWED_LOGO_EXTENSIONS.includes(ext)) {
      setLogoError('Logo must be a PNG or JPG image.');
      return;
    }
    const MAX_LOGO_BYTES = 2 * 1024 * 1024; // matches the company-assets bucket's file_size_limit
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Logo is too large (max 2 MB).');
      return;
    }
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const url = await uploadCompanyLogo(file);
      setPendingLogoUrl(url);
      setValues((v) => ({ ...v, logo: url }));
    } catch (err) {
      setLogoError(getErrorMessage(err));
    } finally {
      setUploadingLogo(false);
    }
  }

  function handleRemoveLogo() {
    setPendingLogoUrl(null);
    setValues((v) => ({ ...v, logo: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const bankDetails =
        values.bank_name || values.bank_account_number || values.bank_ifsc || values.bank_branch
          ? {
              bank_name: values.bank_name.trim() || null,
              account_number: values.bank_account_number.trim() || null,
              ifsc: values.bank_ifsc.trim() || null,
              branch: values.bank_branch.trim() || null,
            }
          : null;

      await updateCompanySettings({
        company_name: values.company_name.trim(),
        logo: values.logo || null,
        address: values.address.trim() || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        gst_number: values.gst_number.trim() || null,
        website: values.website.trim() || null,
        quotation_prefix: values.quotation_prefix.trim(),
        invoice_prefix: values.invoice_prefix.trim(),
        default_gst: Number(values.default_gst),
        payment_terms: values.payment_terms.trim() || null,
        quotation_terms: values.quotation_terms.trim() || null,
        invoice_terms: values.invoice_terms.trim() || null,
        bank_details: bankDetails,
      });

      await refetch();
      toast.success('Settings saved', 'Company settings were updated successfully. New quotations, invoices, and PDFs will use these values.');
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Spinner size="lg" label="Loading settings…" />;
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Company profile and document defaults — used automatically on every quotation and invoice PDF."
      />

      <form onSubmit={handleSubmit}>
        {saveError && (
          <Alert tone="danger" title="Couldn't save settings">
            {saveError}
          </Alert>
        )}

        <Card title="Company profile" className="settings-section">
          <div className="settings-grid">
            <Input
              label="Company name"
              required
              value={values.company_name}
              onChange={setField('company_name')}
              error={errors.company_name}
              disabled={saving}
              className="settings-grid__full"
            />

            <div className="settings-grid__full">
              <p className="field__label">Logo</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoSelected}
                className="settings-logo__hidden-input"
              />
              {logoError && (
                <Alert tone="danger" title="Couldn't upload logo" onDismiss={() => setLogoError(null)}>
                  {logoError}
                </Alert>
              )}
              <div className="settings-logo">
                {values.logo ? (
                  <div className="settings-logo__preview">
                    <img src={values.logo} alt="Company logo" />
                    <button type="button" className="settings-logo__remove" onClick={handleRemoveLogo} aria-label="Remove logo">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="settings-logo__placeholder">No logo set</div>
                )}
                <Button type="button" variant="outline" size="sm" icon={Upload} onClick={handleChooseLogo} loading={uploadingLogo}>
                  {values.logo ? 'Replace logo' : 'Upload logo'}
                </Button>
              </div>
              <p className="field__helper">PNG or JPG. Used on the sidebar, login screen, and quotation/invoice PDFs.</p>
            </div>

            <Input label="Address" value={values.address} onChange={setField('address')} disabled={saving} className="settings-grid__full" />
            <Input label="Phone" type="tel" value={values.phone} onChange={setField('phone')} disabled={saving} />
            <Input label="Email" type="email" value={values.email} onChange={setField('email')} error={errors.email} disabled={saving} />
            <Input label="GST number" value={values.gst_number} onChange={setField('gst_number')} disabled={saving} />
            <Input label="Website" value={values.website} onChange={setField('website')} disabled={saving} />
          </div>
        </Card>

        <Card title="Document defaults" subtitle="Applied to every new quotation and invoice" className="settings-section">
          <div className="settings-grid">
            <Input
              label="Quotation prefix"
              required
              value={values.quotation_prefix}
              onChange={setField('quotation_prefix')}
              error={errors.quotation_prefix}
              helperText="e.g. QT- → QT-00001"
              disabled={saving}
            />
            <Input
              label="Invoice prefix"
              required
              value={values.invoice_prefix}
              onChange={setField('invoice_prefix')}
              error={errors.invoice_prefix}
              helperText="e.g. INV- → INV-00001"
              disabled={saving}
            />
            <Input
              label="Default GST %"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              value={values.default_gst}
              onChange={setField('default_gst')}
              error={errors.default_gst}
              helperText="Pre-fills new products and quotation/invoice line items"
              disabled={saving}
            />
          </div>
          <p className="settings-note">
            Changing a prefix only affects new quotations/invoices going forward — existing numbers are never rewritten.
          </p>
        </Card>

        <Card title="Terms & payment details" subtitle="Printed on quotation and invoice PDFs" className="settings-section">
          <div className="settings-grid">
            <Textarea
              label="Payment terms"
              rows={2}
              value={values.payment_terms}
              onChange={setField('payment_terms')}
              disabled={saving}
              className="settings-grid__full"
              helperText="Shown on quotations, and on invoices if no bank details are filled in below"
            />
            <Textarea
              label="Quotation terms & conditions"
              rows={3}
              value={values.quotation_terms}
              onChange={setField('quotation_terms')}
              disabled={saving}
              className="settings-grid__full"
            />
            <Textarea
              label="Invoice terms & conditions"
              rows={3}
              value={values.invoice_terms}
              onChange={setField('invoice_terms')}
              disabled={saving}
              className="settings-grid__full"
            />
          </div>

          <p className="settings-note settings-note--heading">Bank details (shown on invoice PDFs)</p>
          <div className="settings-grid">
            <Input label="Bank name" value={values.bank_name} onChange={setField('bank_name')} disabled={saving} />
            <Input label="Account number" value={values.bank_account_number} onChange={setField('bank_account_number')} disabled={saving} />
            <Input label="IFSC" value={values.bank_ifsc} onChange={setField('bank_ifsc')} disabled={saving} />
            <Input label="Branch" value={values.bank_branch} onChange={setField('bank_branch')} disabled={saving} />
          </div>
        </Card>

        <div className="settings-actions">
          <Button type="submit" icon={Save} loading={saving}>
            Save settings
          </Button>
        </div>
      </form>
    </>
  );
}

export default Settings;
