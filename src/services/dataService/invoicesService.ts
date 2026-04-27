import type { Invoice } from '../../data/types';
import { createCollectionService } from './baseService';
import { TABLES } from './tables';

export const invoicesService = createCollectionService<Invoice>('invoices', TABLES.invoices);

