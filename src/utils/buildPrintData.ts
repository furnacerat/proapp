import { Invoice, Payment, Job, BrandingSettings } from '../data/types'
import { PrintInvoiceData, PrintBranding, PrintAddress, PrintLineItem, PrintSettings, DEFAULT_PRINT_SETTINGS } from '../data/printTypes'

const parseAddress = (address?: string): PrintAddress | undefined => {
  if (!address) return undefined
  const parts = address.split(',').map(p => p.trim())
  return {
    line1: parts[0] || '',
    line2: parts[1],
    city: parts[2],
    state: parts[3],
    zip: parts[4],
  }
}

const buildBranding = (branding?: BrandingSettings): PrintBranding => ({
  brandName: branding?.brandName || 'Allens Hub',
  emailFromAddress: branding?.emailFromAddress,
  phone: (branding as any)?.phone,
  primaryColor: branding?.primaryColor,
  fontFamily: branding?.fontFamily,
  logoDataUrl: branding?.logoDataUrl,
  logoUrl: branding?.logoUrl,
  termsText: branding?.termsText,
  paymentTerms: (branding as any)?.paymentTerms,
  signature: branding?.signature,
})

export const buildClientInvoiceData = (
  invoice: Invoice,
  job: Job | undefined,
  payments: Payment[],
  branding?: BrandingSettings,
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS
): PrintInvoiceData => {
  const brand = buildBranding(branding)
  const lineItems: PrintLineItem[] = [
    {
      description: 'Contract Amount',
      quantity: 1,
      unit: 'LS',
      unitPrice: invoice.amount,
      total: invoice.amount,
    }
  ]

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

  return {
    type: 'invoice',
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.createdAt,
    dueDate: invoice.dueDate,
    status: invoice.status,
    company: brand,
    client: {
      name: job?.customer || 'Customer',
      address: job?.address ? parseAddress(job.address) : undefined,
      email: job?.customerEmail,
      phone: job?.customerPhone,
    },
    project: job ? {
      name: job.name,
      address: job.address ? parseAddress(job.address) : undefined,
    } : undefined,
    lineItems: settings.hideZeroValueLines 
      ? lineItems.filter(item => item.total !== 0)
      : lineItems,
    subtotal: invoice.amount,
    total: invoice.amount,
    payments: payments.map(p => ({
      date: p.date,
      amount: p.amount,
      method: p.method,
    })),
    balanceDue: invoice.amount - totalPaid,
    notes: settings.showNotes ? invoice.notes : undefined,
    paymentTerms: settings.showPaymentTerms ? brand.paymentTerms || brand.termsText : undefined,
  }
}
