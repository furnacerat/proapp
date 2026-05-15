import type {
  AppData,
  Estimate,
  EstimateLineItem,
  Expense,
  Invoice,
  Job,
  Material,
  Payment,
  Task,
  TimeEntry,
  Worker,
} from '../data/types';
import { STORAGE_KEY } from '../services/dataService/config';

export const installMemoryLocalStorage = () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
    configurable: true,
  });
};

export const seedLocalAppData = (data: Partial<AppData> = {}) => {
  const appData: AppData = {
    customers: [],
    workers: [],
    laborRates: [],
    materials: [],
    assemblies: [],
    templates: [],
    projectTypeTemplates: [],
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
    suppliers: [],
    materialOrders: [],
    shoppingLists: [],
    receipts: [],
    allowances: [],
    ...data,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  return appData;
};

export const readLocalAppData = (): AppData =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as AppData;

export const makeEstimateItem = (overrides: Partial<EstimateLineItem> = {}): EstimateLineItem => ({
  id: 'estimate-item-1',
  name: 'Demo item',
  quantity: 1,
  unit: 'ea',
  unitCost: 100,
  unitPrice: 100,
  costTotal: 100,
  priceTotal: 100,
  category: 'material',
  type: 'material',
  isLabor: false,
  total: 100,
  ...overrides,
});

export const makeEstimate = (overrides: Partial<Estimate> = {}): Estimate => ({
  id: 'estimate-1',
  estimateNumber: 'EST-1',
  customerId: 'customer-1',
  name: 'Kitchen Remodel',
  address: '100 Main St',
  status: 'draft',
  type: 'remodel',
  sections: [{
    id: 'section-1',
    name: 'Scope',
    lineItems: [makeEstimateItem()],
  }],
  laborTotal: 0,
  materialTotal: 0,
  equipmentTotal: 0,
  subcontractorTotal: 0,
  subtotal: 100,
  markupPercent: 20,
  markupAmount: 20,
  total: 120,
  projectedLaborHours: 0,
  projectedMaterialCost: 100,
  projectedLaborCost: 0,
  taxable: 'none',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  name: 'Kitchen Remodel',
  customerId: 'customer-1',
  address: '100 Main St',
  type: 'remodel',
  contractAmount: 1000,
  estimatedCost: 700,
  actualCost: 0,
  startDate: '2026-01-01',
  dueDate: '2026-01-31',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'invoice-1',
  invoiceNumber: 'INV-1',
  customerId: 'customer-1',
  jobId: 'job-1',
  amount: 1000,
  subtotal: 1000,
  total: 1000,
  paidAmount: 0,
  balanceDue: 1000,
  type: 'progress',
  dueDate: '2026-01-31',
  status: 'sent',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const makePayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'payment-1',
  invoiceId: 'invoice-1',
  customerId: 'customer-1',
  jobId: 'job-1',
  amount: 100,
  date: '2026-01-15',
  method: 'check',
  createdAt: '2026-01-15T00:00:00.000Z',
  ...overrides,
});

export const makeWorker = (overrides: Partial<Worker> = {}): Worker => ({
  id: 'worker-1',
  name: 'Alex Crew',
  type: 'employee',
  email: 'alex@example.com',
  payType: 'hourly',
  hourlyRate: 35,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Install cabinets',
  assignedTo: 'worker-1',
  jobId: 'job-1',
  priority: 'medium',
  status: 'open',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const makeMaterial = (overrides: Partial<Material> = {}): Material => ({
  id: 'material-1',
  name: 'Drywall',
  category: 'materials',
  unit: 'sheet',
  unitPrice: 15,
  currentPrice: 15,
  basePrice: 12,
  isActive: true,
  ...overrides,
});

export const makeExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'expense-1',
  jobId: 'job-1',
  date: '2026-01-05',
  vendor: 'Supply House',
  amount: 250,
  category: 'materials',
  sourceType: 'manual',
  expenseType: 'material',
  createdAt: '2026-01-05T00:00:00.000Z',
  ...overrides,
});

export const makeTimeEntry = (overrides: Partial<TimeEntry> = {}): TimeEntry => ({
  id: 'time-1',
  jobId: 'job-1',
  workerId: 'worker-1',
  date: '2026-01-06',
  startTime: '08:00',
  endTime: '16:00',
  totalHours: 8,
  overtime: false,
  laborCost: 280,
  createdAt: '2026-01-06T00:00:00.000Z',
  ...overrides,
});
