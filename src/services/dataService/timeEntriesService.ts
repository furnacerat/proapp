import type { TimeEntry } from '../../data/types';
import { createCollectionService, getLocalAppData } from './baseService';
import { getStorageMode, type StorageMode } from './config';
import { TABLES } from './tables';

const base = createCollectionService<TimeEntry>('timeEntries', TABLES.timeEntries);

const calculateLaborCost = (entry: TimeEntry): number => {
  const appData = getLocalAppData();
  const worker = appData?.workers.find(item => item.id === entry.workerId);
  const totalHours = Number(entry.totalHours ?? entry.hours ?? 0);
  const overtimeHours = Number(entry.overtimeHours ?? (entry.overtime ? totalHours : 0));
  const regularHours = Math.max(totalHours - overtimeHours, 0);
  const hourlyRate = Number(entry.hourlyRate ?? worker?.hourlyRate ?? 0);
  const overtimeRate = Number(entry.overtimeRate ?? hourlyRate * 1.5);
  return regularHours * hourlyRate + overtimeHours * overtimeRate;
};

const normalizeTimeEntry = (entry: TimeEntry): TimeEntry => {
  const appData = getLocalAppData();
  const worker = appData?.workers.find(item => item.id === entry.workerId);
  const totalHours = Number(entry.totalHours ?? entry.hours ?? 0);
  const normalized = {
    ...entry,
    workerName: entry.workerName || worker?.name,
    totalHours,
    hours: entry.hours ?? totalHours,
    overtimeHours: entry.overtimeHours ?? (entry.overtime ? totalHours : 0),
    hourlyRate: entry.hourlyRate ?? worker?.hourlyRate ?? 0,
    overtimeRate: entry.overtimeRate ?? (entry.hourlyRate ?? worker?.hourlyRate ?? 0) * 1.5,
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
