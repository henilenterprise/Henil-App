import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Textarea from '../ui/Textarea.jsx';
import Button from '../ui/Button.jsx';
import Alert from '../ui/Alert.jsx';
import {
  recordInventoryTransaction,
  ADD_TRANSACTION_TYPES,
  REMOVE_TRANSACTION_TYPES,
} from '../../services/inventoryService.js';
import { validateStockTransactionForm } from '../../utils/validators.js';
import { getErrorMessage } from '../../utils/getErrorMessage.js';
import './StockTransactionModal.css';

const ADJUSTMENT_DIRECTIONS = [
  { value: 'increase', label: 'Increase stock' },
  { value: 'decrease', label: 'Decrease stock' },
];

const MODE_META = {
  add: { title: 'Add stock', typeOptions: ADD_TRANSACTION_TYPES, defaultType: 'PURCHASE' },
  remove: { title: 'Remove stock', typeOptions: REMOVE_TRANSACTION_TYPES, defaultType: 'USAGE' },
  adjust: { title: 'Adjust stock', typeOptions: null, defaultType: 'ADJUSTMENT' },
  opening: { title: 'Set opening stock', typeOptions: null, defaultType: 'ADJUSTMENT' },
};

/*
  mode: 'add' | 'remove' | 'adjust' | 'opening'
  `add`/`remove` let the user pick which of the two relevant
  transaction types this is (Purchase vs Return, Usage vs Damage).
  `adjust`/`opening` always record an ADJUSTMENT, with an
  increase/decrease direction toggle since that type is signed.
*/
function StockTransactionModal({ isOpen, onClose, product, currentQuantity, mode, onRecorded }) {
  const meta = MODE_META[mode] || MODE_META.add;
  const isSigned = mode === 'adjust' || mode === 'opening';

  const [transactionType, setTransactionType] = useState(meta.defaultType);
  const [direction, setDirection] = useState('increase');
  const [magnitude, setMagnitude] = useState('');
  const [reference, setReference] = useState(mode === 'opening' ? 'Opening stock' : '');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setTransactionType(meta.defaultType);
      setDirection('increase');
      setMagnitude('');
      setReference(mode === 'opening' ? 'Opening stock' : '');
      setNotes('');
      setErrors({});
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, product, mode]);

  const willExceedStock =
    (mode === 'remove' || (isSigned && direction === 'decrease')) &&
    magnitude !== '' &&
    !Number.isNaN(Number(magnitude)) &&
    Number(magnitude) > currentQuantity;

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validateStockTransactionForm({ productId: product?.id, magnitude });
    if (willExceedStock) {
      validationErrors.quantity = `Cannot exceed the current stock of ${currentQuantity}.`;
    }
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const signedQuantity = isSigned
      ? (direction === 'increase' ? 1 : -1) * Number(magnitude)
      : Number(magnitude);
    const type = isSigned ? 'ADJUSTMENT' : transactionType;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await recordInventoryTransaction({
        product_id: product.id,
        transaction_type: type,
        quantity: signedQuantity,
        reference: reference.trim() || null,
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
      title={meta.title}
      description={product ? `${product.name} (${product.sku})` : ''}
      closeOnOverlayClick={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {meta.title}
          </Button>
        </>
      }
    >
      <form className="stock-transaction-form" onSubmit={handleSubmit} noValidate>
        {submitError && (
          <Alert tone="danger" title="Couldn't record this transaction">
            {submitError}
          </Alert>
        )}

        <Alert tone="info" title={`Current stock: ${currentQuantity} ${product?.unit || ''}`} />

        {meta.typeOptions && (
          <Select
            label="Type"
            required
            options={meta.typeOptions}
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            disabled={submitting}
          />
        )}

        {isSigned && (
          <Select
            label="Direction"
            required
            options={ADJUSTMENT_DIRECTIONS}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            disabled={submitting}
          />
        )}

        <Input
          label="Quantity"
          type="number"
          min="0"
          step="0.01"
          required
          value={magnitude}
          onChange={(e) => setMagnitude(e.target.value)}
          error={errors.quantity}
          disabled={submitting}
          helperText={product?.unit ? `In ${product.unit}` : undefined}
        />
        <Input
          label="Reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          helperText="Optional — PO number, job number, stock count date, etc."
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

export default StockTransactionModal;
