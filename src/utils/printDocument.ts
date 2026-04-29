import { PrintInvoiceData, PrintSettings, DEFAULT_PRINT_SETTINGS } from '../data/printTypes'
import { formatDate } from './formatters'

const generateInvoiceHTML = (data: PrintInvoiceData, settings: PrintSettings): string => {
  const { company, client, project, lineItems, payments, balanceDue, notes, paymentTerms } = data

  const logoImg = settings.showLogo && company.logoDataUrl 
    ? `<img src="${company.logoDataUrl}" alt="${company.brandName}" style="max-height:60px;max-width:200px;margin-bottom:8px;" />` 
    : ''

  const lineItemsHTML = lineItems.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;">
        <div style="font-weight:500;">${item.description}</div>
        ${item.detail ? `<div style="font-size:11px;color:#777;margin-top:2px;">${item.detail}</div>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${item.unit || ''}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">$${item.unitPrice.toFixed(2)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:500;">$${item.total.toFixed(2)}</td>
    </tr>
  `).join('')

  const paymentsHTML = payments && payments.length > 0 ? `
    <div style="margin-top:24px;padding:12px;background:#f9f9f9;border-radius:4px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#777;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #ddd;">Payment History</div>
      <table style="width:100%;border-collapse:collapse;">
        ${payments.map(p => `
          <tr>
            <td style="padding:4px 8px;font-size:12px;">${p.date ? formatDate(p.date) : ''}</td>
            <td style="padding:4px 8px;font-size:12px;text-align:right;">$${p.amount.toFixed(2)}</td>
            <td style="padding:4px 8px;font-size:12px;text-align:right;color:#777;">${p.method}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  ` : ''

  const notesHTML = notes && settings.showNotes ? `
    <div style="margin-top:24px;padding:12px;background:#f9f9f9;border-radius:4px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#777;margin-bottom:4px;">Notes</div>
      <div style="font-size:12px;">${notes}</div>
    </div>
  ` : ''

  const termsHTML = paymentTerms && settings.showPaymentTerms ? `
    <div style="margin-top:24px;padding:12px;background:#f9f9f9;border-radius:4px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#777;margin-bottom:4px;">Payment Terms</div>
      <div style="font-size:12px;">${paymentTerms}</div>
    </div>
  ` : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${company.fontFamily || 'ui-sans-serif, system-ui, Arial, sans-serif'};
      font-size: 12px;
      line-height: 1.5;
      color: #1a1a1a;
      padding: 40px;
      background: #fff;
    }
    .invoice-header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #1a1a1a;
    }
    .company-name {
      font-size: 20px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .company-contact {
      font-size: 11px;
      color: #555;
      margin-top: 4px;
    }
    .invoice-title-section {
      text-align: center;
      margin-bottom: 24px;
    }
    .invoice-title {
      font-size: 28px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: ${company.primaryColor || '#1a1a1a'};
    }
    .invoice-number {
      font-size: 16px;
      color: #555;
      margin-top: 4px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 4px;
    }
    .meta-group { text-align: center; }
    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #777;
    }
    .meta-value {
      font-size: 14px;
      font-weight: 600;
    }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    .party {
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .party-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #777;
      margin-bottom: 4px;
    }
    .party-name {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .party-detail {
      font-size: 12px;
      color: #555;
    }
    .line-items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .line-items thead {
      background: #1a1a1a;
    }
    .line-items th {
      padding: 8px 12px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #fff;
      font-weight: 600;
    }
    .line-items th:last-child,
    .line-items td:last-child {
      text-align: right;
    }
    .totals {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      margin-bottom: 24px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      width: 200px;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .totals-row span:first-child {
      color: #777;
    }
    .totals-row span:last-child {
      font-weight: 600;
    }
    .totals-row.total {
      border-bottom: 2px solid #1a1a1a;
      font-size: 16px;
      font-weight: 700;
    }
    .totals-row.balance {
      border-top: 2px solid #1a1a1a;
      margin-top: 4px;
      padding-top: 8px;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #999;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="invoice-header">
    ${logoImg}
    <div class="company-name">${company.brandName}</div>
    ${company.emailFromAddress ? `<div class="company-contact">${company.emailFromAddress}</div>` : ''}
  </div>

  <!-- Title -->
  <div class="invoice-title-section">
    <div class="invoice-title">INVOICE</div>
    <div class="invoice-number">${data.invoiceNumber}</div>
  </div>

  <!-- Meta -->
  <div class="meta-grid">
    <div class="meta-group">
      <div class="meta-label">Date</div>
      <div class="meta-value">${data.issueDate ? new Date(data.issueDate).toLocaleDateString() : 'N/A'}</div>
    </div>
    ${data.dueDate ? `
    <div class="meta-group">
      <div class="meta-label">Due Date</div>
      <div class="meta-value">${formatDate(data.dueDate)}</div>
    </div>
    ` : ''}
    <div class="meta-group">
      <div class="meta-label">Status</div>
      <div class="meta-value">${data.status}</div>
    </div>
  </div>

  <!-- Parties -->
  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">${company.brandName}</div>
      ${company.emailFromAddress ? `<div class="party-detail">${company.emailFromAddress}</div>` : ''}
    </div>
    <div class="party">
      <div class="party-label">Bill To</div>
      <div class="party-name">${client.name}</div>
      ${client.address ? `<div class="party-detail">${client.address.line1}${client.address.line2 ? ', ' + client.address.line2 : ''}${client.address.city ? ', ' + client.address.city + ', ' + client.address.state + ' ' + client.address.zip : ''}</div>` : ''}
      ${client.email ? `<div class="party-detail">${client.email}</div>` : ''}
      ${client.phone ? `<div class="party-detail">${client.phone}</div>` : ''}
    </div>
  </div>

  ${project ? `
  <div class="party" style="margin-bottom:24px;">
    <div class="party-label">Project</div>
    <div class="party-name">${project.name}</div>
    ${project.address ? `<div class="party-detail">${project.address.line1}${project.address.line2 ? ', ' + project.address.line2 : ''}</div>` : ''}
  </div>
  ` : ''}

  <!-- Line Items -->
  <table class="line-items">
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right;">Qty</th>
        <th style="text-align:right;">Unit</th>
        <th style="text-align:right;">Price</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHTML}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-row">
      <span>Subtotal</span>
      <span>$${data.subtotal.toFixed(2)}</span>
    </div>
    <div class="totals-row total">
      <span>Total Due</span>
      <span>$${data.total.toFixed(2)}</span>
    </div>
    ${balanceDue !== undefined && balanceDue > 0 ? `
    <div class="totals-row balance">
      <span>Balance Due</span>
      <span>$${balanceDue.toFixed(2)}</span>
    </div>
    ` : ''}
  </div>

  <!-- Payment History -->
  ${paymentsHTML}

  <!-- Payment Terms -->
  ${termsHTML}

  <!-- Notes -->
  ${notesHTML}

  <!-- Footer -->
  <div class="footer">
    Thank you for your business!
  </div>
</body>
</html>
  `.trim()
}

export const printInvoice = (
  data: PrintInvoiceData,
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS
): void => {
  const html = generateInvoiceHTML(data, settings)
  
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) {
    alert('Please allow pop-ups to print')
    return
  }

  printWindow.document.write(html)
  printWindow.document.close()

  setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 250)
}
