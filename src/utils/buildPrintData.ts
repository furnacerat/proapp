/**
 * buildPrintData.ts
 *
 * SANITIZATION LAYER — Client-facing print document data builders.
 *
 * SECURITY PRINCIPLE: Explicit whitelist only.
 * These functions NEVER expose:
 *   - internal cost / labor cost / material cost / supplier cost
 *   - profit / profit margin / markup percent / markup amount
 *   - labor burden / overhead
 *   - admin notes / internal notes
 *   - private flags (isOptional, isExcluded, category breakdowns)
 *   - labor hours / labor rate IDs
 *   - any internal IDs or metadata
 *
 * Adding a new internal field to Invoice/Estimate will NEVER accidentally
 * appear on client documents because these functions whitelist — not blacklist.
 */

import type { Invoice, Payment, Job, BrandingSettings, Estimate, Customer } from '../data/types'
import { calculateTax } from './tax'
import type {
  PrintInvoiceData,
  PrintEstimateData,
  PrintBranding,
  PrintAddress,
  PrintLineItem,
  PrintSettings,
} from '../data/printTypes'
import { DEFAULT_PRINT_SETTINGS } from '../data/printTypes'

// ─── Address Parser ───────────────────────────────────────────────────────────

const parseAddress = (address?: string): PrintAddress | undefined => {
  if (!address) return undefined
  // Support both comma-separated and multi-line formats
  const parts = address.split(/,|\n/).map(p => p.trim()).filter(Boolean)
  return {
    line1: parts[0] || '',
    line2: parts.length > 4 ? parts[1] : undefined,
    city: parts.length === 5 ? parts[2] : parts.length > 1 ? parts[1] : undefined,
    state: parts.length === 5 ? parts[3] : parts.length > 2 ? parts[2] : undefined,
    zip: parts.length === 5 ? parts[4] : parts.length > 3 ? parts[3] : undefined,
  }
}

// ─── Branding Builder ─────────────────────────────────────────────────────────
// Only maps client-visible branding fields — no internal email templates, etc.

const buildBranding = (branding?: BrandingSettings): PrintBranding => ({
  brandName: branding?.brandName || 'Your Company',
  emailFromAddress: branding?.emailFromAddress,
  phone: branding?.phone,
  address: branding?.address,
  website: branding?.website,
  primaryColor: branding?.primaryColor,
  fontFamily: branding?.fontFamily,
  logoDataUrl: branding?.logoDataUrl,
  logoUrl: branding?.logoUrl,
  termsText: branding?.termsText,
  paymentTerms: (branding as any)?.paymentTerms,
  signature: branding?.signature,
})

// ─── Client Invoice Print Data ────────────────────────────────────────────────

/**
 * Builds a sanitized, client-facing invoice payload.
 * Uses explicit field whitelisting — internal cost/profit never included.
 */
export const buildClientInvoiceData = (
  invoice: Invoice,
  job: Job | undefined,
  payments: Payment[],
  branding?: BrandingSettings,
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS,
): PrintInvoiceData => {
  const company = buildBranding(branding)

  // WHITELISTED client line items only: no cost, no margin, no internal IDs
  const lineItems: PrintLineItem[] = [
    {
      description: job?.name ? `${invoice.type === 'deposit' ? 'Deposit — ' : invoice.type === 'progress' ? 'Progress Payment — ' : invoice.type === 'final' ? 'Final Payment — ' : ''}${job.name}` : 'Contract Amount',
      quantity: 1,
      unit: 'LS',
      unitPrice: invoice.subtotal ?? invoice.amount,
      total: invoice.subtotal ?? invoice.amount,
    },
  ]

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const subtotal = invoice.subtotal ?? Math.max(invoice.amount - (invoice.tax ?? 0), 0)
  const tax = invoice.tax
  const total = invoice.total ?? invoice.amount
  const balanceDue = (invoice.balanceDue ?? total) - totalPaid

  return {
    type: 'invoice',
    // WHITELISTED document metadata
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.createdAt,
    dueDate: invoice.dueDate || undefined,
    status: invoice.status,
    // WHITELISTED company info (client-visible branding only)
    company,
    // WHITELISTED client info
    client: {
      name: job?.customer || 'Customer',
      address: job?.address ? parseAddress(job.address) : undefined,
      email: job?.customerEmail,
      phone: job?.customerPhone,
    },
    // WHITELISTED project info
    project: job
      ? {
          name: job.name,
          address: job.address ? parseAddress(job.address) : undefined,
        }
      : undefined,
    // WHITELISTED line items
    lineItems,
    // WHITELISTED financials (client totals only — no cost/profit)
    subtotal,
    tax,
    total,
    payments: payments.map(p => ({
      date: p.date,
      amount: p.amount,
      method: p.method || 'N/A',
    })),
    balanceDue,
    // WHITELISTED optional client-visible fields
    notes: invoice.notes,
    paymentTerms: company.paymentTerms || company.termsText,
  }
}

// ─── Client Estimate Print Data ───────────────────────────────────────────────

/**
 * Builds a sanitized, client-facing estimate payload.
 * Uses explicit field whitelisting — markupPercent, laborTotal, materialCost,
 * marginPercent, hours, category breakdowns, and all internal flags are NEVER included.
 */
export const buildClientEstimatePrintData = (
  estimate: Estimate,
  customer: Customer | undefined,
  branding?: BrandingSettings,
  settings: PrintSettings = DEFAULT_PRINT_SETTINGS,
): PrintEstimateData => {
  const company = buildBranding(branding)

  // Walk scopes → sections → lineItems, projecting ONLY client-safe fields
  const lineItems: PrintLineItem[] = []

  const allScopes = estimate.scopes ?? []
  const legacySections = estimate.sections ?? []

  // Process scoped estimates (the primary structure)
  allScopes.forEach(scope => {
    scope.sections?.forEach(section => {
      section.lineItems?.forEach(item => {
        // Skip excluded items — client should not see them
        if (item.isExcluded) return

        // WHITELIST: only client-visible line item fields
        const printItem: PrintLineItem = {
          description: item.name,                          // ✅ visible
          detail: settings.showItemDescriptions            // ✅ visible if enabled
            ? item.description
            : undefined,
          quantity: item.quantity || 0,                     // ✅ visible
          unit: item.unit,                                 // ✅ visible
          unitPrice: item.unitPrice,                       // ✅ visible (post-markup price)
          total: item.total,                               // ✅ visible (post-markup total)
          // ❌ NOT INCLUDED: item.materialCost, item.laborCost, item.equipmentCost,
          //    item.subcontractorCost, item.hours, item.laborRateId, item.category,
          //    item.isLabor, item.isOptional, item.isAllowance, item.notes (internal),
          //    item.sortOrder, item.id
        }

        if (settings.hideZeroValueLines && item.total === 0) return
        lineItems.push(printItem)
      })
    })
  })

  // Process legacy flat-section estimates
  legacySections.forEach(section => {
    section.lineItems?.forEach(item => {
      if (item.isExcluded) return

      const printItem: PrintLineItem = {
        description: item.name,
        detail: settings.showItemDescriptions ? item.description : undefined,
        quantity: item.quantity || 0,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
      }

      if (settings.hideZeroValueLines && item.total === 0) return
      lineItems.push(printItem)
    })
  })

  // WHITELISTED financial totals — apply markup or target margin to get client-facing totals
  // We compute from first principles so we never expose intermediate cost breakdowns
  const rawSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const pricingMode = estimate.pricingMode || 'markup'
  const pricingPercent = estimate.markupPercent ?? 0
  const subtotal = rawSubtotal
  const total = pricingMode === 'margin'
    ? rawSubtotal / (1 - Math.min(Math.max(pricingPercent, 0), 99.9) / 100)
    : rawSubtotal * (1 + pricingPercent / 100)
  const markupAmount = total - rawSubtotal

  const tax = calculateTax(total, estimate.taxable, estimate.taxRate ?? branding?.defaultTaxRate)
  const finalTotal = total + tax

  return {
    type: 'estimate',
    // WHITELISTED document metadata
    estimateNumber: estimate.estimateNumber,
    issueDate: estimate.createdAt,
    validUntil: estimate.validUntil || undefined,
    status: estimate.status,
    // WHITELISTED company info
    company,
    // WHITELISTED client info
    client: {
      name: customer?.name || 'Customer',
      address: customer?.address ? parseAddress(customer.address) : undefined,
      email: customer?.email,
      phone: customer?.phone,
    },
    // WHITELISTED project info
    project: {
      name: estimate.name,
      address: estimate.address ? parseAddress(estimate.address) : undefined,
    },
    // WHITELISTED line items (sanitized above)
    lineItems,
    // WHITELISTED financial totals (client-facing only)
    subtotal,
    total: finalTotal,
    tax: tax || undefined,
    // WHITELISTED optional client-visible fields
    notes: settings.showNotes ? estimate.notes : undefined,
    terms: settings.showPaymentTerms
      ? company.paymentTerms || company.termsText
      : undefined,
    // ❌ NOT INCLUDED: estimate.markupPercent, estimate.markupAmount,
    //    estimate.laborTotal, estimate.materialTotal, estimate.equipmentTotal,
    //    estimate.subcontractorTotal, estimate.projectedLaborHours,
    //    estimate.projectedMaterialCost, estimate.projectedLaborCost,
    //    estimate.marginPercent, estimate.marginAmount, estimate.taxable,
    //    estimate.convertedToJobId, estimate.archivedAt, estimate.id
  }
}
