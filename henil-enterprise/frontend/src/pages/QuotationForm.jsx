import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Select from '../components/ui/Select.jsx';
import DatePicker from '../components/ui/DatePicker.jsx';
import Textarea from '../components/ui/Textarea.jsx';
import Button from '../components/ui/Button.jsx';
import Alert from '../components/ui/Alert.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import QuotationLineItemsEditor from '../components/quotations/QuotationLineItemsEditor.jsx';
import QuotationSummaryPanel from '../components/quotations/QuotationSummaryPanel.jsx';
import ClientFormModal from '../components/clients/ClientFormModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { listClients, createClient } from '../services/clientsService.js';
import { listActiveProductsForPicker } from '../services/productsService.js';
import { getCompanySettings } from '../services/companySettingsService.js';
import {
  getQuotationWithItems,
  createQuotation,
  updateQuotation,
} from '../services/quotationsService.js';
import { computeQuotationTotals } from '../utils/quotationCalculations.js';
import { validateQuotationForm } from '../utils/validators.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './QuotationForm.css';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  return value ? new Date(`${value}T00:00:00`) : null;
}

function toIsoDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const EMPTY_ITEM = { product_id: '', description: '', quantity: '1', unit: 'pcs', rate: '', gst_percentage: '18' };

function QuotationForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [clients, setClients] = useState([]);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [products, setProducts] = useState([]);

  const [clientId, setClientId] = useState('');
  const [quotationDate, setQuotationDate] = useState(todayIso());
  const [validUntil, setValidUntil] = useState('');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [defaultGst, setDefaultGst] = useState(18);

  const [errors, setErrors] = useState({ header: {}, items: [] });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    listClients({ pageSize: 500, sortBy: 'company_name', ascending: true })
      .then((res) => setClients(res.data))
      .catch(() => setClients([]));
    listActiveProductsForPicker()
      .then(setProducts)
      .catch(() => setProducts([]));
    getCompanySettings()
      .then((settings) => {
        const gst = Number(settings.default_gst) || 18;
        setDefaultGst(gst);
        // The initial row (EMPTY_ITEM) is a static module constant
        // with a hardcoded '18' fallback — it's created before this
        // fetch can possibly resolve. If the user hasn't touched
        // anything yet (still editing a new quotation, still just
        // the one pristine blank row), sync it to the real
        // configured default so the single most common case — a
        // one-item quotation — doesn't silently use a stale value.
        // Never touches a row the user has actually started editing.
        if (!isEdit) {
          setItems((current) => {
            const isPristine =
              current.length === 1 &&
              !current[0].product_id &&
              !current[0].description &&
              !current[0].rate;
            return isPristine ? [{ ...current[0], gst_percentage: String(gst) }] : current;
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setLoadError(null);
    getQuotationWithItems(id)
      .then((q) => {
        setClientId(q.client_id);
        setQuotationDate(q.quotation_date);
        setValidUntil(q.valid_until || '');
        setDiscount(String(q.discount ?? 0));
        setNotes(q.notes || '');
        setItems(
          q.items.length > 0
            ? q.items.map((item) => ({
                product_id: item.product_id || '',
                description: item.description,
                quantity: String(item.quantity),
                unit: item.unit,
                rate: String(item.rate),
                gst_percentage: String(item.gst_percentage),
              }))
            : [{ ...EMPTY_ITEM }]
        );
      })
      .catch((err) => setLoadError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const totals = useMemo(() => computeQuotationTotals(items, discount), [items, discount]);

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.company_name }));

  async function handleCreateClient(payload) {
    const created = await createClient(payload);
    setClients((current) => [...current, created].sort((a, b) => a.company_name.localeCompare(b.company_name)));
    setClientId(created.id);
    toast.success('Client added', `${created.company_name} was created and selected for this quotation.`);
  }

  async function handleSave(e) {
    e.preventDefault();
    const values = { client_id: clientId, quotation_date: quotationDate, valid_until: validUntil, discount };
    const validation = validateQuotationForm(values, items);
    setErrors(validation);
    if (!validation.isValid) {
      if (validation.noItems) {
        setSubmitError('Add at least one item to the quotation.');
      }
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateQuotation(id, values, items);
        toast.success('Quotation updated', 'Your changes were saved successfully.');
        navigate(`/quotations/${id}`);
      } else {
        const created = await createQuotation(values, items);
        toast.success('Quotation created', `${created.quotation_number} was created successfully.`);
        navigate(`/quotations/${created.id}`);
      }
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Spinner size="lg" label="Loading quotation…" />;
  }

  if (loadError) {
    return (
      <>
        <Link to="/quotations" className="quotation-form__back">
          <ArrowLeft size={14} />
          Back to quotations
        </Link>
        <Alert tone="danger" title="Couldn't load this quotation">
          {loadError}
        </Alert>
      </>
    );
  }

  return (
    <>
      <Link to="/quotations" className="quotation-form__back">
        <ArrowLeft size={14} />
        Back to quotations
      </Link>

      <PageHeader
        title={isEdit ? 'Edit quotation' : 'New quotation'}
        description={isEdit ? 'Update client, items, or amounts.' : 'Select a client, add items, and save.'}
      />

      <form onSubmit={handleSave}>
        {submitError && (
          <Alert tone="danger" title="Couldn't save this quotation">
            {submitError}
          </Alert>
        )}

        <div className="quotation-form__grid">
          <Card title="Details" className="quotation-form__details">
            <div className="quotation-form__fields">
              <div className="quotation-form__client-field">
                <Select
                  label="Client"
                  required
                  options={clientOptions}
                  placeholder="Select a client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  error={errors.header.client_id}
                  disabled={submitting}
                />
                <button type="button" className="quotation-form__add-client-btn" onClick={() => setAddClientOpen(true)}>
                  + Add new client
                </button>
              </div>
              <DatePicker
                label="Quotation date"
                required
                value={parseIsoDate(quotationDate)}
                onChange={(date) => setQuotationDate(toIsoDate(date))}
                error={errors.header.quotation_date}
              />
              <DatePicker
                label="Valid until"
                value={parseIsoDate(validUntil)}
                onChange={(date) => setValidUntil(toIsoDate(date))}
                error={errors.header.valid_until}
                helperText="Optional"
              />
            </div>

            <div className="quotation-form__items">
              <p className="quotation-form__section-label">Items</p>
              <QuotationLineItemsEditor
                items={items}
                products={products}
                onChange={setItems}
                errors={errors.items}
                defaultGst={defaultGst}
              />
            </div>

            <Textarea
              label="Notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              className="quotation-form__notes"
            />
          </Card>

          <Card title="Summary" className="quotation-form__summary-card">
            <QuotationSummaryPanel
              totals={totals}
              discount={discount}
              onDiscountChange={setDiscount}
              discountError={errors.header.discount}
              disabled={submitting}
            />
            <Button type="submit" fullWidth icon={Save} loading={submitting} className="quotation-form__save">
              {isEdit ? 'Save changes' : 'Save quotation'}
            </Button>
          </Card>
        </div>
      </form>

      <ClientFormModal isOpen={addClientOpen} onClose={() => setAddClientOpen(false)} client={null} onSubmit={handleCreateClient} />
    </>
  );
}

export default QuotationForm;
