import type { Allowance, AppData, Note, Photo, Receipt, Worker } from '../../data/types';
import { isSupabaseConfigured, testSupabaseConnection } from '../../lib/supabase';
import { getStorageMode } from './config';
import { createCollectionService, getDataServiceCompanyId, getDataServiceUserId, getLocalAppData, saveLocalAppData, setDataServiceCompanyId, setDataServiceOwnerUserId, setDataServiceRole, setDataServiceUserId, upsertSupabaseRecords } from './baseService';
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
import { collectionFromData, importLocalDataToSupabase, previewLocalMigration } from './migrationHelper';
import { TABLES } from './tables';

const workersService = createCollectionService<Worker>('workers', TABLES.workers);
const receiptsService = createCollectionService<Receipt>('receipts', TABLES.receipts);
const allowancesService = createCollectionService<Allowance>('allowances', TABLES.allowances);
const notesService = createCollectionService<Note>('notes', TABLES.notes);
const photosService = createCollectionService<Photo>('photos', TABLES.jobPhotos);

export const dataService = {
  mode: getStorageMode(),
  isSupabaseConfigured,
  testConnection: testSupabaseConnection,
  setUserId: setDataServiceUserId,
  setCompanyId: setDataServiceCompanyId,
  setRole: setDataServiceRole,
  setOwnerUserId: setDataServiceOwnerUserId,

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
  workers: workersService,
  receipts: receiptsService,
  allowances: allowancesService,
  notes: notesService,
  photos: photosService,

  previewLocalMigration,
  importLocalDataToSupabase,

  async syncCoreDataToSupabase(data: AppData): Promise<void> {
    await this.syncWorkspaceDataToSupabase(data);
  },

  async syncWorkspaceDataToSupabase(data: AppData): Promise<void> {
    const userId = getDataServiceUserId();
    const companyId = getDataServiceCompanyId();
    for (const key of Object.keys(TABLES) as Array<keyof typeof TABLES>) {
      const records = collectionFromData(data, key).map(record => ({ ...record, userId, companyId, createdBy: userId }));
      await upsertSupabaseRecords(TABLES[key], records);
    }
  },
};

export type { StorageMode } from './config';
