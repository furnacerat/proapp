import type { AppData, Customer, Estimate, Job } from '../data/types';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export const STORAGE_KEY = 'buildops_pro_data';

type RecordWithId = { id: string; [key: string]: any };
type LocalCollectionKey = keyof AppData;
type SyncMode = 'local' | 'supabase';

const TABLES = {
  customers: 'customers',
  estimates: 'estimates',
  jobs: 'jobs',
  tasks: 'tasks',
  expenses: 'expenses',
  invoices: 'invoices',
  payments: 'payments',
  timeEntries: 'time_entries',
  shoppingLists: 'shopping_lists',
  shoppingListItems: 'shopping_list_items',
  materialOrders: 'orders',
  suppliers: 'suppliers',
  allowances: 'allowances',
  receipts: 'receipts',
} as const;

const now = () => new Date().toISOString();

const getLocalAppData = (): AppData | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const saveLocalAppData = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const updateLocalCollection = <T extends RecordWithId>(
  key: LocalCollectionKey,
  updater: (items: T[]) => T[],
) => {
  const data = getLocalAppData();
  if (!data) return;
  saveLocalAppData({ ...data, [key]: updater(((data[key] || []) as unknown) as T[]) });
};

const toSupabaseRow = (record: RecordWithId) => ({
  id: String(record.id),
  payload: record,
  name: record.name || record.title || record.invoiceNumber || record.number || null,
  status: record.status || null,
  customer_id: record.customerId || null,
  estimate_id: record.estimateId || null,
  job_id: record.jobId || null,
  task_id: record.taskId || null,
  order_id: record.orderId || record.materialOrderId || null,
  shopping_list_id: record.shoppingListId || null,
  invoice_id: record.invoiceId || null,
  expense_id: record.expenseId || null,
  allowance_id: record.allowanceId || null,
  worker_id: record.workerId || null,
  supplier_id: record.supplierId || null,
  created_at: record.createdAt || record.created_at || now(),
  updated_at: record.updatedAt || record.updated_at || now(),
});

const fromSupabaseRows = <T extends RecordWithId>(rows: any[] | null): T[] =>
  (rows || []).map(row => ({ ...row.payload, id: row.id }) as T);

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.');
  }
  return supabase;
};

const upsertSupabaseRecords = async (table: string, records: RecordWithId[]) => {
  if (!records.length) return;
  const client = requireSupabase();
  const { error } = await client.from(table).upsert(records.map(toSupabaseRow), { onConflict: 'id' });
  if (error) throw error;
};

const createCollectionService = <T extends RecordWithId>(key: LocalCollectionKey, table: string) => ({
  async getAll(mode: SyncMode = 'local'): Promise<T[]> {
    if (mode === 'supabase') {
      const client = requireSupabase();
      const { data, error } = await client.from(table).select('id,payload').order('updated_at', { ascending: false });
      if (error) throw error;
      return fromSupabaseRows<T>(data);
    }

    return (((getLocalAppData()?.[key] || []) as unknown) as T[]);
  },

  async create(record: T, mode: SyncMode = 'local'): Promise<T> {
    if (mode === 'supabase') {
      await upsertSupabaseRecords(table, [record]);
      return record;
    }

    updateLocalCollection<T>(key, items => [...items, record]);
    return record;
  },

  async update(id: string, updates: Partial<T>, mode: SyncMode = 'local'): Promise<T | null> {
    if (mode === 'supabase') {
      const existing = (await this.getAll('supabase')).find(item => item.id === id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updatedAt: now() } as T;
      await upsertSupabaseRecords(table, [updated]);
      return updated;
    }

    let updatedRecord: T | null = null;
    updateLocalCollection<T>(key, items => items.map(item => {
      if (item.id !== id) return item;
      updatedRecord = { ...item, ...updates, updatedAt: now() } as T;
      return updatedRecord;
    }));
    return updatedRecord;
  },

  async delete(id: string, mode: SyncMode = 'local'): Promise<void> {
    if (mode === 'supabase') {
      const client = requireSupabase();
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) throw error;
      return;
    }

    updateLocalCollection<T>(key, items => items.filter(item => item.id !== id));
  },

  async upsertMany(records: T[], mode: SyncMode = 'local'): Promise<void> {
    if (mode === 'supabase') {
      await upsertSupabaseRecords(table, records);
      return;
    }

    updateLocalCollection<T>(key, existing => {
      const byId = new Map(existing.map(item => [item.id, item]));
      records.forEach(record => byId.set(record.id, record));
      return Array.from(byId.values());
    });
  },
});

const collectionFromData = (data: AppData, key: keyof typeof TABLES): RecordWithId[] => {
  if (key === 'shoppingListItems') {
    return (data.shoppingLists || []).flatMap(list =>
      (list.items || []).map(item => ({
        ...item,
        shoppingListId: list.id,
        jobId: list.jobId,
        customerId: list.customerId,
        estimateId: list.estimateId,
      })),
    ) as RecordWithId[];
  }

  if (key === 'materialOrders') return (data.materialOrders || []) as RecordWithId[];
  if (key === 'timeEntries') return data.timeEntries as RecordWithId[];

  return ((data as any)[key] || []) as RecordWithId[];
};

export const dataService = {
  mode: isSupabaseConfigured ? 'supabase' as SyncMode : 'local' as SyncMode,
  isSupabaseConfigured,

  local: {
    getAppData: getLocalAppData,
    saveAppData: saveLocalAppData,
  },

  customers: createCollectionService<Customer>('customers', TABLES.customers),
  estimates: createCollectionService<Estimate>('estimates', TABLES.estimates),
  jobs: createCollectionService<Job>('jobs', TABLES.jobs),
  tasks: createCollectionService<RecordWithId>('tasks', TABLES.tasks),
  expenses: createCollectionService<RecordWithId>('expenses', TABLES.expenses),
  invoices: createCollectionService<RecordWithId>('invoices', TABLES.invoices),
  payments: createCollectionService<RecordWithId>('payments', TABLES.payments),
  timeEntries: createCollectionService<RecordWithId>('timeEntries', TABLES.timeEntries),
  shoppingLists: createCollectionService<RecordWithId>('shoppingLists', TABLES.shoppingLists),
  materialOrders: createCollectionService<RecordWithId>('materialOrders', TABLES.materialOrders),
  suppliers: createCollectionService<RecordWithId>('suppliers', TABLES.suppliers),
  allowances: createCollectionService<RecordWithId>('allowances', TABLES.allowances),
  receipts: createCollectionService<RecordWithId>('receipts', TABLES.receipts),

  async syncCoreDataToSupabase(data: AppData): Promise<void> {
    await upsertSupabaseRecords(TABLES.customers, data.customers as RecordWithId[]);
    await upsertSupabaseRecords(TABLES.estimates, data.estimates as RecordWithId[]);
    await upsertSupabaseRecords(TABLES.jobs, data.jobs as RecordWithId[]);
  },

  async importLocalDataToSupabase(data: AppData): Promise<void> {
    for (const key of Object.keys(TABLES) as (keyof typeof TABLES)[]) {
      await upsertSupabaseRecords(TABLES[key], collectionFromData(data, key));
    }
  },
};
