import { describe, expect, it } from 'vitest';
import { makeInvoice, makeJob, makePayment, makeTimeEntry, makeWorker } from '../test/factories';
import { getCustomerAccountBalances, getOutstandingBalance, getWorkerOwed } from './calculations';

describe('calculations', () => {
  it('calculates flat-rate worker pay once per worked day', () => {
    const worker = makeWorker({ id: 'worker-flat', payType: 'flat', flatRate: 300, hourlyRate: undefined });
    const timeEntries = [
      makeTimeEntry({ id: 'morning', workerId: worker.id, date: '2026-03-01', startTime: '08:00', endTime: '12:00', totalHours: 4, laborCost: 120 }),
      makeTimeEntry({ id: 'afternoon', workerId: worker.id, date: '2026-03-01', startTime: '13:00', endTime: '17:00', totalHours: 4, laborCost: 120 }),
      makeTimeEntry({ id: 'next-day', workerId: worker.id, date: '2026-03-02', startTime: '08:00', endTime: '16:00', totalHours: 8, laborCost: 240 }),
    ];

    expect(getWorkerOwed(worker.id, [worker], timeEntries)).toBe(600);
  });

  it('keeps stored labor-cost totals for hourly worker pay', () => {
    const worker = makeWorker({ id: 'worker-hourly', payType: 'hourly', hourlyRate: 40 });
    const timeEntries = [
      makeTimeEntry({ id: 'regular', workerId: worker.id, totalHours: 8, laborCost: 320 }),
      makeTimeEntry({ id: 'overtime', workerId: worker.id, totalHours: 2, laborCost: 120 }),
    ];

    expect(getWorkerOwed(worker.id, [worker], timeEntries)).toBe(440);
  });

  it('tracks customer account credits from unapplied deposits', () => {
    const accounts = getCustomerAccountBalances(
      [makeInvoice({ id: 'invoice-1', customerId: 'customer-1', amount: 1000, total: 1000, status: 'sent' })],
      [
        makePayment({ id: 'payment-applied', invoiceId: 'invoice-1', customerId: 'customer-1', amount: 400 }),
        makePayment({ id: 'payment-deposit', invoiceId: 'deposit-before-invoice', customerId: 'customer-1', amount: 800 }),
      ]
    );

    expect(accounts['customer-1']).toMatchObject({
      invoiced: 1000,
      paid: 1200,
      balance: -200,
      credit: 200,
    });
  });

  it('includes customer-level unapplied payments in outstanding balance', () => {
    const invoices = [
      makeInvoice({ id: 'invoice-1', customerId: 'customer-1', amount: 1000, total: 1000, status: 'sent' }),
    ];
    const payments = [
      makePayment({ id: 'payment-applied', invoiceId: 'invoice-1', customerId: 'customer-1', amount: 300 }),
      makePayment({ id: 'payment-unapplied', invoiceId: 'deleted-invoice', customerId: 'customer-1', amount: 200 }),
    ];

    expect(getOutstandingBalance(invoices, payments)).toBe(500);
  });

  it('can infer customer account balances through jobs when invoice customer ids are missing', () => {
    const accounts = getCustomerAccountBalances(
      [makeInvoice({ id: 'invoice-1', customerId: undefined, jobId: 'job-1', amount: 1000, total: 1000, status: 'sent' })],
      [makePayment({ id: 'payment-1', invoiceId: 'invoice-1', customerId: undefined, jobId: 'job-1', amount: 250 })],
      [makeJob({ id: 'job-1', customerId: 'customer-1' })]
    );

    expect(accounts['customer-1']).toMatchObject({
      invoiced: 1000,
      paid: 250,
      balance: 750,
      credit: 0,
    });
  });
});
