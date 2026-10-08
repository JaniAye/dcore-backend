import { jsPDF } from 'jspdf';
import { SaleDto } from '../types';

interface BillPdfOptions {
  filename?: string;
  deliveryFee?: number;
  statusLabel?: string;
}

export const formatCurrency = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return 'Rs. 0.00';
  return `Rs. ${Number(val).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return new Date().toLocaleString();
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString('en-LK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Generates and immediately downloads a PDF bill completely in-memory using jsPDF.
 * No server files are created or stored.
 */
export const generateBillPdf = (sale: SaleDto, options: BillPdfOptions = {}): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('DCORE POS & INVENTORY', pageWidth / 2, y, { align: 'center' });
  y += 7;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('RETAIL & WHOLESALE SALES BILL', pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Divider Line
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // Invoice & Customer Info Grid
  doc.setFontSize(9.5);
  const leftColX = 14;
  const rightColX = pageWidth / 2 + 5;

  // Invoice Details (Left)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('BILL DETAILS', leftColX, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Invoice No: ${sale.invoiceId || `#INV-${sale.id}`}`, leftColX, y);
  y += 4.5;
  doc.text(`Date & Time: ${formatDate(sale.createdAt)}`, leftColX, y);
  y += 4.5;
  if (sale.sellerName) {
    doc.text(`Cashier / Staff: ${sale.sellerName}`, leftColX, y);
    y += 4.5;
  }
  if (sale.isInternal) {
    doc.setTextColor(220, 38, 38);
    doc.text(`Internal Sale: ${sale.internalReason || 'Yes'}`, leftColX, y);
    doc.setTextColor(71, 85, 105);
    y += 4.5;
  }

  // Customer Details (Right)
  let custY = y - (sale.sellerName ? (sale.isInternal ? 18 : 13.5) : (sale.isInternal ? 13.5 : 9));
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('CUSTOMER DETAILS', rightColX, custY);
  custY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const customerName = sale.customerName || 'Walk-in Customer';
  doc.text(`Customer Name: ${customerName}`, rightColX, custY);
  custY += 4.5;

  if (sale.customerMobile) {
    doc.text(`Mobile: ${sale.customerMobile}`, rightColX, custY);
    custY += 4.5;
  }

  y = Math.max(y, custY) + 6;

  // Items Table Header
  const colX = {
    index: 14,
    product: 26,
    unitPrice: 110,
    discount: 135,
    qty: 158,
    total: pageWidth - 14,
  };

  // Header background box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(14, y - 4, pageWidth - 28, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  doc.text('#', colX.index, y + 1);
  doc.text('Item Description', colX.product, y + 1);
  doc.text('Unit Price', colX.unitPrice, y + 1, { align: 'right' });
  doc.text('Discount', colX.discount, y + 1, { align: 'right' });
  doc.text('Qty', colX.qty, y + 1, { align: 'right' });
  doc.text('Subtotal', colX.total, y + 1, { align: 'right' });
  y += 8;

  // Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  (sale.items || []).forEach((item, index) => {
    // Check page overflow
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    const itemNum = `${index + 1}`;
    const codePrefix = item.productCode ? `[${item.productCode}] ` : '';
    const itemTitle = `${codePrefix}${item.productName}${item.description ? ` - ${item.description}` : ''}`;
    const unitPriceStr = formatCurrency(item.unitPrice).replace('Rs. ', '');
    const discountVal = item.discountAmount || 0;
    const discountStr = discountVal > 0 ? `-${formatCurrency(discountVal).replace('Rs. ', '')}` : '0.00';
    const qtyStr = `${item.quantity}`;
    const lineSubtotal = item.subtotal ?? (item.unitPrice * item.quantity - discountVal);
    const totalStr = formatCurrency(lineSubtotal).replace('Rs. ', '');

    doc.text(itemNum, colX.index, y);
    doc.text(itemTitle.length > 40 ? itemTitle.substring(0, 38) + '...' : itemTitle, colX.product, y);
    doc.text(unitPriceStr, colX.unitPrice, y, { align: 'right' });
    doc.text(discountStr, colX.discount, y, { align: 'right' });
    doc.text(qtyStr, colX.qty, y, { align: 'right' });
    doc.text(totalStr, colX.total, y, { align: 'right' });

    y += 5.5;
  });

  // Table bottom border
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  // Summary Totals Section
  const summaryX = pageWidth - 75;
  const valX = pageWidth - 14;

  const totalDiscount = sale.discountAmount || 0;
  const grossTotal = sale.totalAmount || (sale.finalAmount + totalDiscount);
  const netAmount = sale.finalAmount ?? (grossTotal - totalDiscount);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  // Subtotal
  doc.text('Subtotal (Gross):', summaryX, y);
  doc.text(formatCurrency(grossTotal), valX, y, { align: 'right' });
  y += 5;

  // Total Discount
  if (totalDiscount > 0 || (sale.discountReason)) {
    doc.setTextColor(220, 38, 38);
    const discLabel = sale.discountReason ? `Discount (${sale.discountReason}):` : 'Total Bill Discount:';
    doc.text(discLabel, summaryX, y);
    doc.text(`-${formatCurrency(totalDiscount)}`, valX, y, { align: 'right' });
    doc.setTextColor(71, 85, 105);
    y += 5;
  }

  if (options.deliveryFee && options.deliveryFee > 0) {
    doc.text('Delivery Fee:', summaryX, y);
    doc.text(formatCurrency(options.deliveryFee), valX, y, { align: 'right' });
    y += 5;
  }

  // Net Amount Box
  y += 1;
  doc.setFillColor(248, 250, 252);
  doc.rect(summaryX - 5, y - 4, pageWidth - summaryX - 9, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Final Payable:', summaryX, y + 1.5);
  doc.text(formatCurrency(netAmount), valX, y + 1.5, { align: 'right' });
  y += 10;

  // Payments Breakdown
  if (sale.payments && sale.payments.length > 0) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    sale.payments.forEach(p => {
      doc.text(`Paid via ${p.paymentMethod || 'Payment'}:`, summaryX, y);
      doc.text(formatCurrency(p.amount), valX, y, { align: 'right' });
      y += 4.5;
    });
  }

  // Outstanding Balance
  const outstanding = sale.outstandingBalance ?? 0;
  if (options.statusLabel) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const statusLines = doc.splitTextToSize(options.statusLabel, valX - summaryX);
    doc.text(statusLines, summaryX, y);
    y += statusLines.length * 4.5 + 1.5;
  } else if (outstanding > 0) {
    y += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(220, 38, 38); // Red for balance
    doc.text('Outstanding Balance:', summaryX, y);
    doc.text(formatCurrency(outstanding), valX, y, { align: 'right' });
    y += 6;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(22, 163, 74); // Green for fully paid
    doc.text('Payment Status: FULLY PAID', summaryX, y);
    y += 6;
  }

  // Footer Note
  const footerY = Math.max(y + 12, 275);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Thank you for choosing DCORE POS & INVENTORY!', pageWidth / 2, footerY, { align: 'center' });
  doc.text('This is a computer generated bill. No signature required.', pageWidth / 2, footerY + 4, { align: 'center' });

  // Save/Download purely client-side
  doc.save(options.filename || `Bill-${sale.invoiceId || sale.id}.pdf`);
};

/**
 * Triggers browser print preview directly with a clean, styled thermal / A4 receipt template.
 * Operates purely in-memory using an iframe, no files saved on disk.
 */
export const printBill = (sale: SaleDto): void => {
  const totalDiscount = sale.discountAmount || 0;
  const grossTotal = sale.totalAmount || (sale.finalAmount + totalDiscount);
  const netAmount = sale.finalAmount ?? (grossTotal - totalDiscount);
  const outstanding = sale.outstandingBalance ?? 0;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Bill - ${sale.invoiceId || sale.id}</title>
        <style>
          @page {
            margin: 8mm;
            size: auto;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 10px;
            font-size: 13px;
            line-height: 1.4;
          }
          .bill-container {
            max-width: 600px;
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .text-muted { color: #64748b; }
          .text-danger { color: #dc2626; }
          .text-success { color: #16a34a; }
          .header {
            text-align: center;
            border-bottom: 2px dashed #cbd5e1;
            padding-bottom: 12px;
            margin-bottom: 12px;
          }
          .title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.5px;
            margin: 0;
          }
          .subtitle {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
          }
          .meta-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 12px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
          }
          .items-table th {
            border-top: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
            padding: 6px 4px;
            background: #f8fafc;
            font-size: 11px;
            text-transform: uppercase;
          }
          .items-table td {
            padding: 6px 4px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 12px;
          }
          .summary-section {
            border-top: 1px dashed #cbd5e1;
            padding-top: 8px;
            margin-top: 8px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
          }
          .total-highlight {
            font-size: 15px;
            font-weight: bold;
            border-top: 1px solid #0f172a;
            border-bottom: 1px solid #0f172a;
            padding: 6px 0;
            margin: 6px 0;
          }
          .footer {
            margin-top: 20px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 10px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="bill-container">
          <div class="header">
            <h1 class="title">DCORE POS & INVENTORY</h1>
            <div class="subtitle">SALES BILL / CASH RECEIPT</div>
          </div>

          <div class="meta-grid">
            <div>
              <div><strong>Invoice:</strong> ${sale.invoiceId || `#INV-${sale.id}`}</div>
              <div><strong>Date:</strong> ${formatDate(sale.createdAt)}</div>
              ${sale.sellerName ? `<div><strong>Cashier:</strong> ${sale.sellerName}</div>` : ''}
              ${sale.isInternal ? `<div class="text-danger"><strong>Internal:</strong> ${sale.internalReason || 'Yes'}</div>` : ''}
            </div>
            <div style="text-align: right;">
              <div><strong>Customer:</strong> ${sale.customerName || 'Walk-in Customer'}</div>
              ${sale.customerMobile ? `<div><strong>Mobile:</strong> ${sale.customerMobile}</div>` : ''}
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: left;">Item</th>
                <th style="text-align: right;">Unit (Rs.)</th>
                <th style="text-align: right;">Disc (Rs.)</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Subtotal (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              ${(sale.items || []).map(item => {
                const disc = item.discountAmount || 0;
                const sub = item.subtotal ?? (item.unitPrice * item.quantity - disc);
                return `
                  <tr>
                    <td>
                      <div>${item.productName}</div>
                      ${item.productCode ? `<div class="text-muted" style="font-size: 10px;">Code: ${item.productCode}</div>` : ''}
                    </td>
                    <td class="text-right">${item.unitPrice.toFixed(2)}</td>
                    <td class="text-right">${disc > 0 ? `-${disc.toFixed(2)}` : '0.00'}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td class="text-right font-bold">${sub.toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="summary-section">
            <div class="summary-row">
              <span class="text-muted">Subtotal (Gross):</span>
              <span>${formatCurrency(grossTotal)}</span>
            </div>
            ${totalDiscount > 0 ? `
              <div class="summary-row text-danger">
                <span>Total Discount${sale.discountReason ? ` (${sale.discountReason})` : ''}:</span>
                <span>-${formatCurrency(totalDiscount)}</span>
              </div>
            ` : ''}
            <div class="summary-row total-highlight">
              <span>Final Total:</span>
              <span>${formatCurrency(netAmount)}</span>
            </div>
            ${(sale.payments || []).map(p => `
              <div class="summary-row text-muted" style="font-size: 11px;">
                <span>Paid via ${p.paymentMethod || 'Payment'}:</span>
                <span>${formatCurrency(p.amount)}</span>
              </div>
            `).join('')}
            ${outstanding > 0 ? `
              <div class="summary-row text-danger font-bold" style="margin-top: 4px; font-size: 13px;">
                <span>Outstanding Balance:</span>
                <span>${formatCurrency(outstanding)}</span>
              </div>
            ` : `
              <div class="summary-row text-success font-bold" style="margin-top: 4px; font-size: 12px;">
                <span>Payment Status:</span>
                <span>FULLY PAID</span>
              </div>
            `}
          </div>

          <div class="footer">
            <p>Thank you for shopping with us!</p>
            <p style="font-size: 10px; margin-top: 2px;">Powered by DCORE POS</p>
          </div>
        </div>
      </body>
    </html>
  `;

  // Create an iframe to print cleanly without leaving open windows
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    // Fallback to new window if iframe is not accessible
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
    }
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 300);
};
