import type { Payment } from '../../data/types';
import { createCollectionService } from './baseService';
import { getStorageMode, type StorageMode } from './config';
import { TABLES } from './tables';

const base = createCollectionService<Payment>('payments', TABLES.payments);

const normalizePayment = (payment: Payment): Payment => ({
  ...payment,
  date: payment.date || payment.paymentDate || new Date().toISOString().split('T')[0],
  paymentDate: payment.paymentDate || payment.date,
  method: payment.method || 'other',
  createdAt: payment.createdAt || new Date().toISOString(),
  updatedAt: payment.updatedAt || payment.createdAt || new Date().toISOString(),
});

export const paymentsService = {
  ...base,

  async getAll(mode: StorageMode = getStorageMode()): Promise<Payment[]> {
    const payments = await base.getAll(mode);
    return payments.map(normalizePayment);
  },

  async getById(id: string, mode: StorageMode = getStorageMode()): Promise<Payment | null> {
    const payment = await base.getById(id, mode);
    return payment ? normalizePayment(payment) : null;
  },

  async getByJobId(jobId: string, mode: StorageMode = getStorageMode()): Promise<Payment[]> {
    const payments = await this.getAll(mode);
    return payments.filter(payment => payment.jobId === jobId);
  },

  async getByInvoiceId(invoiceId: string, mode: StorageMode = getStorageMode()): Promise<Payment[]> {
    const payments = await this.getAll(mode);
    return payments.filter(payment => payment.invoiceId === invoiceId);
  },

  async create(payment: Payment, mode: StorageMode = getStorageMode()): Promise<Payment> {
    return base.create(normalizePayment(payment), mode);
  },

  async update(id: string, updates: Partial<Payment>, mode: StorageMode = getStorageMode()): Promise<Payment | null> {
    const existing = await base.getById(id, mode);
    return existing ? base.update(id, normalizePayment({ ...existing, ...updates }), mode) : null;
  },
};
