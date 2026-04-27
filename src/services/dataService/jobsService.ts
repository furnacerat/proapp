import type { Job } from '../../data/types';
import { createCollectionService } from './baseService';
import { TABLES } from './tables';

export const jobsService = createCollectionService<Job>('jobs', TABLES.jobs);

