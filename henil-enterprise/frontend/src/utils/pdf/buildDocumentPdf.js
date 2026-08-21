import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/*
  Real PDF generation via pdf-lib: every element (text, table lines,
  header bar) is drawn as an actual PDF primitive — vector text and
  vector graphics — not a screenshot or rasterized image of the page.
  The output is selectable/searchable/copyable text, same as any
  professionally-produced PDF.

  Pagination is handled manually (pdf-lib has no built-in flow
  layout): ensureSpace() below checks the remaining vertical space
  before drawing anything and starts a new page — repeating the table
  column header — whenever content would run past the bottom margin.
  This is what makes long quotations/invoices span multiple pages
  correctly instead of overflowing or getting cut off.
*/

const PAGE_WIDTH = 595.28; // A4 at 72 DPI
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM_Y = 60; // nothing but the footer is drawn below this

const COLORS = {
  black: rgb(0.04, 0.04, 0.04),
  gold: rgb(0.79, 0.64, 0.15),
  white: rgb(1, 1, 1),
  textMuted: rgb(0.4, 0.4, 0.4),
  textFaint: rgb(0.55, 0.55, 0.55),
  border: rgb(0.85, 0.85, 0.85),
  rowAlt: rgb(0.97, 0.97, 0.96),
};

// Item table column widths (sum exactly to CONTENT_WIDTH).
const COL = {
  sr: 25,
  desc: 205,
  qty: 40,
  unit: 45,
  rate: 70,
  gst: 40,
  amount: CONTENT_WIDTH - (25 + 205 + 40 + 45 + 70 + 40), // 90.28
};

function formatMoney(n) {
  const num = Number(n) || 0;
  return `Rs. ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateStr(value) {
  if (!value) return '\u2014';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth || !current) {
      current = test;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * @param {object} spec
 * @param {'QUOTATION'|'TAX INVOICE'} spec.docType
 * @param {string} spec.docNumber
 * @param {string|Date} spec.docDate
 * @param {{label:string, value:string}} [spec.secondaryDate] - Valid Until / Due Date
 * @param {Array<{label:string, value:string}>} [spec.extraMeta]
 * @param {object} spec.company - from companySettingsService.getCompanySettings()
 * @param {object} spec.customer - client row
 * @param {Array<{description:string, quantity:number, unit:string, rate:number, gst_percentage:number, amount:number}>} spec.items
 * @param {number} spec.subtotal
 * @param {number} spec.discount
 * @param {number} spec.gst
 * @param {number} spec.total
 * @param {{paid:number, remaining:number}} [spec.paymentSummary] - invoices only
 * @param {string} [spec.notes]
 * @returns {Promise<Uint8Array>}
 */
export async function buildDocumentPdf(spec) {
  const {
    docType,
    docNumber,
    docDate,
    secondaryDate,
    extraMeta = [],
    company,
    customer,
    items,
    subtotal,
    discount,
    gst,
    total,
    paymentSummary,
    notes,
  } = spec;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let logoImage = null;
  let logoDims = null;
  if (company?.logo) {
    try {
      const res = await fetch(company.logo);
      const bytes = await res.arrayBuffer();
      const isPng = company.logo.toLowerCase().includes('.png');
      logoImage = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      const scale = 36 / logoImage.height;
      logoDims = { width: logoImage.width * scale, height: 36 };
    } catch {
      logoImage = null; // fall back to the drawn monogram below
    }
  }

  const pages = [];
  let page = null;
  let y = 0;

  function addPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
    return page;
  }

  function drawRight(text, rightX, yPos, size, f, color) {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightX - w, y: yPos, size, font: f, color });
  }

  function drawBrandMark(x, topY) {
    const size = 36;
    if (logoImage) {
      page.drawImage(logoImage, { x, y: topY - size, width: logoDims.width, height: logoDims.height });
      return logoDims.width;
    }
    page.drawRectangle({ x, y: topY - size, width: size, height: size, color: COLORS.gold });
    const letter = 'H';
    const letterSize = 20;
    const lw = fontBold.widthOfTextAtSize(letter, letterSize);
    page.drawText(letter, {
      x: x + (size - lw) / 2,
      y: topY - size + (size - letterSize) / 2 + 2,
      size: letterSize,
      font: fontBold,
      color: COLORS.black,
    });
    return size;
  }

  function drawDocumentHeader() {
    const topY = y;
    const markWidth = drawBrandMark(MARGIN, topY);

    const nameX = MARGIN + markWidth + 12;
    page.drawText((company?.company_name || 'Henil Enterprise').toUpperCase(), {
      x: nameX,
      y: topY - 14,
      size: 16,
      font: fontBold,
      color: COLORS.black,
    });
    page.drawText('Acrylic & Polycarbonate Manufacturing & Fabrication', {
      x: nameX,
      y: topY - 28,
      size: 8.5,
      font,
      color: COLORS.textMuted,
    });

    const rightX = MARGIN + CONTENT_WIDTH;
    drawRight(docType, rightX, topY - 12, 18, fontBold, COLORS.gold);
    drawRight(docNumber, rightX, topY - 30, 12, fontBold, COLORS.black);
    drawRight(`Date: ${formatDateStr(docDate)}`, rightX, topY - 44, 9, font, COLORS.textMuted);
    if (secondaryDate) {
      drawRight(`${secondaryDate.label}: ${formatDateStr(secondaryDate.value)}`, rightX, topY - 56, 9, font, COLORS.textMuted);
    }
    let metaY = topY - (secondaryDate ? 68 : 56);
    for (const meta of extraMeta) {
      drawRight(`${meta.label}: ${meta.value}`, rightX, metaY, 9, font, COLORS.textMuted);
      metaY -= 12;
    }

    y = topY - 46;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + CONTENT_WIDTH, y },
      thickness: 1.5,
      color: COLORS.gold,
    });
    y -= 22;
  }

  function drawPartyBlock(heading, lines, x, width) {
    page.drawText(heading, { x, y, size: 9, font: fontBold, color: COLORS.textFaint });
    let ly = y - 14;
    for (const line of lines) {
      if (!line) continue;
      const wrapped = wrapText(line, font, 9.5, width);
      for (const wLine of wrapped) {
        page.drawText(wLine, { x, y: ly, size: 9.5, font, color: COLORS.black });
        ly -= 13;
      }
    }
    return ly;
  }

  function drawPartiesSection() {
    const colWidth = (CONTENT_WIDTH - 30) / 2;
    const startY = y;

    const companyLines = [
      company?.company_name,
      company?.address,
      [company?.phone, company?.email].filter(Boolean).join('  \u00b7  '),
      company?.gst_number ? `GSTIN: ${company.gst_number}` : null,
      company?.website,
    ].filter(Boolean);
    const leftEnd = drawPartyBlock('FROM', companyLines, MARGIN, colWidth);

    y = startY;
    const customerLines = [
      customer?.company_name,
      customer?.contact_person,
      [customer?.phone, customer?.email].filter(Boolean).join('  \u00b7  '),
      [customer?.address, customer?.city, customer?.state].filter(Boolean).join(', '),
      customer?.gst_number ? `GSTIN: ${customer.gst_number}` : null,
    ].filter(Boolean);
    const rightEnd = drawPartyBlock('BILL TO', customerLines, MARGIN + colWidth + 30, colWidth);

    y = Math.min(leftEnd, rightEnd) - 18;
  }

  function ensureSpace(neededHeight, { repeatTableHeader = false } = {}) {
    if (y - neededHeight < CONTENT_BOTTOM_Y) {
      addPage();
      if (repeatTableHeader) {
        drawContinuedNote();
        drawTableHeaderRow();
      }
    }
  }

  function drawContinuedNote() {
    page.drawText(`${docType} ${docNumber} (continued)`, {
      x: MARGIN,
      y,
      size: 9,
      font: fontBold,
      color: COLORS.textFaint,
    });
    y -= 16;
  }

  const colX = {
    sr: MARGIN,
    desc: MARGIN + COL.sr,
    qty: MARGIN + COL.sr + COL.desc,
    unit: MARGIN + COL.sr + COL.desc + COL.qty,
    rate: MARGIN + COL.sr + COL.desc + COL.qty + COL.unit,
    gst: MARGIN + COL.sr + COL.desc + COL.qty + COL.unit + COL.rate,
    amount: MARGIN + COL.sr + COL.desc + COL.qty + COL.unit + COL.rate + COL.gst,
  };

  function drawTableHeaderRow() {
    const rowH = 22;
    page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_WIDTH, height: rowH, color: COLORS.black });
    const labelY = y - rowH + 7;
    const headerSize = 8;
    page.drawText('#', { x: colX.sr + 6, y: labelY, size: headerSize, font: fontBold, color: COLORS.white });
    page.drawText('DESCRIPTION', { x: colX.desc + 4, y: labelY, size: headerSize, font: fontBold, color: COLORS.white });
    drawRight('QTY', colX.unit - 6, labelY, headerSize, fontBold, COLORS.white);
    page.drawText('UNIT', { x: colX.unit + 4, y: labelY, size: headerSize, font: fontBold, color: COLORS.white });
    drawRight('RATE', colX.gst - 6, labelY, headerSize, fontBold, COLORS.white);
    drawRight('GST%', colX.amount - 6, labelY, headerSize, fontBold, COLORS.white);
    drawRight('AMOUNT', MARGIN + CONTENT_WIDTH - 6, labelY, headerSize, fontBold, COLORS.white);
    y -= rowH;
  }

  function drawItemsTable() {
    ensureSpace(22);
    drawTableHeaderRow();

    items.forEach((item, index) => {
      const descLines = wrapText(item.description || '', font, 9, COL.desc - 8);
      const lineCount = Math.max(1, descLines.length);
      const rowH = lineCount * 12 + 10;

      ensureSpace(rowH, { repeatTableHeader: true });

      if (index % 2 === 1) {
        page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_WIDTH, height: rowH, color: COLORS.rowAlt });
      }

      const textTopY = y - 12;
      page.drawText(String(index + 1), { x: colX.sr + 6, y: textTopY, size: 9, font, color: COLORS.black });
      descLines.forEach((line, i) => {
        page.drawText(line, { x: colX.desc + 4, y: textTopY - i * 12, size: 9, font, color: COLORS.black });
      });
      drawRight(String(item.quantity), colX.unit - 6, textTopY, 9, font, COLORS.black);
      page.drawText(item.unit || '', { x: colX.unit + 4, y: textTopY, size: 9, font, color: COLORS.black });
      drawRight(formatMoney(item.rate), colX.gst - 6, textTopY, 9, font, COLORS.black);
      drawRight(`${item.gst_percentage ?? 0}%`, colX.amount - 6, textTopY, 9, font, COLORS.black);
      drawRight(formatMoney(item.amount), MARGIN + CONTENT_WIDTH - 6, textTopY, 9, fontBold, COLORS.black);

      y -= rowH;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: MARGIN + CONTENT_WIDTH, y },
        thickness: 0.5,
        color: COLORS.border,
      });
    });

    y -= 4;
  }

  function drawTotalsBlock() {
    const rows = [
      ['Subtotal', formatMoney(subtotal)],
      ['Discount', discount ? `- ${formatMoney(discount)}` : formatMoney(0)],
      ['GST', formatMoney(gst)],
    ];
    const needed = 20 + rows.length * 16 + 24 + (paymentSummary ? 34 : 0);
    ensureSpace(needed);

    const blockWidth = 220;
    const blockX = MARGIN + CONTENT_WIDTH - blockWidth;
    let ty = y;

    for (const [label, value] of rows) {
      page.drawText(label, { x: blockX, y: ty, size: 9.5, font, color: COLORS.textMuted });
      drawRight(value, blockX + blockWidth, ty, 9.5, font, COLORS.black);
      ty -= 16;
    }

    ty -= 4;
    page.drawLine({ start: { x: blockX, y: ty }, end: { x: blockX + blockWidth, y: ty }, thickness: 1, color: COLORS.black });
    ty -= 18;
    page.drawText('TOTAL', { x: blockX, y: ty, size: 12, font: fontBold, color: COLORS.black });
    drawRight(formatMoney(total), blockX + blockWidth, ty, 12, fontBold, COLORS.black);

    if (paymentSummary) {
      ty -= 20;
      page.drawText('Paid', { x: blockX, y: ty, size: 9.5, font, color: COLORS.textMuted });
      drawRight(formatMoney(paymentSummary.paid), blockX + blockWidth, ty, 9.5, font, COLORS.black);
      ty -= 16;
      page.drawText('Balance Due', { x: blockX, y: ty, size: 10, font: fontBold, color: COLORS.gold });
      drawRight(formatMoney(paymentSummary.remaining), blockX + blockWidth, ty, 10, fontBold, COLORS.gold);
    }

    y = ty - 26;
  }

  function drawTextSection(heading, bodyLines) {
    if (!bodyLines || bodyLines.length === 0) return;
    ensureSpace(16 + bodyLines.length * 12);
    page.drawText(heading, { x: MARGIN, y, size: 9.5, font: fontBold, color: COLORS.textFaint });
    y -= 14;
    for (const line of bodyLines) {
      ensureSpace(12);
      page.drawText(line, { x: MARGIN, y, size: 8.5, font, color: COLORS.textMuted });
      y -= 12;
    }
    y -= 12;
  }

  function paymentDetailsLines() {
    // Matches the Settings page's own help text ("Shown on
    // quotations, and on invoices if no bank details are filled in
    // below"): a quotation is set before any invoice exists, so bank
    // details would be premature there — always show payment terms
    // instead. An invoice is when money is actually due, so bank
    // details (the "how to pay") take priority, falling back to
    // payment terms only if none are configured.
    if (docType === 'QUOTATION') {
      if (company?.payment_terms) return wrapText(company.payment_terms, font, 8.5, CONTENT_WIDTH);
      return ['50% advance payment required to confirm the order. Balance due before delivery.'];
    }

    const bank = company?.bank_details;
    if (bank && (bank.account_number || bank.bank_name)) {
      const lines = [];
      if (bank.bank_name) lines.push(`Bank: ${bank.bank_name}`);
      if (bank.account_number) lines.push(`Account No: ${bank.account_number}`);
      if (bank.ifsc) lines.push(`IFSC: ${bank.ifsc}`);
      if (bank.branch) lines.push(`Branch: ${bank.branch}`);
      return lines;
    }
    if (company?.payment_terms) return wrapText(company.payment_terms, font, 8.5, CONTENT_WIDTH);
    return ['Please make payment on or before the due date shown above.'];
  }

  function termsLines() {
    const raw =
      (docType === 'QUOTATION' ? company?.quotation_terms : company?.invoice_terms) ||
      [
        'This document is valid subject to the terms specified above.',
        'Prices are subject to change without prior notice after the validity/due date.',
        'Goods once sold will not be taken back or exchanged.',
        'All disputes are subject to Ahmedabad jurisdiction.',
      ].join('\n');
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .flatMap((l) => wrapText(l, font, 8.5, CONTENT_WIDTH));
  }

  function drawFooters() {
    const now = new Date();
    const generatedLabel = `Generated on ${formatDateStr(now)} \u2014 this is a computer-generated document.`;
    pages.forEach((p, idx) => {
      p.drawLine({
        start: { x: MARGIN, y: 40 },
        end: { x: MARGIN + CONTENT_WIDTH, y: 40 },
        thickness: 0.5,
        color: COLORS.border,
      });
      p.drawText(generatedLabel, { x: MARGIN, y: 25, size: 7, font, color: COLORS.textFaint });
      const pageLabel = `Page ${idx + 1} of ${pages.length}`;
      const w = font.widthOfTextAtSize(pageLabel, 7);
      p.drawText(pageLabel, { x: MARGIN + CONTENT_WIDTH - w, y: 25, size: 7, font, color: COLORS.textFaint });
    });
  }

  // ---- Build the document ----
  addPage();
  drawDocumentHeader();
  drawPartiesSection();
  drawItemsTable();
  drawTotalsBlock();
  drawTextSection('PAYMENT DETAILS', paymentDetailsLines());
  drawTextSection('TERMS & CONDITIONS', termsLines());
  if (notes) {
    drawTextSection('NOTES', wrapText(notes, font, 8.5, CONTENT_WIDTH));
  }
  drawFooters();

  return pdfDoc.save();
}
