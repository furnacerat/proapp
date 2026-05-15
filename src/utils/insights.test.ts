import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateInsights, generateSmartNextActions, getEstimateSuggestions, getJobHealthScore, getPerformanceInsights } from './insights';
import { makeEstimate, makeExpense, makeInvoice, makeJob, makeMaterial, makePayment, makeTask, makeTimeEntry, makeWorker } from '../test/factories';

describe('insights', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prioritizes critical payment and job actions before approved-estimate conversion', () => {
    const actions = generateSmartNextActions(
      [makeEstimate({ id: 'estimate-approved', name: 'Approved Bath', status: 'approved', convertedToJobId: undefined })],
      [makeJob({ id: 'job-overdue', name: 'Late Kitchen', dueDate: '2026-02-01', status: 'active' })],
      [],
      [],
      [makeInvoice({ id: 'invoice-overdue', invoiceNumber: 'INV-9', amount: 1000, dueDate: '2026-02-01', status: 'sent' })],
      [],
      [makeTask({ id: 'task-open', jobId: 'job-overdue', status: 'open' })],
    );

    expect(actions.map(action => action.id)).toEqual(expect.arrayContaining([
      'invoice-invoice-overdue',
      'job-overdue-job-overdue',
      'approved-estimate-estimate-approved',
    ]));
    expect(actions[0].priority).toBe('critical');
    expect(actions.find(action => action.id === 'approved-estimate-estimate-approved')).toMatchObject({
      priority: 'high',
      actionLabel: 'Convert to job',
      to: '/estimates/estimate-approved',
    });
  });

  it('generates budget, profit, task, and outstanding-balance insights in severity order', () => {
    const insights = generateInsights(
      [
        makeJob({ id: 'job-active', name: 'Active Remodel', status: 'active', contractAmount: 1000 }),
        makeJob({ id: 'job-complete', name: 'Finished Remodel', status: 'completed', contractAmount: 2000, actualCost: 1000 }),
      ],
      [makeExpense({ id: 'expense-active', jobId: 'job-active', amount: 1100 })],
      [],
      [makeWorker()],
      [makeInvoice({ id: 'invoice-1', amount: 500, status: 'sent' })],
      [makePayment({ id: 'payment-1', invoiceId: 'invoice-1', amount: 100 })],
      [makeTask({ id: 'task-overdue', dueDate: '2026-02-01', status: 'open' })],
    );

    expect(insights[0]).toMatchObject({ id: 'budget-job-active', severity: 'critical' });
    expect(insights.map(insight => insight.id)).toEqual(expect.arrayContaining([
      'profit-job-complete',
      'overdue-tasks',
      'outstanding',
    ]));
  });

  it('summarizes performance from completed jobs, estimates, expenses, invoices, and payments', () => {
    const performance = getPerformanceInsights(
      [
        makeEstimate({ id: 'estimate-won', status: 'approved' }),
        makeEstimate({ id: 'estimate-lost', status: 'rejected' }),
      ],
      [
        makeJob({ id: 'job-1', type: 'remodel', contractAmount: 1000, estimatedCost: 800, actualCost: 0, status: 'completed' }),
        makeJob({ id: 'job-2', type: 'repair', contractAmount: 500, estimatedCost: 400, actualCost: 0, status: 'completed' }),
      ],
      [
        makeExpense({ id: 'expense-1', jobId: 'job-1', amount: 700, category: 'materials', date: '2026-02-20' }),
        makeExpense({ id: 'expense-2', jobId: 'job-2', amount: 100, category: 'permits', date: '2026-02-22' }),
      ],
      [makeTimeEntry({ id: 'time-1', jobId: 'job-1', laborCost: 200 })],
      [makeInvoice({ id: 'invoice-1', amount: 1000, dueDate: '2026-02-20' })],
      [makePayment({ id: 'payment-1', invoiceId: 'invoice-1', amount: 300 })],
      [{
        id: 'company-expense-1',
        name: 'Insurance',
        vendor: 'Carrier',
        category: 'insurance',
        amount: 200,
        dueDate: '2026-02-20',
        status: 'upcoming',
        recurring: true,
        frequency: 'monthly',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
      [{
        id: 'order-1',
        poNumber: 'PO-1',
        status: 'sent',
        items: [],
        subtotal: 150,
        total: 150,
        expectedDate: '2026-02-25',
        createdAt: '2026-02-10T00:00:00.000Z',
      }],
    );

    expect(performance.closeRate).toBe(50);
    expect(performance.averageProfitMargin).toBeCloseTo(33.33, 2);
    expect(performance.expenseBreakdown[0]).toMatchObject({ category: 'materials', amount: 700 });
    expect(performance.underpricingWarnings[0]).toContain('Kitchen Remodel');
    expect(performance.cashFlowForecast).toMatchObject({
      horizonDays: 30,
      expectedReceipts: 700,
      expectedPayroll: 200,
      scheduledMaterialOrders: 150,
      recurringCompanyExpenses: 200,
      knownJobExpenses: 800,
      netCashFlow: -650,
    });
    expect(performance.cashFlowBalance).toBe(-650);
  });

  it('scores job health from schedule, budget, task, billing, and scope risks', () => {
    const job = makeJob({
      id: 'job-risk',
      contractAmount: 1000,
      estimatedCost: 700,
      dueDate: '2026-02-01',
      updatedAt: '2026-01-10T00:00:00.000Z',
      status: 'active',
    });

    const health = getJobHealthScore(job, {
      expenses: [makeExpense({ id: 'expense-risk', jobId: 'job-risk', amount: 850 })],
      tasks: [makeTask({ id: 'task-risk', jobId: 'job-risk', status: 'blocked', dueDate: '2026-02-01' })],
      invoices: [makeInvoice({ id: 'invoice-risk', jobId: 'job-risk', amount: 500, total: 500, dueDate: '2026-02-01', status: 'sent' })],
      payments: [],
      changeOrders: [{ id: 'co-risk', jobId: 'job-risk', description: 'Extra framing', amount: 250, status: 'pending', createdAt: '2026-02-10T00:00:00.000Z', updatedAt: '2026-02-10T00:00:00.000Z' }],
      progress: 30,
    });

    expect(health.status).toBe('critical');
    expect(health.score).toBeLessThan(45);
    expect(health.factors.map(factor => factor.id)).toEqual(expect.arrayContaining([
      'schedule-overdue',
      'budget-over',
      'task-risk',
      'payment-overdue',
      'scope-risk',
    ]));
  });

  it('keeps healthy jobs high when there are no operational risks', () => {
    const health = getJobHealthScore(makeJob({
      id: 'job-healthy',
      contractAmount: 1000,
      estimatedCost: 700,
      dueDate: '2026-03-15',
      updatedAt: '2026-02-14T00:00:00.000Z',
      status: 'active',
    }), {
      expenses: [makeExpense({ id: 'expense-healthy', jobId: 'job-healthy', amount: 200 })],
      tasks: [makeTask({ id: 'task-healthy', jobId: 'job-healthy', status: 'done', dueDate: '2026-02-10' })],
      progress: 100,
      materialOrders: [{
        id: 'order-healthy',
        poNumber: 'PO-HEALTH',
        status: 'received',
        items: [],
        subtotal: 0,
        total: 0,
        expectedDate: '2026-02-10',
        createdAt: '2026-02-01T00:00:00.000Z',
      }],
    });

    expect(health.status).toBe('healthy');
    expect(health.score).toBeGreaterThanOrEqual(90);
    expect(health.summary).toBe('No major operational risks detected.');
  });

  it('deduplicates smart estimate suggestions while combining template, history, labor, and material sources', () => {
    const suggestions = getEstimateSuggestions(
      'remodel',
      [
        makeMaterial({ id: 'material-1', name: 'Drywall', category: 'materials', unit: 'sheet', unitPrice: 15 }),
        makeMaterial({ id: 'material-duplicate', name: 'Drywall', category: 'materials', unit: 'sheet', unitPrice: 20 }),
      ],
      [{ id: 'labor-rate-1', name: 'Carpenter', trade: 'carpentry', hourlyRate: 75, isActive: true }],
      [{
        id: 'template-1',
        name: 'Remodel Template',
        projectType: 'remodel',
        description: 'Default remodel scope',
        createdAt: '2026-01-01T00:00:00.000Z',
        sections: [{
          id: 'section-1',
          name: 'General',
          sortOrder: 1,
          items: [{
            id: 'template-item-1',
            name: 'Drywall',
            quantity: 10,
            unit: 'sheet',
            unitPrice: 15,
            category: 'material',
          }],
        }],
      }],
      [makeJob({ id: 'job-1', type: 'remodel' })],
      [makeExpense({ id: 'expense-1', jobId: 'job-1', amount: 300, category: 'materials' })],
      [],
    );

    expect(suggestions.map(suggestion => suggestion.id)).toEqual(expect.arrayContaining([
      'template-template-item-1',
      'history-expense-materials',
      'labor-labor-rate-1',
    ]));
    expect(suggestions.filter(suggestion => suggestion.name === 'Drywall' && suggestion.category === 'material')).toHaveLength(1);
  });
});
