import Input from '../ui/Input.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import './QuotationSummaryPanel.css';

function QuotationSummaryPanel({ totals, discount, onDiscountChange, discountError, disabled }) {
  return (
    <div className="quotation-summary">
      <div className="quotation-summary__row">
        <span>Subtotal</span>
        <span>{formatCurrency(totals.subtotal)}</span>
      </div>

      <div className="quotation-summary__row quotation-summary__row--discount">
        <span>Discount</span>
        <div className="quotation-summary__discount-input">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(e) => onDiscountChange(e.target.value)}
            error={discountError}
            disabled={disabled}
            aria-label="Discount"
          />
        </div>
      </div>

      <div className="quotation-summary__row">
        <span>GST</span>
        <span>{formatCurrency(totals.gst)}</span>
      </div>

      <div className="quotation-summary__row quotation-summary__row--total">
        <span>Total</span>
        <span>{formatCurrency(totals.total)}</span>
      </div>
    </div>
  );
}

export default QuotationSummaryPanel;
