import type { Supplier } from '../../data/types';
import { createCollectionService } from './baseService';
import { TABLES } from './tables';

export const suppliersService = createCollectionService<Supplier>('suppliers', TABLES.suppliers);

