import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jobsService } from './jobsService';
import { installMemoryLocalStorage, makeEstimate, readLocalAppData, seedLocalAppData } from '../../test/factories';

describe('jobsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T12:00:00.000Z'));
    installMemoryLocalStorage();
    seedLocalAppData();
  });

  it('converts an estimate into an active job and marks the estimate converted', async () => {
    seedLocalAppData({
      estimates: [makeEstimate({
        id: 'estimate-1',
        name: 'Bath Remodel',
        customerId: 'customer-1',
        address: '22 Oak Ave',
        type: 'remodel',
        subtotal: 8000,
        total: 10000,
        notes: 'Include allowance notes.',
      })],
    });

    const job = await jobsService.createFromEstimate('estimate-1', 'local');
    const stored = readLocalAppData();

    expect(job).toMatchObject({
      name: 'Bath Remodel',
      customerId: 'customer-1',
      address: '22 Oak Ave',
      type: 'remodel',
      contractAmount: 10000,
      estimatedCost: 8000,
      actualCost: 0,
      startDate: '2026-02-10',
      status: 'active',
      estimateId: 'estimate-1',
      notes: 'Include allowance notes.',
    });
    expect(stored.jobs).toHaveLength(1);
    expect(stored.jobs[0].id).toBe(job?.id);
    expect(stored.estimates[0]).toMatchObject({
      status: 'converted',
      convertedToJobId: job?.id,
    });
  });
});
