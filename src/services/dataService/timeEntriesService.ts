import type { TimeEntry } from '../../data/types';
import { createCollectionService, getLocalAppData } from './baseService';
import { getStorageMode, type StorageMode } from './config';
import { TABLES } from './tables';
import { calculateTimeEntryLaborCost, timeEntryCostFields } from '../../utils/timeEntries';

const base = createCollectionService<TimeEntry>('timeEntries', TABLES.timeEntries);

const calculateLaborCost = (entry: TimeEntry): number => {
  const appData = getLocalAppData();
  const worker = appData?.workers.find(item => item.id === entry.workerId);
  return calculateTimeEntryLaborCost(entry, worker);
};

const normalizeTimeEntry = (entry: TimeEntry): TimeEntry => {
  const appData = getLocalAppData();
  const worker = appData?.workers.find(item => item.id === entry.workerId);
  const costFields = timeEntryCostFields(entry, worker);
  const normalized = {
    ...entry,
    workerName: entry.workerName || worker?.name,
    ...costFields,
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
  };
  return {
    ...normalized,
    laborCost: calculateLaborCost(normalized),
  };
};

export const timeEntriesService = {
  ...base,

  async getAll(mode: StorageMode = getStorageMode()): Promise<TimeEntry[]> {
    const entries = await base.getAll(mode);
    return entries.map(normalizeTimeEntry);
  },

  async getById(id: string, mode: StorageMode = getStorageMode()): Promise<TimeEntry | null> {
    const entry = await base.getById(id, mode);
    return entry ? normalizeTimeEntry(entry) : null;
  },

  async getByJobId(jobId: string, mode: StorageMode = getStorageMode()): Promise<TimeEntry[]> {
    const entries = await this.getAll(mode);
    return entries.filter(entry => entry.jobId === jobId);
  },

  async create(entry: TimeEntry, mode: StorageMode = getStorageMode()): Promise<TimeEntry> {
    return base.create(normalizeTimeEntry(entry), mode);
  },

  async update(id: string, updates: Partial<TimeEntry>, mode: StorageMode = getStorageMode()): Promise<TimeEntry | null> {
    const existing = await base.getById(id, mode);
    return existing ? base.update(id, normalizeTimeEntry({ ...existing, ...updates }), mode) : null;
  },
};
