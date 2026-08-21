import { Plus, Trash2 } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Select from '../ui/Select.jsx';
import { computeItemAmount } from '../../utils/quotationCalculations.js';
import { formatCurrency } from '../../utils/formatCurrency.js';
import './QuotationLineItemsEditor.css';

/*
  Selecting a product pre-fills description/unit/rate/GST from the
  product's current defaults, but those values are then just plain
  fields on the item — editable, and never re-synced from the
  product afterward. This is what "don't duplicate product
  information in quotations" means in practice: the product catalog
  is the source of truth going forward, while each quotation item is
  an independent, point-in-time snapshot (so editing a product later
  never silently rewrites a quotation that already went out).
*/
function QuotationLineItemsEditor({ items, products, onChange, errors = [], defaultGst = 18 }) {
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }));

  function updateItem(index, patch) {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  }

  function handleProductSelect(index, productId) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      updateItem(index, { product_id: '' });
      return;
    }
    updateItem(index, {
      product_id: product.id,
      description: product.name,
      unit: product.unit || 'pcs',
      rate: String(product.default_rate ?? ''),
      gst_percentage: String(product.gst_percentage ?? defaultGst),
    });
  }

  function addRow() {
    onChange([
      ...items,
      { product_id: '', description: '', quantity: '1', unit: 'pcs', rate: '', gst_percentage: String(defaultGst) },
    ]);
  }

  function removeRow(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="line-items">
      <div className="line-items__table-wrap">
        <table className="line-items__table">
          <thead>
            <tr>
              <th className="line-items__col-product">Product</th>
              <th className="line-items__col-desc">Description</th>
              <th className="line-items__col-qty">Qty</th>
              <th className="line-items__col-unit">Unit</th>
              <th className="line-items__col-rate">Rate</th>
              <th className="line-items__col-gst">GST %</th>
              <th className="line-items__col-amount">Amount</th>
              <th className="line-items__col-remove" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const rowErrors = errors[index] || {};
              const amount = computeItemAmount(item.quantity, item.rate);
              return (
                <tr key={index}>
                  <td>
                    <Select
                      options={productOptions}
                      value={item.product_id}
                      onChange={(e) => handleProductSelect(index, e.target.value)}
                      placeholder="Custom item"
                    />
                  </td>
                  <td>
                    <input
                      className={`line-items__input ${rowErrors.description ? 'line-items__input--error' : ''}`}
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                      placeholder="Item description"
                    />
                    {rowErrors.description && <span className="line-items__error">{rowErrors.description}</span>}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`line-items__input line-items__input--num ${rowErrors.quantity ? 'line-items__input--error' : ''}`}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    />
                    {rowErrors.quantity && <span className="line-items__error">{rowErrors.quantity}</span>}
                  </td>
                  <td>
                    <input
                      className="line-items__input"
                      value={item.unit}
                      onChange={(e) => updateItem(index, { unit: e.target.value })}
                      placeholder="pcs"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`line-items__input line-items__input--num ${rowErrors.rate ? 'line-items__input--error' : ''}`}
                      value={item.rate}
                      onChange={(e) => updateItem(index, { rate: e.target.value })}
                    />
                    {rowErrors.rate && <span className="line-items__error">{rowErrors.rate}</span>}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className={`line-items__input line-items__input--num ${rowErrors.gst_percentage ? 'line-items__input--error' : ''}`}
                      value={item.gst_percentage}
                      onChange={(e) => updateItem(index, { gst_percentage: e.target.value })}
                    />
                    {rowErrors.gst_percentage && <span className="line-items__error">{rowErrors.gst_percentage}</span>}
                  </td>
                  <td className="line-items__amount">{formatCurrency(amount)}</td>
                  <td>
                    <button
                      type="button"
                      className="line-items__remove"
                      onClick={() => removeRow(index)}
                      aria-label="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" icon={Plus} onClick={addRow}>
        Add item
      </Button>
    </div>
  );
}

export default QuotationLineItemsEditor;
