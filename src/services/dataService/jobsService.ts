import type { EstimateLineItem, Job } from '../../data/types';
import { supabase } from '../../lib/supabase';
import {
  createCollectionService,
  applyVisibleUserFilter,
  fromSupabaseRows,
  getLocalAppData,
  upsertSupabaseRecords,
  type RecordWithId,
} from './baseService';
import { getStorageMode, type StorageMode } from './config';
import { estimatesService } from './estimatesService';
import { TABLES } from './tables';

export type JobItem = {
  id: string;
  jobId: string;
  estimateItemId?: string;
  name: string;
  description?: string;
  category?: string;
  type?: string;
  quantity?: number | null;
  unit?: string;
  estimatedCost?: number;
  actualCost?: number;
  status?: string;
  createdAt: string;
  updatedAt: string;
};

const base = createCollectionService<Job>('jobs', TABLES.jobs);
const now = () => new Date().toISOString();

const normalizeJob = (job: Job): Job => {
  const estimatedTotal = job.contractAmount ?? job.estimatedCost ?? 0;
  const actualCost = job.actualCost ?? 0;
  const profit = estimatedTotal - actualCost;
  return {
    ...(job as any),
    ...job,
    name: job.name || (job as any).title || 'Untitled job',
    type: job.type || 'other',
    status: job.status || 'active',
    contractAmount: estimatedTotal,
    estimatedCost: job.estimatedCost ?? estimatedTotal,
    actualCost,
    updatedAt: job.updatedAt || now(),
    profitAmount: (job as any).profitAmount ?? profit,
    profitMargin: (job as any).profitMargin ?? (estimatedTotal ? (profit / estimatedTotal) * 100 : 0),
  };
};

const estimateItemToJobItem = (jobId: string, item: EstimateLineItem): JobItem => ({
  id: crypto.randomUUID(),
  jobId,
  estimateItemId: item.id,
  name: item.name,
  description: item.description,
  category: item.category,
  type: item.type || (item.isLabor ? 'labor' : 'other'),
  quantity: item.quantity,
  unit: item.unit,
  estimatedCost: item.costTotal ?? item.total ?? 0,
  actualCost: 0,
  status: 'planned',
  createdAt: now(),
  updatedAt: now(),
});

export const jobsService = {
  ...base,

  async getAll(mode: StorageMode = getStorageMode()): Promise<Job[]> {
    const jobs = await base.getAll(mode);
    return jobs.map(normalizeJob);
  },

  async getById(id: string, mode: StorageMode = getStorageMode()): Promise<(Job & { items?: JobItem[]; customerInfo?: RecordWithId | null; estimateInfo?: RecordWithId | null }) | null> {
    const job = await base.getById(id, mode);
    if (!job) return null;
    const normalized = normalizeJob(job);
    const items = await this.getItems(id, mode);

    if (mode === 'supabase' && supabase) {
      const [{ data: customer }, { data: estimate }] = await Promise.all([
        normalized.customerId ? applyVisibleUserFilter(supabase.from(TABLES.customers).select('id,payload').eq('id', normalized.customerId)).maybeSingle() : Promise.resolve({ data: null }),
        normalized.estimateId ? applyVisibleUserFilter(supabase.from(TABLES.estimates).select('id,payload').eq('id', normalized.estimateId)).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return {
        ...normalized,
        items,
        customerInfo: customer ? fromSupabaseRows<RecordWithId>([customer])[0] : null,
        estimateInfo: estimate ? fromSupabaseRows<RecordWithId>([estimate])[0] : null,
      };
    }

    const data = getLocalAppData();
    return {
      ...normalized,
      items,
      customerInfo: data?.customers.find(customer => customer.id === normalized.customerId) || null,
      estimateInfo: data?.estimates.find(estimate => estimate.id === normalized.estimateId) || null,
    };
  },

  async create(data: Job, mode: StorageMode = getStorageMode()): Promise<Job> {
    return base.create(normalizeJob(data), mode);
  },

  async update(id: string, data: Partial<Job>, mode: StorageMode = getStorageMode()): Promise<Job | null> {
    const existing = await base.getById(id, mode);
    return existing ? base.update(id, normalizeJob({ ...existing, ...data }), mode) : null;
  },

  async getItems(jobId: string, mode: StorageMode = getStorageMode()): Promise<JobItem[]> {
    if (mode === 'supabase' && supabase) {
      const query = applyVisibleUserFilter(supabase.from(TABLES.jobItems).select('id,payload').eq('job_id', jobId));
      const { data, error } = await query.order('created_at');
      if (error) throw error;
      return fromSupabaseRows<RecordWithId>(data) as JobItem[];
    }
    return [];
  },

  async copyEstimateItemsToJob(jobId: string, estimateId: string, mode: StorageMode = getStorageMode()): Promise<JobItem[]> {
    const estimateItems = await estimatesService.getItems(estimateId, mode);
    const jobItems = estimateItems.map(item => estimateItemToJobItem(jobId, item));
    if (mode === 'supabase') {
      await upsertSupabaseRecords(TABLES.jobItems, jobItems);
    }
    return jobItems;
  },

  async createFromEstimate(estimateId: string, mode: StorageMode = getStorageMode()): Promise<Job | null> {
    const estimate = await estimatesService.getById(estimateId, mode);
    if (!estimate) return null;
    const createdAt = now();
    const job: Job = normalizeJob({
      id: crypto.randomUUID(),
      name: estimate.name,
      customerId: estimate.customerId,
      address: estimate.address,
      type: estimate.type || 'other',
      contractAmount: estimate.total,
      estimatedCost: estimate.subtotal,
      actualCost: 0,
      startDate: createdAt.split('T')[0],
      dueDate: '',
      status: 'active',
      estimateId: estimate.id,
      notes: estimate.notes || '',
      createdAt,
      updatedAt: createdAt,
    });
    await this.create(job, mode);
    await this.copyEstimateItemsToJob(job.id, estimate.id, mode);
    await estimatesService.update(estimate.id, { status: 'converted', convertedToJobId: job.id }, mode);
    return job;
  },

  async updateProgress(jobId: string, progress: number, mode: StorageMode = getStorageMode()): Promise<Job | null> {
    return this.update(jobId, { progress: Math.max(0, Math.min(progress, 100)) } as Partial<Job>, mode);
  },

  async updateFinancials(jobId: string, mode: StorageMode = getStorageMode()): Promise<Job | null> {
    const appData = getLocalAppData();
    const job = await base.getById(jobId, mode);
    if (!job) return null;
    const labor = appData?.timeEntries.filter(entry => entry.jobId === jobId).reduce((sum, entry) => sum + entry.laborCost, 0) || 0;
    const expenses = appData?.expenses
      .filter(expense => expense.jobId === jobId && expense.sourceType !== 'time_entry' && (expense.expenseType !== 'allowance' || expense.reimbursable === true || (expense as any).affectsContractorCost === true))
      .reduce((sum, expense) => sum + expense.amount, 0) || 0;
    const actualCost = labor + expenses;
    return this.update(jobId, { actualCost } as Partial<Job>, mode);
  },
};
