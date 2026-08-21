import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Textarea from '../ui/Textarea.jsx';
import DatePicker from '../ui/DatePicker.jsx';
import Button from '../ui/Button.jsx';
import Alert from '../ui/Alert.jsx';
import { createPayment, getTotalPaidForInvoice, PAYMENT_METHODS } from '../../services/paymentsService.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { getErrorMessage } from '../../utils/getErrorMessage.js';
import './RecordPaymentModal.css';

const METHOD_OPTIONS = PAYMENT_METHODS.map((m) => ({ value: m, label: m }));

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

/*
  Pass `invoice` (an object with id/invoice_number/remaining) when
  opened from a specific invoice's page — the invoice field is then
  locked. Omit it and pass `invoiceOptions` instead to show a picker
  (used by the standalone Payments list page).
*/
function RecordPaymentModal({ isOpen, onClose, invoice, invoiceOptions = [], onRecorded }) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [remaining, setRemaining] = useState(null);
  const [loadingRemaining, setLoadingRemaining] = useState(false);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState('Bank Transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedInvoiceId(invoice?.id || '');
      setRemaining(invoice ? invoice.remaining : null);
      setAmount('');
      setDate(todayIso());
      setMethod('Bank Transfer');
      setReference('');
      setNotes('');
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen, invoice]);

  useEffect(() => {
    if (!isOpen || invoice || !selectedInvoiceId) return;
    const opt = invoiceOptions.find((o) => o.id === selectedInvoiceId);
    if (!opt) return;
    setLoadingRemaining(true);
    getTotalPaidForInvoice(selectedInvoiceId)
      .then((paid) => setRemaining(Math.max(0, Number(opt.total) - paid)))
      .catch(() => setRemaining(null))
      .finally(() => setLoadingRemaining(false));
  }, [selectedInvoiceId, isOpen, invoice, invoiceOptions]);

  async function handleSubmit(e) {
    e.preventDefault();
    const newErrors = {};
    if (!selectedInvoiceId) newErrors.invoice_id = 'Select an invoice.';
    if (!amount || Number(amount) <= 0) {
      newErrors.amount = 'Enter an amount greater than 0.';
    } else if (remaining !== null && Number(amount) > remaining) {
      newErrors.amount = `Cannot exceed the outstanding balance of ${formatCurrency(remaining)}.`;
    }
    if (!date) newErrors.payment_date = 'Date is required.';
    if (!method) newErrors.payment_method = 'Select a payment method.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createPayment({
        invoice_id: selectedInvoiceId,
        amount: Number(amount),
        payment_date: date,
        payment_method: method,
        reference_number: reference.trim() || null,
        notes: notes.trim() || null,
      });
      onRecorded?.();
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
      title="Record payment"
      description={invoice ? `Against invoice ${invoice.invoice_number}.` : 'Select an invoice and enter payment details.'}
      closeOnOverlayClick={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Record payment
          </Button>
        </>
      }
    >
      <form className="record-payment-form" onSubmit={handleSubmit} noValidate>
        {submitError && (
          <Alert tone="danger" title="Couldn't record payment">
            {submitError}
          </Alert>
        )}

        {invoice ? (
          <div className="record-payment-form__locked-invoice">
            <p className="field__label">Invoice</p>
            <p className="record-payment-form__invoice-number">{invoice.invoice_number}</p>
          </div>
        ) : (
          <Select
            label="Invoice"
            required
            options={invoiceOptions.map((o) => ({
              value: o.id,
              label: `${o.invoice_number} — ${o.client?.company_name || 'Unknown client'}`,
            }))}
            placeholder="Select an invoice"
            value={selectedInvoiceId}
            onChange={(e) => setSelectedInvoiceId(e.target.value)}
            error={errors.invoice_id}
            disabled={submitting}
          />
        )}

        {remaining !== null && !loadingRemaining && (
          <Alert tone="info" title={`Outstanding balance: ${formatCurrency(remaining)}`} />
        )}

        <Input
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          disabled={submitting}
        />
        <DatePicker
          label="Date"
          required
          value={parseIsoDate(date)}
          onChange={(d) => setDate(toIsoDate(d))}
          error={errors.payment_date}
        />
        <Select
          label="Payment method"
          required
          options={METHOD_OPTIONS}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          error={errors.payment_method}
          disabled={submitting}
        />
        <Input
          label="Reference number"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          helperText="Optional — cheque #, UTR, transaction ID, etc."
          disabled={submitting}
        />
        <Textarea
          label="Notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={submitting}
        />
      </form>
    </Modal>
  );
}

export default RecordPaymentModal;
