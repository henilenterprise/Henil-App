import { buildDocumentPdf } from './buildDocumentPdf.js';
import { getCompanySettings } from '../../services/companySettingsService.js';

/**
 * @param {object} quotation - from quotationsService.getQuotationWithItems(), includes .client and .items
 * @returns {Promise<Uint8Array>}
 */
export async function generateQuotationPdf(quotation) {
  const company = await getCompanySettings();

  return buildDocumentPdf({
    docType: 'QUOTATION',
    docNumber: quotation.quotation_number,
    docDate: quotation.quotation_date,
    secondaryDate: quotation.valid_until ? { label: 'Valid Until', value: quotation.valid_until } : null,
    company,
    customer: quotation.client,
    items: quotation.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      gst_percentage: item.gst_percentage,
      amount: item.amount,
    })),
    subtotal: quotation.subtotal,
    discount: quotation.discount,
    gst: quotation.gst,
    total: quotation.total,
    notes: quotation.notes,
  });
}
