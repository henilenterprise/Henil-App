import { buildDocumentPdf } from './buildDocumentPdf.js';
import { getCompanySettings } from '../../services/companySettingsService.js';

/**
 * @param {object} invoice - from invoicesService.getInvoiceWithItems(), includes .client, .items, .paid, .remaining, optional .quotation
 * @returns {Promise<Uint8Array>}
 */
export async function generateInvoicePdf(invoice) {
  const company = await getCompanySettings();

  return buildDocumentPdf({
    docType: 'TAX INVOICE',
    docNumber: invoice.invoice_number,
    docDate: invoice.invoice_date,
    secondaryDate: invoice.due_date ? { label: 'Due Date', value: invoice.due_date } : null,
    extraMeta: invoice.quotation ? [{ label: 'Converted from', value: invoice.quotation.quotation_number }] : [],
    company,
    customer: invoice.client,
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      gst_percentage: item.gst_percentage,
      amount: item.amount,
    })),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    gst: invoice.gst,
    total: invoice.total,
    paymentSummary: { paid: invoice.paid, remaining: invoice.remaining },
  });
}
