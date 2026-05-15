import { beforeEach, describe, expect, it } from 'vitest';
import { invoicesService } from './invoicesService';
import { installMemoryLocalStorage, makeInvoice, readLocalAppData, seedLocalAppData } from '../../test/factories';

describe('invoicesService', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    seedLocalAppData();
  });

  it('records a partial payment and updates invoice paid amount, balance, and status', async () => {
    seedLocalAppData({
      invoices: [makeInvoice({ id: 'invoice-1', amount: 1000, total: 1000, paidAmount: 0, balanceDue: 1000 })],
    });

    const result = await invoicesService.recordPayment('invoice-1', {
      id: 'payment-1',
      invoiceId: 'invoice-1',
      amount: 400,
      date: '2026-01-15',
      createdAt: '2026-01-15T00:00:00.000Z',
    }, 'local');

    expect(result.invoice).toMatchObject({
      paidAmount: 400,
      balanceDue: 600,
      status: 'partially_paid',
    });
    expect(result.payment).toMatchObject({
      invoiceId: 'invoice-1',
      amount: 400,
      method: 'other',
      paymentDate: '2026-01-15',
    });
    expect(readLocalAppData().invoices[0]).toMatchObject({
      paidAmount: 400,
      balanceDue: 600,
      status: 'partially_paid',
    });
  });

  it('marks an invoice paid when cumulative payments meet the total', async () => {
    seedLocalAppData({
      invoices: [makeInvoice({ id: 'invoice-1', amount: 1000, total: 1000, paidAmount: 400, balanceDue: 600 })],
      payments: [{
        id: 'payment-existing',
        invoiceId: 'invoice-1',
        amount: 400,
        date: '2026-01-10',
        createdAt: '2026-01-10T00:00:00.000Z',
      }],
    });

    const result = await invoicesService.recordPayment('invoice-1', {
      id: 'payment-final',
      invoiceId: 'invoice-1',
      amount: 600,
      date: '2026-01-15',
      createdAt: '2026-01-15T00:00:00.000Z',
    }, 'local');

    expect(result.invoice).toMatchObject({
      paidAmount: 1000,
      balanceDue: 0,
      status: 'paid',
    });
  });
});
