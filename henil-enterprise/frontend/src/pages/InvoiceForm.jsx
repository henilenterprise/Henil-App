import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Select from '../components/ui/Select.jsx';
import DatePicker from '../components/ui/DatePicker.jsx';
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
import { getQuotationWithItems } from '../services/quotationsService.js';
import { getInvoiceWithItems, createInvoice, updateInvoice } from '../services/invoicesService.js';
import { computeInvoiceTotals } from '../utils/invoiceCalculations.js';
import { validateInvoiceForm } from '../utils/validators.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './InvoiceForm.css';

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

function InvoiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const fromQuotationId = !isEdit ? location.state?.fromQuotationId : null;

  const [loading, setLoading] = useState(isEdit || Boolean(fromQuotationId));
  const [loadError, setLoadError] = useState(null);
  const [clients, setClients] = useState([]);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [sourceQuotationNumber, setSourceQuotationNumber] = useState(null);

  const [quotationId, setQuotationId] = useState(null);
  const [clientId, setClientId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState('');
  const [discount, setDiscount] = useState('0');
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
        // Same reasoning as QuotationForm.jsx: sync the still-pristine
        // initial row to the real configured default. Also safe for
        // the quotation-conversion path — those items have real
        // descriptions/rates already, so they never match "pristine"
        // and are left untouched.
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

  // Editing an existing invoice.
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setLoadError(null);
    getInvoiceWithItems(id)
      .then((inv) => {
        setQuotationId(inv.quotation_id || null);
        setSourceQuotationNumber(inv.quotation?.quotation_number || null);
        setClientId(inv.client_id);
        setInvoiceDate(inv.invoice_date);
        setDueDate(inv.due_date || '');
        setDiscount(String(inv.discount ?? 0));
        setItems(
          inv.items.length > 0
            ? inv.items.map((item) => ({
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

  // Creating a fresh invoice, pre-filled from an accepted quotation.
  useEffect(() => {
    if (isEdit || !fromQuotationId) return;
    setLoading(true);
    setLoadError(null);
    getQuotationWithItems(fromQuotationId)
      .then((q) => {
        setQuotationId(q.id);
        setSourceQuotationNumber(q.quotation_number);
        setClientId(q.client_id);
        setDiscount(String(q.discount ?? 0));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromQuotationId, isEdit]);

  const totals = useMemo(() => computeInvoiceTotals(items, discount), [items, discount]);
  const clientOptions = clients.map((c) => ({ value: c.id, label: c.company_name }));

  async function handleCreateClient(payload) {
    const created = await createClient(payload);
    setClients((current) => [...current, created].sort((a, b) => a.company_name.localeCompare(b.company_name)));
    setClientId(created.id);
    toast.success('Client added', `${created.company_name} was created and selected for this invoice.`);
  }

  async function handleSave(e) {
    e.preventDefault();
    const values = { client_id: clientId, invoice_date: invoiceDate, due_date: dueDate, discount };
    const validation = validateInvoiceForm(values, items);
    setErrors(validation);
    if (!validation.isValid) {
      if (validation.noItems) {
        setSubmitError('Add at least one item to the invoice.');
      }
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateInvoice(id, values, items);
        toast.success('Invoice updated', 'Your changes were saved successfully.');
        navigate(`/invoices/${id}`);
      } else {
        const created = await createInvoice({ ...values, quotation_id: quotationId }, items);
        toast.success('Invoice created', `${created.invoice_number} was created successfully.`);
        navigate(`/invoices/${created.id}`);
      }
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Spinner size="lg" label="Loading…" />;
  }

  if (loadError) {
    return (
      <>
        <Link to="/invoices" className="invoice-form__back">
          <ArrowLeft size={14} />
          Back to invoices
        </Link>
        <Alert tone="danger" title="Couldn't load">
          {loadError}
        </Alert>
      </>
    );
  }

  return (
    <>
      <Link to="/invoices" className="invoice-form__back">
        <ArrowLeft size={14} />
        Back to invoices
      </Link>

      <PageHeader
        title={isEdit ? 'Edit invoice' : 'New invoice'}
        description={
          sourceQuotationNumber
            ? `Converting from quotation ${sourceQuotationNumber}. Set a due date and save.`
            : isEdit
              ? 'Update client, items, or amounts.'
              : 'Select a client, add items, set a due date, and save.'
        }
      />

      <form onSubmit={handleSave}>
        {submitError && (
          <Alert tone="danger" title="Couldn't save this invoice">
            {submitError}
          </Alert>
        )}

        <div className="invoice-form__grid">
          <Card title="Details" className="invoice-form__details">
            <div className="invoice-form__fields">
              <div className="invoice-form__client-field">
                <Select
                  label="Client"
                  required
                  options={clientOptions}
                  placeholder="Select a client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  error={errors.header.client_id}
                  disabled={submitting || Boolean(quotationId)}
                />
                {!quotationId && (
                  <button type="button" className="invoice-form__add-client-btn" onClick={() => setAddClientOpen(true)}>
                    + Add new client
                  </button>
                )}
              </div>
              <DatePicker
                label="Invoice date"
                required
                value={parseIsoDate(invoiceDate)}
                onChange={(date) => setInvoiceDate(toIsoDate(date))}
                error={errors.header.invoice_date}
              />
              <DatePicker
                label="Due date"
                required
                value={parseIsoDate(dueDate)}
                onChange={(date) => setDueDate(toIsoDate(date))}
                error={errors.header.due_date}
              />
            </div>

            <div className="invoice-form__items">
              <p className="invoice-form__section-label">Items</p>
              <QuotationLineItemsEditor
                items={items}
                products={products}
                onChange={setItems}
                errors={errors.items}
                defaultGst={defaultGst}
              />
            </div>
          </Card>

          <Card title="Summary" className="invoice-form__summary-card">
            <QuotationSummaryPanel
              totals={totals}
              discount={discount}
              onDiscountChange={setDiscount}
              discountError={errors.header.discount}
              disabled={submitting}
            />
            <Button type="submit" fullWidth icon={Save} loading={submitting} className="invoice-form__save">
              {isEdit ? 'Save changes' : 'Save invoice'}
            </Button>
          </Card>
        </div>
      </form>

      <ClientFormModal isOpen={addClientOpen} onClose={() => setAddClientOpen(false)} client={null} onSubmit={handleCreateClient} />
    </>
  );
}

export default InvoiceForm;
