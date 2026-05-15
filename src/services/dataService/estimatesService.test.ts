import { beforeEach, describe, expect, it } from 'vitest';
import { estimatesService } from './estimatesService';
import { installMemoryLocalStorage, makeEstimate, makeEstimateItem, seedLocalAppData } from '../../test/factories';

describe('estimatesService', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    seedLocalAppData();
  });

  it('normalizes estimate subtotal, markup, total, and margin from line-item costs', async () => {
    const estimate = makeEstimate({
      subtotal: undefined,
      markupPercent: 10,
      markupAmount: undefined,
      total: undefined,
      marginAmount: undefined,
      marginPercent: undefined,
      sections: [{
        id: 'section-1',
        name: 'Scope',
        lineItems: [
          makeEstimateItem({
            id: 'labor-1',
            name: 'Carpentry',
            quantity: 2,
            unitCost: 100,
            unitPrice: 125,
            markupPercent: 25,
            costTotal: undefined,
            priceTotal: undefined,
            total: undefined,
            category: 'labor',
            type: 'labor',
            isLabor: true,
          }),
          makeEstimateItem({
            id: 'material-1',
            name: 'Trim',
            quantity: 1,
            unitCost: undefined,
            unitPrice: 50,
            costTotal: undefined,
            priceTotal: undefined,
            total: undefined,
          }),
        ],
      }],
    });

    const created = await estimatesService.create(estimate, 'local');

    expect(created.subtotal).toBe(250);
    expect(created.markupAmount).toBe(25);
    expect(created.total).toBe(275);
    expect(created.marginAmount).toBe(25);
    expect(created.marginPercent).toBeCloseTo(9.09, 2);
  });

  it('returns normalized estimate items from local estimate sections', async () => {
    seedLocalAppData({
      estimates: [makeEstimate({
        sections: [{
          id: 'section-1',
          name: 'Scope',
          lineItems: [makeEstimateItem({ quantity: 3, unitCost: 40, costTotal: undefined, priceTotal: undefined, total: undefined })],
        }],
      })],
    });

    const items = await estimatesService.getItems('estimate-1', 'local');

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      quantity: 3,
      unitCost: 40,
      costTotal: 120,
      priceTotal: 120,
      total: 120,
      clientVisible: true,
    });
  });
});
