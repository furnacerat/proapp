import type { Estimate } from '../../data/types';
import { createCollectionService } from './baseService';
import { TABLES } from './tables';

export const estimatesService = createCollectionService<Estimate>('estimates', TABLES.estimates);

