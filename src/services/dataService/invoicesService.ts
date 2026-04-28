import type { Invoice, InvoiceItem, Payment } from '../../data/types';
import { supabase } from '../../lib/supabase';
import { createCollectionService, fromSupabaseRows, getLocalAppData, upsertSupabaseRecords } from './baseService';
import { getStorageMode, type StorageMode } from './config';
import { jobsService } from './jobsService';
import { estimatesService } from './estimatesService';
import { paymentsService } from './paymentsService';
import { TABLES } from './tables';

const base = createCollectionService<Invoice>('invoices', TABLES.invoices);
const now = () => new Date().toISOString();

const normalizeInvoice = (invoice: Invoice): Invoice => {
  const subtotal = Number(invoice.subtotal ?? invoice.amount ?? 0);
  const tax = Number(invoice.tax ?? 0);
  const total = Number(invoice.total ?? invoice.amount ?? subtotal + tax);
  const paidAmount = Number(invoice.paidAmount ?? 0);
  const balanceDue = Number(invoice.balanceDue ?? Math.max(total - paidAmount, 0));
  return {
    ...invoice,
    amount: Number(invoice.amount ?? total),
    subtotal,
    tax,
    total,
    paidAmount,
    balanceDue,
    status: invoice.status || 'draft',
    createdAt: invoice.createdAt || now(),
    updatedAt: invoice.updatedAt || invoice.createdAt || now(),
  };
};

const normalizeInvoiceItem = (item: Partial<InvoiceItem> & { id?: string; invoiceId: string }): InvoiceItem => ({
  id: item.id || crypto.randomUUID(),
  invoiceId: item.invoiceId,
  name: item.name || 'Invoice item',
  description: item.description,
  quantity: Number(item.quantity ?? 1),
  unit: item.unit || 'ea',
  unitPrice: Number(item.unitPrice ?? item.total ?? 0),
  total: Number(item.total ?? (Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0))),
  sourceType: item.sourceType,
  sourceId: item.sourceId,
  createdAt: item.createdAt || now(),
  updatedAt: item.updatedAt || item.createdAt || now(),
});

const summaryItemFromInvoice = (invoice: Invoice): InvoiceItem => normalizeInvoiceItem({
  id: `${invoice.id}-summary`,
  invoiceId: invoice.id,
  name: invoice.invoiceNumber || 'Invoice total',
  description: invoice.notes,
  quantity: 1,
  unit: 'ea',
  unitPrice: invoice.total ?? invoice.amount,
  total: invoice.total ?? invoice.amount,
  sourceType: 'invoice',
  sourceId: invoice.id,
  createdAt: invoice.createdAt,
  updatedAt: invoice.updatedAt,
});

const statusFromBalance = (invoice: Invoice, paidAmount: number): Invoice['status'] => {
  const total = invoice.total ?? invoice.amount ?? 0;
  if (paidAmount >= total && total > 0) return 'paid';
  if (paidAmount > 0) return 'partially_paid';
  return invoice.status === 'overdue' ? 'overdue' : 'sent';
};

export const invoicesService = {
  ...base,

  async getAll(mode: StorageMode = getStorageMode()): Promise<Invoice[]> {
    const invoices = await base.getAll(mode);
    return invoices.map(normalizeInvoice);
  },

  async getById(id: string, mode: StorageMode = getStorageMode()): Promise<Invoice | null> {
    const invoice = await base.getById(id, mode);
    return invoice ? normalizeInvoice(invoice) : null;
  },

  async getByJobId(jobId: string, mode: StorageMode = getStorageMode()): Promise<Invoice[]> {
    const invoices = await this.getAll(mode);
    return invoices.filter(invoice => invoice.jobId === jobId);
  },

  async create(invoice: Invoice, mode: StorageMode = getStorageMode()): Promise<Invoice> {
    return base.create(normalizeInvoice(invoice), mode);
  },

  async update(id: string, updates: Partial<Invoice>, mode: StorageMode = getStorageMode()): Promise<Invoice | null> {
    const existing = await base.getById(id, mode);
    return existing ? base.update(id, normalizeInvoice({ ...existing, ...updates }), mode) : null;
  },

  async getItems(invoiceId: string, mode: StorageMode = getStorageMode()): Promise<InvoiceItem[]> {
    if (mode === 'supabase' && supabase) {
      const { data, error } = await supabase.from(TABLES.invoiceItems).select('id,payload').eq('invoice_id', invoiceId).order('created_at');
      if (error) throw error;
      return fromSupabaseRows<InvoiceItem>(data).map(item => normalizeInvoiceItem({ ...item, invoiceId }));
    }

    const invoice = getLocalAppData()?.invoices.find(item => item.id === invoiceId);
    return invoice ? [summaryItemFromInvoice(normalizeInvoice(invoice))] : [];
  },

  async createWithItems(invoiceData: Invoice, items: Partial<InvoiceItem>[], mode: StorageMode = getStorageMode()): Promise<Invoice> {
    const invoice = await this.create(invoiceData, mode);
    const invoiceItems = (items.length ? items : [summaryItemFromInvoice(invoice)]).map(item => normalizeInvoiceItem({ ...item, invoiceId: invoice.id }));
    if (mode === 'supabase') {
      await upsertSupabaseRecords(TABLES.invoiceItems, invoiceItems);
    }
    return invoice;
  },

  async updateWithItems(invoiceId: string, invoiceData: Partial<Invoice>, items: Partial<InvoiceItem>[], mode: StorageMode = getStorageMode()): Promise<Invoice | null> {
    const invoice = await this.update(invoiceId, invoiceData, mode);
    if (!invoice) return null;
    if (mode === 'supabase' && supabase) {
      await supabase.from(TABLES.invoiceItems).delete().eq('invoice_id', invoiceId);
      await upsertSupabaseRecords(TABLES.invoiceItems, items.map(item => normalizeInvoiceItem({ ...item, invoiceId })));
    }
    return invoice;
  },

  async recordPayment(invoiceId: string, paymentData: Payment, mode: StorageMode = getStorageMode()): Promise<{ invoice: Invoice | null; payment: Payment }> {
    const invoice = await this.getById(invoiceId, mode);
    const payment = await paymentsService.create(paymentData, mode);
    if (!invoice) return { invoice: null, payment };
    const payments = await paymentsService.getByInvoiceId(invoiceId, mode);
    const paidAmount = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const balanceDue = Math.max((invoice.total ?? invoice.amount ?? 0) - paidAmount, 0);
    const updated = await this.update(invoiceId, {
      paidAmount,
      balanceDue,
      status: statusFromBalance(invoice, paidAmount),
    }, mode);
    return { invoice: updated, payment };
  },

  async generateFromJob(jobId: string, options: Partial<Invoice> = {}, mode: StorageMode = getStorageMode()): Promise<Invoice | null> {
    const job = await jobsService.getById(jobId, mode);
    if (!job) return null;
    const createdAt = now();
    return this.createWithItems({
      id: crypto.randomUUID(),
      invoiceNumber: options.invoiceNumber || `INV-${Date.now()}`,
      customerId: options.customerId || job.customerId,
      estimateId: options.estimateId || job.estimateId,
      jobId,
      amount: options.amount ?? job.contractAmount,
      type: options.type || 'progress',
      dueDate: options.dueDate || createdAt.split('T')[0],
      status: options.status || 'draft',
      notes: options.notes,
      createdAt,
      updatedAt: createdAt,
    }, [], mode);
  },

  async generateFromEstimate(estimateId: string, options: Partial<Invoice> = {}, mode: StorageMode = getStorageMode()): Promise<Invoice | null> {
    const estimate = await estimatesService.getById(estimateId, mode);
    if (!estimate) return null;
    const createdAt = now();
    return this.createWithItems({
      id: crypto.randomUUID(),
      invoiceNumber: options.invoiceNumber || `INV-${Date.now()}`,
      customerId: options.customerId || estimate.customerId,
      estimateId,
      jobId: options.jobId || '',
      amount: options.amount ?? estimate.total,
      type: options.type || 'deposit',
      dueDate: options.dueDate || createdAt.split('T')[0],
      status: options.status || 'draft',
      notes: options.notes,
      createdAt,
      updatedAt: createdAt,
    }, [], mode);
  },
};
