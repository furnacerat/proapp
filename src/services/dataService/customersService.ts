import type { Customer } from '../../data/types';
import { createCollectionService } from './baseService';
import { TABLES } from './tables';

export const customersService = createCollectionService<Customer>('customers', TABLES.customers);

