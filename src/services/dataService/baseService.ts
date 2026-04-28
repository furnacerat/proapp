import type { AppData } from '../../data/types';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getStorageMode, STORAGE_KEY, type StorageMode } from './config';

export type RecordWithId = { id: string; [key: string]: any };
export type LocalCollectionKey = keyof AppData;

const now = () => new Date().toISOString();

export const getLocalAppData = (): AppData | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const saveLocalAppData = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.');
  }
  return supabase;
};

const updateLocalCollection = <T extends RecordWithId>(
  key: LocalCollectionKey,
  updater: (items: T[]) => T[],
) => {
  const data = getLocalAppData();
  if (!data) return;
  saveLocalAppData({ ...data, [key]: updater(((data[key] || []) as unknown) as T[]) });
};

export const toSupabaseRow = (record: RecordWithId) => ({
  id: String(record.id),
  payload: record,
  name: record.name || record.title || record.invoiceNumber || record.poNumber || record.number || null,
  title: record.title || record.name || null,
  status: record.status || null,
  user_id: record.userId || record.user_id || null,
  customer_id: record.customerId || record.customer_id || null,
  estimate_id: record.estimateId || record.estimate_id || null,
  job_id: record.jobId || record.job_id || null,
  task_id: record.taskId || record.task_id || null,
  worker_id: record.workerId || record.worker_id || null,
  invoice_id: record.invoiceId || record.invoice_id || null,
  supplier_id: record.supplierId || record.supplier_id || null,
  allowance_id: record.allowanceId || record.allowance_id || null,
  receipt_id: record.receiptId || record.receipt_id || record.receipt || null,
  source_type: record.sourceType || record.source_type || null,
  source_id: record.sourceId || record.source_id || null,
  estimate_item_id: record.estimateItemId || record.estimate_item_id || null,
  project_type: record.projectType || record.type || record.project_type || null,
  subtotal_cost: record.subtotalCost ?? record.subtotal ?? record.estimatedCost ?? null,
  markup_amount: record.markupAmount ?? null,
  total_price: record.totalPrice ?? record.total ?? record.contractAmount ?? null,
  profit_amount: record.profitAmount ?? record.marginAmount ?? null,
  profit_margin: record.profitMargin ?? record.marginPercent ?? null,
  client_notes: record.clientNotes || null,
  internal_notes: record.internalNotes || null,
  converted_job_id: record.convertedJobId || record.convertedToJobId || null,
  description: record.description || null,
  category: record.category || null,
  type: record.expenseType || record.itemType || record.type || null,
  quantity: record.quantity ?? null,
  unit: record.unit || null,
  unit_cost: record.unitCost ?? null,
  unit_price: record.unitPrice ?? null,
  markup_percent: record.markupPercent ?? null,
  cost_total: record.costTotal ?? null,
  price_total: record.priceTotal ?? record.total ?? null,
  client_visible: record.clientVisible ?? true,
  invoice_number: record.invoiceNumber || record.invoice_number || null,
  vendor: record.vendor || null,
  amount: record.amount ?? null,
  date: record.date || null,
  due_date: record.dueDate || record.due_date || null,
  payment_date: record.paymentDate || record.date || record.payment_date || null,
  method: record.method || null,
  reimbursable: record.reimbursable ?? null,
  subtotal: record.subtotal ?? null,
  tax: record.tax ?? null,
  total: record.total ?? record.amount ?? null,
  paid_amount: record.paidAmount ?? record.paid_amount ?? null,
  balance_due: record.balanceDue ?? record.balance_due ?? null,
  worker_name: record.workerName || record.worker_name || null,
  start_time: record.startTime || record.start_time || null,
  end_time: record.endTime || record.end_time || null,
  hours: record.hours ?? record.totalHours ?? null,
  overtime_hours: record.overtimeHours ?? (record.overtime ? record.totalHours : 0) ?? null,
  hourly_rate: record.hourlyRate ?? null,
  overtime_rate: record.overtimeRate ?? null,
  labor_cost: record.laborCost ?? null,
  start_date: record.startDate || null,
  end_date: record.endDate || record.dueDate || null,
  progress: record.progress ?? null,
  estimated_total: record.estimatedTotal ?? record.contractAmount ?? null,
  actual_cost: record.actualCost ?? null,
  notes: record.notes || null,
  estimated_cost: record.estimatedCost ?? record.costTotal ?? null,
  created_at: record.createdAt || record.created_at || now(),
  updated_at: record.updatedAt || record.updated_at || now(),
});

export const fromSupabaseRows = <T extends RecordWithId>(rows: any[] | null): T[] =>
  (rows || []).map(row => ({ ...row.payload, id: row.id }) as T);

export const upsertSupabaseRecords = async (table: string, records: RecordWithId[]) => {
  if (!records.length) return;
  const client = requireSupabase();
  const { error } = await client.from(table).upsert(records.map(toSupabaseRow), { onConflict: 'id' });
  if (error) throw error;
};

export const createCollectionService = <T extends RecordWithId>(
  localKey: LocalCollectionKey,
  table: string,
) => ({
  async getAll(mode: StorageMode = getStorageMode()): Promise<T[]> {
    if (mode === 'supabase') {
      if (!isSupabaseConfigured) throw new Error('Supabase storage mode is selected but env vars are missing.');
      const client = requireSupabase();
      const { data, error } = await client.from(table).select('id,payload').order('updated_at', { ascending: false });
      if (error) throw error;
      return fromSupabaseRows<T>(data);
    }

    return (((getLocalAppData()?.[localKey] || []) as unknown) as T[]);
  },

  async getById(id: string, mode: StorageMode = getStorageMode()): Promise<T | null> {
    if (mode === 'supabase') {
      if (!isSupabaseConfigured) throw new Error('Supabase storage mode is selected but env vars are missing.');
      const client = requireSupabase();
      const { data, error } = await client.from(table).select('id,payload').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? fromSupabaseRows<T>([data])[0] : null;
    }

    return ((getLocalAppData()?.[localKey] || []) as unknown as T[]).find(item => item.id === id) || null;
  },

  async create(record: T, mode: StorageMode = getStorageMode()): Promise<T> {
    if (mode === 'supabase') {
      await upsertSupabaseRecords(table, [record]);
      return record;
    }

    updateLocalCollection<T>(localKey, items => [...items, record]);
    return record;
  },

  async update(id: string, updates: Partial<T>, mode: StorageMode = getStorageMode()): Promise<T | null> {
    const existing = await this.getById(id, mode);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: now() } as T;

    if (mode === 'supabase') {
      await upsertSupabaseRecords(table, [updated]);
      return updated;
    }

    updateLocalCollection<T>(localKey, items => items.map(item => item.id === id ? updated : item));
    return updated;
  },

  async delete(id: string, mode: StorageMode = getStorageMode()): Promise<void> {
    if (mode === 'supabase') {
      if (!isSupabaseConfigured) throw new Error('Supabase storage mode is selected but env vars are missing.');
      const client = requireSupabase();
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) throw error;
      return;
    }

    updateLocalCollection<T>(localKey, items => items.filter(item => item.id !== id));
  },

  async upsertMany(records: T[], mode: StorageMode = getStorageMode()): Promise<void> {
    if (mode === 'supabase') {
      await upsertSupabaseRecords(table, records);
      return;
    }

    updateLocalCollection<T>(localKey, existing => {
      const byId = new Map(existing.map(item => [item.id, item]));
      records.forEach(record => byId.set(record.id, record));
      return Array.from(byId.values());
    });
  },
});
