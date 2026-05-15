import type { AppData } from './types';

export const initialData: AppData = {
  customers: [],
  workers: [],
  laborRates: [],
  materials: [],
  suppliers: [],
  assemblies: [],
  templates: [],
  projectTypeTemplates: [],
  estimateTemplates: [],
  estimates: [],
  jobTemplates: [],
  jobs: [],
  timeEntries: [],
  expenses: [],
  companyExpenses: [],
  tasks: [],
  invoices: [],
  payments: [],
  notes: [],
  photos: [],
  changeOrders: [],
  portalTokens: [],
  signatureRequests: [],
  dailyCommandProgress: {
    streak: 0,
    completedActionsByDate: {},
  },
  alerts: [],
  timeline: [],
  jobLogs: [],
  punchLists: [],
  jobIssues: [],
  fileAttachments: [],
  materialOrders: [],
  shoppingLists: [],
  receipts: [],
  allowances: [],
};

export function generateCompleteSeedData(): AppData {
  return initialData;
}
