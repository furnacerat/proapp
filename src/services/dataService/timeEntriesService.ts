import type { TimeEntry } from '../../data/types';
import { createCollectionService } from './baseService';
import { TABLES } from './tables';

export const timeEntriesService = createCollectionService<TimeEntry>('timeEntries', TABLES.timeEntries);

