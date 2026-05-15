import { beforeEach, describe, expect, it } from 'vitest';
import { canAccessRoute, sanitizeAppDataForRole, type UserProfile } from './rbac';
import {
  makeEstimate,
  makeInvoice,
  installMemoryLocalStorage,
  makeJob,
  makeMaterial,
  makePayment,
  makeTask,
  makeWorker,
  seedLocalAppData,
} from '../test/factories';

describe('rbac', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('redacts financial collections and cost fields for non-owner roles', () => {
    const data = seedLocalAppData({
      workers: [makeWorker({ hourlyRate: 42, flatRate: 500 })],
      laborRates: [{ id: 'labor-rate-1', name: 'Lead', trade: 'carpentry', hourlyRate: 80, isActive: true }],
      jobs: [makeJob({ contractAmount: 12000, estimatedCost: 8000, actualCost: 3000 })],
      estimates: [makeEstimate({ subtotal: 8000, markupPercent: 25, markupAmount: 2000, total: 10000, marginAmount: 2000, marginPercent: 20 })],
      materials: [makeMaterial({ basePrice: 10, currentPrice: 14, priceSource: 'manual', pricingVerified: true })],
      expenses: [{ id: 'expense-1', jobId: 'job-1', date: '2026-01-05', vendor: 'Vendor', amount: 100, category: 'materials', createdAt: '2026-01-05T00:00:00.000Z' }],
      invoices: [makeInvoice()],
      payments: [makePayment()],
    });

    const sanitized = sanitizeAppDataForRole(data, profile('admin'));

    expect(sanitized.invoices).toEqual([]);
    expect(sanitized.payments).toEqual([]);
    expect(sanitized.expenses).toEqual([]);
    expect(sanitized.laborRates).toEqual([]);
    expect(sanitized.workers[0].hourlyRate).toBeUndefined();
    expect(sanitized.workers[0].flatRate).toBeUndefined();
    expect(sanitized.jobs[0]).toMatchObject({ contractAmount: 0, estimatedCost: 0, actualCost: 0 });
    expect(sanitized.estimates[0]).toMatchObject({
      subtotal: 0,
      markupPercent: 0,
      markupAmount: 0,
      projectedLaborCost: 0,
      projectedMaterialCost: 0,
    });
    expect(sanitized.estimates[0].marginAmount).toBeUndefined();
    expect(sanitized.materials[0]).toMatchObject({ unitPrice: 15 });
    expect(sanitized.materials[0].basePrice).toBeUndefined();
    expect(sanitized.materials[0].currentPrice).toBeUndefined();
  });

  it('scopes crew data to assigned jobs before redacting financials', () => {
    const data = seedLocalAppData({
      workers: [makeWorker({ id: 'worker-1', email: 'crew@example.com' })],
      jobs: [
        makeJob({ id: 'job-assigned', contractAmount: 1000 }),
        makeJob({ id: 'job-hidden', contractAmount: 2000 }),
      ],
      tasks: [
        makeTask({ id: 'task-assigned', jobId: 'job-assigned', assignedTo: 'worker-1' }),
        makeTask({ id: 'task-hidden', jobId: 'job-hidden', assignedTo: 'worker-2' }),
      ],
      customers: [{ id: 'customer-1', name: 'Owner', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
      estimates: [makeEstimate()],
      materials: [makeMaterial()],
    });

    const sanitized = sanitizeAppDataForRole(data, profile('crew', { email: 'crew@example.com', worker_id: 'worker-1' }));

    expect(sanitized.jobs).toHaveLength(1);
    expect(sanitized.jobs[0]).toMatchObject({ id: 'job-assigned', contractAmount: 0 });
    expect(sanitized.tasks).toHaveLength(1);
    expect(sanitized.customers).toEqual([]);
    expect(sanitized.estimates).toEqual([]);
    expect(sanitized.materials).toEqual([]);
  });

  it('blocks owner-only routes for non-owner roles', () => {
    expect(canAccessRoute('admin', '/invoices')).toBe(false);
    expect(canAccessRoute('owner', '/invoices')).toBe(true);
    expect(canAccessRoute('crew', '/jobs/job-1')).toBe(true);
  });
});

function profile(role: UserProfile['role'], overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'profile-1',
    user_id: 'user-1',
    role,
    active: true,
    ...overrides,
  };
}
