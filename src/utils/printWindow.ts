import { BrandingSettings } from '../data/types'

export const openPrintWindow = (
  title: string,
  content: string,
  branding?: BrandingSettings
): void => {
  let printWindow: Window | null = null
  try {
    printWindow = window.open('', '_blank', 'width=800,height=600')
  } catch (e) {
    console.error('Popup blocked:', e)
  }
  if (!printWindow) {
    alert('Please allow pop-ups to print documents')
    return
  }

  const brandName = branding?.brandName || ''
  const primaryColor = branding?.primaryColor || '#1a1a1a'
  const fontFamily = branding?.fontFamily || 'ui-sans-serif, system-ui, Arial, sans-serif'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${fontFamily};
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a1a;
      padding: 40px;
    }
    @media print {
      body { padding: 0; }
    }
    .invoice-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .invoice-header img {
      max-height: 60px;
      max-width: 200px;
      margin-bottom: 16px;
    }
    .invoice-title {
      font-size: 28px;
      font-weight: 700;
      color: ${primaryColor};
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .invoice-number {
      font-size: 16px;
      color: #555;
      margin-top: 4px;
    }
    .section {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }
    .row {
      display: flex;
      justify-content: space-between;
    }
    .row > div {
      flex: 1;
    }
    .text-right {
      text-align: right;
    }
    .label {
      font-size: 11px;
      color: #777;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .value {
      font-size: 14px;
      font-weight: 600;
    }
    .value-lg {
      font-size: 18px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      text-align: left;
      padding: 8px 0;
      font-size: 11px;
      color: #777;
      text-transform: uppercase;
      border-bottom: 2px solid #333;
    }
    th.text-right {
      text-align: right;
    }
    td {
      padding: 12px 0;
      border-bottom: 1px solid #eee;
    }
    td.text-right {
      text-align: right;
    }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }
    .totals-box {
      width: 240px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .totals-row.total {
      border-bottom: 2px solid #333;
      font-size: 18px;
      font-weight: 700;
    }
    .totals-row.paid {
      color: #22c55e;
    }
    .terms {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #777;
    }
    .terms-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    .footer {
      margin-top: 32px;
      text-align: center;
      font-size: 11px;
      color: #999;
    }
  </style>
</head>
<body>
${content}
</body>
</html>
`

  printWindow.document.write(html)
  printWindow.document.close()

  setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 250)
}