import type { AppData } from '../../data/types';
import { isSupabaseConfigured, testSupabaseConnection } from '../../lib/supabase';
import { getStorageMode } from './config';
import { getLocalAppData, saveLocalAppData, upsertSupabaseRecords } from './baseService';
import { customersService } from './customersService';
import { estimatesService } from './estimatesService';
import { jobsService } from './jobsService';
import { tasksService } from './tasksService';
import { expensesService } from './expensesService';
import { invoicesService } from './invoicesService';
import { paymentsService } from './paymentsService';
import { timeEntriesService } from './timeEntriesService';
import { shoppingListsService } from './shoppingListsService';
import { ordersService } from './ordersService';
import { suppliersService } from './suppliersService';
import { importLocalDataToSupabase, previewLocalMigration } from './migrationHelper';
import { TABLES } from './tables';

export const dataService = {
  mode: getStorageMode(),
  isSupabaseConfigured,
  testConnection: testSupabaseConnection,

  local: {
    getAppData: getLocalAppData,
    saveAppData: saveLocalAppData,
  },

  customers: customersService,
  estimates: estimatesService,
  jobs: jobsService,
  tasks: tasksService,
  expenses: expensesService,
  invoices: invoicesService,
  payments: paymentsService,
  timeEntries: timeEntriesService,
  shoppingLists: shoppingListsService,
  orders: ordersService,
  suppliers: suppliersService,

  previewLocalMigration,
  importLocalDataToSupabase,

  async syncCoreDataToSupabase(data: AppData): Promise<void> {
    await upsertSupabaseRecords(TABLES.customers, data.customers);
    await upsertSupabaseRecords(TABLES.estimates, data.estimates);
    await upsertSupabaseRecords(TABLES.jobs, data.jobs);
    await upsertSupabaseRecords(TABLES.expenses, data.expenses);
    await upsertSupabaseRecords(TABLES.timeEntries, data.timeEntries);
    await upsertSupabaseRecords(TABLES.invoices, data.invoices);
    await upsertSupabaseRecords(TABLES.payments, data.payments);
  },
};

export type { StorageMode } from './config';
