export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PINCODE_REGEX = /^[0-9]{6}$/;

/*
  Mirrors the CHECK constraints on public.clients (see
  database/migrations/20260815090200_clients.sql) so the person gets
  an inline, friendly error instead of a raw Postgres constraint
  violation after submitting.
*/
export function validateClientForm(values) {
  const errors = {};

  if (!values.company_name?.trim()) {
    errors.company_name = 'Company name is required.';
  }
  if (values.email && !EMAIL_REGEX.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (values.gst_number && !GST_REGEX.test(values.gst_number.trim().toUpperCase())) {
    errors.gst_number = 'Enter a valid 15-character GSTIN (e.g. 24AAAAA0000A1Z5).';
  }
  if (values.pincode && !PINCODE_REGEX.test(values.pincode.trim())) {
    errors.pincode = 'Enter a valid 6-digit pincode.';
  }

  return errors;
}

/*
  suppliers has the exact same shape and CHECK constraints as clients
  (see database/migrations/20260815091000_suppliers.sql's own comment
  on why) — implemented as a thin wrapper rather than a copy-pasted
  duplicate, so the two can never silently drift out of sync.
*/
export function validateSupplierForm(values) {
  return validateClientForm(values);
}

/*
  Mirrors the CHECK constraints on public.products (see
  database/migrations/20260815090300_products.sql).
*/
export function validateProductForm(values) {
  const errors = {};

  if (!values.name?.trim()) {
    errors.name = 'Product name is required.';
  }
  if (!values.sku?.trim()) {
    errors.sku = 'SKU is required.';
  }

  const rate = values.default_rate;
  if (rate === '' || rate === null || rate === undefined) {
    errors.default_rate = 'Default rate is required.';
  } else if (Number.isNaN(Number(rate)) || Number(rate) < 0) {
    errors.default_rate = 'Enter a valid rate of 0 or more.';
  }

  const gst = values.gst_percentage;
  if (gst !== '' && gst !== null && gst !== undefined) {
    if (Number.isNaN(Number(gst)) || Number(gst) < 0 || Number(gst) > 100) {
      errors.gst_percentage = 'Enter a GST percentage between 0 and 100.';
    }
  }

  return errors;
}

/*
  Validates a quotation form: header fields + the line items array.
  Returns { header: {...}, items: [{}, {field: msg}, ...] } — items is
  index-aligned with the items array so the UI can show an error under
  the exact row/field that's wrong.
*/
export function validateQuotationForm(values, items) {
  const header = {};
  if (!values.client_id) {
    header.client_id = 'Select a client.';
  }
  if (!values.quotation_date) {
    header.quotation_date = 'Quotation date is required.';
  }
  if (
    values.valid_until &&
    values.quotation_date &&
    new Date(values.valid_until) < new Date(values.quotation_date)
  ) {
    header.valid_until = 'Valid-until date cannot be before the quotation date.';
  }
  const discount = values.discount;
  if (discount !== '' && discount !== null && discount !== undefined) {
    if (Number.isNaN(Number(discount)) || Number(discount) < 0) {
      header.discount = 'Discount cannot be negative.';
    }
  }

  const itemErrors = items.map((item) => {
    const errs = {};
    if (!item.description?.trim()) errs.description = 'Required';
    if (!item.quantity || Number(item.quantity) <= 0) errs.quantity = 'Must be > 0';
    if (item.rate === '' || item.rate === null || Number(item.rate) < 0) errs.rate = 'Must be ≥ 0';
    if (
      item.gst_percentage !== '' &&
      item.gst_percentage !== null &&
      (Number.isNaN(Number(item.gst_percentage)) || Number(item.gst_percentage) < 0 || Number(item.gst_percentage) > 100)
    ) {
      errs.gst_percentage = '0–100';
    }
    return errs;
  });

  const hasItemErrors = itemErrors.some((e) => Object.keys(e).length > 0);
  const noItems = items.length === 0;

  return {
    header,
    items: itemErrors,
    isValid: Object.keys(header).length === 0 && !hasItemErrors && !noItems,
    noItems,
  };
}

/*
  Validates an invoice form: header fields + the line items array.
  Same shape as validateQuotationForm, but due_date is required (not
  optional like a quotation's valid_until) and must not be before the
  invoice date.
*/
export function validateInvoiceForm(values, items) {
  const header = {};
  if (!values.client_id) {
    header.client_id = 'Select a client.';
  }
  if (!values.invoice_date) {
    header.invoice_date = 'Invoice date is required.';
  }
  if (!values.due_date) {
    header.due_date = 'Due date is required.';
  } else if (values.invoice_date && new Date(values.due_date) < new Date(values.invoice_date)) {
    header.due_date = 'Due date cannot be before the invoice date.';
  }
  const discount = values.discount;
  if (discount !== '' && discount !== null && discount !== undefined) {
    if (Number.isNaN(Number(discount)) || Number(discount) < 0) {
      header.discount = 'Discount cannot be negative.';
    }
  }

  const itemErrors = items.map((item) => {
    const errs = {};
    if (!item.description?.trim()) errs.description = 'Required';
    if (!item.quantity || Number(item.quantity) <= 0) errs.quantity = 'Must be > 0';
    if (item.rate === '' || item.rate === null || Number(item.rate) < 0) errs.rate = 'Must be ≥ 0';
    if (
      item.gst_percentage !== '' &&
      item.gst_percentage !== null &&
      (Number.isNaN(Number(item.gst_percentage)) || Number(item.gst_percentage) < 0 || Number(item.gst_percentage) > 100)
    ) {
      errs.gst_percentage = '0–100';
    }
    return errs;
  });

  const hasItemErrors = itemErrors.some((e) => Object.keys(e).length > 0);
  const noItems = items.length === 0;

  return {
    header,
    items: itemErrors,
    isValid: Object.keys(header).length === 0 && !hasItemErrors && !noItems,
    noItems,
  };
}

/*
  Validates an expense form. Mirrors the not-null/CHECK constraints on
  public.expenses (see database/migrations/20260815090900_expenses.sql).
*/
export function validateExpenseForm(values) {
  const errors = {};

  if (!values.date) {
    errors.date = 'Date is required.';
  }
  if (!values.category?.trim()) {
    errors.category = 'Category is required.';
  }
  if (!values.description?.trim()) {
    errors.description = 'Description is required.';
  }

  const amount = values.amount;
  if (amount === '' || amount === null || amount === undefined) {
    errors.amount = 'Amount is required.';
  } else if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    errors.amount = 'Enter an amount greater than 0.';
  }

  if (!values.payment_method) {
    errors.payment_method = 'Select a payment method.';
  }

  return errors;
}

/*
  Validates a stock transaction form (add/remove/adjust/opening
  stock). `magnitude` is always the positive number the user typed;
  direction (for adjustments) is handled by the caller before this.
*/
export function validateStockTransactionForm({ productId, magnitude }) {
  const errors = {};
  if (!productId) {
    errors.product_id = 'Select a product.';
  }
  if (magnitude === '' || magnitude === null || magnitude === undefined) {
    errors.quantity = 'Quantity is required.';
  } else if (Number.isNaN(Number(magnitude)) || Number(magnitude) <= 0) {
    errors.quantity = 'Enter a quantity greater than 0.';
  }
  return errors;
}

/*
  Mirrors the CHECK constraints on public.artworks (see
  database/migrations/20260815101100_artwork_vault.sql).
*/
export function validateArtworkForm(values) {
  const errors = {};
  if (!values.artwork_name?.trim()) {
    errors.artwork_name = 'Artwork name is required.';
  }
  if (values.width !== '' && values.width !== null && values.width !== undefined) {
    if (Number.isNaN(Number(values.width)) || Number(values.width) <= 0) {
      errors.width = 'Width must be greater than 0.';
    }
  }
  if (values.height !== '' && values.height !== null && values.height !== undefined) {
    if (Number.isNaN(Number(values.height)) || Number(values.height) <= 0) {
      errors.height = 'Height must be greater than 0.';
    }
  }
  if (values.quantity !== '' && values.quantity !== null && values.quantity !== undefined) {
    if (Number.isNaN(Number(values.quantity)) || Number(values.quantity) < 0) {
      errors.quantity = 'Quantity cannot be negative.';
    }
  }
  return errors;
}
