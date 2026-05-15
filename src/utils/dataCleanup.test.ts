import { describe, expect, it } from 'vitest';
import type { AppData } from '../data/types';
import { makeCustomer, makeExpense, makeInvoice, makeJob, makePayment, makeTask } from '../test/factories';
import { applySmartDataCleanup, getSmartDataCleanupReport } from './dataCleanup';

const makeData = (overrides: Partial<AppData> = {}): AppData => ({
  customers: [],
  workers: [],
  laborRates: [],
  materials: [],
  assemblies: [],
  templates: [],
  projectTypeTemplates: [],
  estimates: [],
  jobTemplates: [],
  jobs: [],
  timeEntries: [],
  expenses: [],
  companyExpenses: [],
  tasks: [],
  invoices: [],
  payments: [],
  notes: [],
  photos: [],
  changeOrders: [],
  alerts: [],
  timeline: [],
  jobLogs: [],
  punchLists: [],
  jobIssues: [],
  fileAttachments: [],
  suppliers: [],
  materialOrders: [],
  shoppingLists: [],
  receipts: [],
  allowances: [],
  ...overrides,
});

describe('smart data cleanup', () => {
  it('finds and safely applies exact customer links and invoice balance cleanup', () => {
    const data = makeData({
      customers: [makeCustomer({ id: 'customer-1', name: 'Jane Client', email: 'jane@example.com', phone: '555-1010' })],
      jobs: [makeJob({ id: 'job-1', customerId: undefined, customer: 'Jane Client', customerEmail: '', customerPhone: '' })],
      invoices: [makeInvoice({ id: 'invoice-1', jobId: 'job-1', amount: 1000, total: 1000, paidAmount: 0, balanceDue: 1000, status: 'sent', dueDate: '2026-02-01' })],
      payments: [makePayment({ id: 'payment-1', invoiceId: 'invoice-1', amount: 400 })],
    });

    const report = getSmartDataCleanupReport(data, new Date('2026-02-15T12:00:00.000Z'));

    expect(report.suggestions.map(item => item.id)).toEqual(expect.arrayContaining([
      'link-job-customers',
      'normalize-invoice-balances',
    ]));

    const result = applySmartDataCleanup(data, ['link-job-customers', 'normalize-invoice-balances'], new Date('2026-02-15T12:00:00.000Z'));

    expect(result.applied).toBe(2);
    expect(result.data.jobs[0]).toMatchObject({
      customerId: 'customer-1',
      customerEmail: 'jane@example.com',
      customerPhone: '555-1010',
    });
    expect(result.data.invoices[0]).toMatchObject({
      paidAmount: 400,
      balanceDue: 600,
      status: 'partial',
    });
  });

  it('flags risky records for review instead of auto-deleting them', () => {
    const data = makeData({
      customers: [
        makeCustomer({ id: 'customer-1', email: 'same@example.com' }),
        makeCustomer({ id: 'customer-2', email: 'same@example.com' }),
      ],
      jobs: [makeJob({ id: 'job-1' })],
      expenses: [makeExpense({ id: 'expense-orphan', jobId: 'missing-job' })],
      tasks: [makeTask({ id: 'task-open', jobId: 'job-1', status: 'open' })],
      invoices: [makeInvoice({ id: 'invoice-1', jobId: 'job-1', status: 'paid' })],
      payments: [makePayment({ id: 'payment-orphan', invoiceId: 'missing-invoice' })],
    });

    const report = getSmartDataCleanupReport(data, new Date('2026-02-15T12:00:00.000Z'));
    const riskyIds = ['duplicate-customers', 'orphan-payments', 'orphan-job-records'];

    expect(report.suggestions.map(item => item.id)).toEqual(expect.arrayContaining(riskyIds));
    riskyIds.forEach(id => {
      expect(report.suggestions.find(item => item.id === id)?.autoFixAvailable).toBe(false);
    });
  });
});
