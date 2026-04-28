import type { Expense } from '../../data/types';
import { createCollectionService } from './baseService';
import { getStorageMode, type StorageMode } from './config';
import { TABLES } from './tables';

const base = createCollectionService<Expense>('expenses', TABLES.expenses);

export const expenseAffectsContractorCost = (expense: Expense) => {
  if (expense.sourceType === 'time_entry') return false;
  if (expense.expenseType !== 'allowance' && expense.costTreatment !== 'allowance') return true;
  return expense.reimbursable === true || (expense as any).affectsContractorCost === true;
};

const normalizeExpense = (expense: Expense): Expense => ({
  sourceType: 'manual',
  expenseType: expense.expenseType || 'other',
  costTreatment: expense.costTreatment || (expense.reimbursable ? 'reimbursable' : 'contractor_cost'),
  reimbursable: expense.reimbursable ?? expense.costTreatment === 'reimbursable',
  ...expense,
  amount: Number(expense.amount || 0),
  date: expense.date || new Date().toISOString().split('T')[0],
  createdAt: expense.createdAt || new Date().toISOString(),
  updatedAt: expense.updatedAt || expense.createdAt || new Date().toISOString(),
});

export const expensesService = {
  ...base,

  async getAll(mode: StorageMode = getStorageMode()): Promise<Expense[]> {
    const expenses = await base.getAll(mode);
    return expenses.map(normalizeExpense);
  },

  async getById(id: string, mode: StorageMode = getStorageMode()): Promise<Expense | null> {
    const expense = await base.getById(id, mode);
    return expense ? normalizeExpense(expense) : null;
  },

  async getByJobId(jobId: string, mode: StorageMode = getStorageMode()): Promise<Expense[]> {
    const expenses = await this.getAll(mode);
    return expenses.filter(expense => expense.jobId === jobId);
  },

  async create(expense: Expense, mode: StorageMode = getStorageMode()): Promise<Expense> {
    return base.create(normalizeExpense(expense), mode);
  },

  async update(id: string, updates: Partial<Expense>, mode: StorageMode = getStorageMode()): Promise<Expense | null> {
    const existing = await base.getById(id, mode);
    return existing ? base.update(id, normalizeExpense({ ...existing, ...updates }), mode) : null;
  },
};
