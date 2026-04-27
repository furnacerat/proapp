import type { Expense } from '../../data/types';
import { createCollectionService } from './baseService';
import { TABLES } from './tables';

export const expensesService = createCollectionService<Expense>('expenses', TABLES.expenses);

