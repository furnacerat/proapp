import { Job, Customer, Invoice, Payment, Estimate, EstimateLineItem } from './types'

export interface PrintBranding {
  brandName: string
  emailFromAddress?: string
  phone?: string
  primaryColor?: string
  fontFamily?: string
  logoDataUrl?: string
  logoUrl?: string
  termsText?: string
  paymentTerms?: string
  signature?: string
}

export interface PrintAddress {
  line1: string
  line2?: string
  city?: string
  state?: string
  zip?: string
}

export interface PrintLineItem {
  description: string
  detail?: string
  quantity: number
  unit?: string
  unitPrice: number
  total: number
}

export interface PrintInvoiceData {
  type: 'invoice'
  invoiceNumber: string
  issueDate: string
  dueDate?: string
  status: string
  company: PrintBranding
  client: {
    name: string
    address?: PrintAddress
    email?: string
    phone?: string
  }
  project?: {
    name: string
    address?: PrintAddress
  }
  lineItems: PrintLineItem[]
  subtotal: number
  tax?: number
  discount?: number
  total: number
  payments?: { date: string; amount: number; method: string }[]
  balanceDue?: number
  notes?: string
  paymentTerms?: string
}

export interface PrintEstimateData {
  type: 'estimate'
  estimateNumber: string
  issueDate: string
  validUntil?: string
  status: string
  company: PrintBranding
  client: {
    name: string
    address?: PrintAddress
    email?: string
    phone?: string
  }
  project?: {
    name: string
    address?: PrintAddress
  }
  lineItems: PrintLineItem[]
  subtotal: number
  tax?: number
  discount?: number
  total: number
  notes?: string
  terms?: string
}

export interface PrintSettings {
  showLogo: boolean
  showPaymentTerms: boolean
  showTaxBreakdown: boolean
  showNotes: boolean
  showSignatureLine: boolean
  showItemDescriptions: boolean
  hideZeroValueLines: boolean
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  showLogo: true,
  showPaymentTerms: true,
  showTaxBreakdown: false,
  showNotes: true,
  showSignatureLine: false,
  showItemDescriptions: true,
  hideZeroValueLines: false,
}

export type PrintDocumentType = 'invoice' | 'estimate' | 'proposal' | 'changeorder' | 'workorder' | 'receipt'
export type PrintAudience = 'client' | 'internal' | 'vendor' | 'subcontractor'

export interface PrintDocumentData {
  documentType: PrintDocumentType
  audience: PrintAudience
  data: PrintInvoiceData | PrintEstimateData
  settings: PrintSettings
}