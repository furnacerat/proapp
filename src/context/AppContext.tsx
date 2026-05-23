import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo, useRef } from 'react';
import { DAILY_COMMAND_PROGRESS_RECORD_ID, type AppData, type DailyCommandProgress, type Job, type Worker, type TimeEntry, type Expense, type CompanyExpense, type Task, type Invoice, type Payment, type Note, type Photo, type ChangeOrder, type JobTemplate, type Alert, type Note as NoteType, type Photo as PhotoType, type ChangeOrder as ChangeOrderType, type JobTemplate as JobTemplateType, type Alert as AlertType, type Customer, type Estimate, type EstimateScope, type LaborRate, type Material, type Assembly, type Template, type ProjectTypeTemplate, type ProjectTypeTemplateItem, type JobType, type BrandingSettings, type SmtpSettings, type JobTimelineEntry, type JobLog, type PunchListItem, type JobIssue, type FileAttachment, type Supplier, type MaterialOrder, type MaterialOrderStatus, type ShoppingList, type ShoppingListItem, type Receipt, type Allowance, type AllowanceSelection, type SignatureRequest } from '../data/types';
import { generateCompleteSeedData } from '../data/seedData';
import { dataService } from '../services/dataService';
import { useAuth } from './AuthContext';
import { canViewOwnerFinancials, sanitizeAppDataForRole } from '../auth/rbac';
import { calculateTimeEntryLaborCost, expenseAffectsJobCost, getTimeEntryOvertimeHours, timeEntryCostFields } from '../utils/timeEntries';
import { calculateTax } from '../utils/tax';
import { parseDateString } from '../utils/formatters';
import { useCatalog } from './hooks/useCatalog';
import { useCustomers } from './hooks/useCustomers';
import { useEstimates } from './hooks/useEstimates';
import { useJobs } from './hooks/useJobs';
import { useTasks } from './hooks/useTasks';
import { APP_NAME } from '../config/appIdentity';

interface DataServiceStatus {
  mode: 'local' | 'supabase';
  supabaseConfigured: boolean;
  isSyncing: boolean;
  lastSyncAt?: string;
  syncError?: string;
}

const LOCAL_RESCUE_DONE_KEY = 'buildops_pro_local_rescue_done';
const WORKSPACE_SYNC_DEBOUNCE_MS = 2000;
const QUEUED_WORKSPACE_SYNC_DELAY_MS = 1000;

const looksLikeDemoData = (data: AppData) => {
  const demoSignals = [
    'john smith',
    'mike johnson',
    'sarah williams',
    'tom brown',
    'lisa davis',
    'smith kitchen remodel',
    'johnson house flip',
    'williams new build',
    'brown bathroom update',
    'miller deck build',
    'lead carpenter',
    'skilled carpenter',
    'demo labor',
    'buildpro supply',
    '2x4x8 stud',
    'basic bathroom refresh',
    'kitchen remodel standard',
  ];

  const haystack = [
    ...(data.customers || []).map(item => `${item.name} ${item.company || ''} ${item.email || ''}`),
    ...(data.jobs || []).map(item => `${item.name} ${item.customer || ''} ${item.address || ''}`),
    ...(data.workers || []).map(item => `${item.name} ${item.email || ''}`),
    ...(data.laborRates || []).map(item => `${item.name} ${item.trade || ''}`),
    ...(data.materials || []).map(item => `${item.name} ${item.supplier || ''}`),
    ...(data.suppliers || []).map(item => `${item.name} ${item.email || ''}`),
    ...(data.assemblies || []).map(item => item.name),
    ...(data.templates || []).map(item => item.name),
    ...(data.jobTemplates || []).map(item => item.name),
  ].join(' ').toLowerCase();

  const matchedSignals = demoSignals.filter(signal => haystack.includes(signal));
  return matchedSignals.length >= 3;
};

const mergeLoadedCollection = <T extends { id: string }>(loaded: T[], current: T[] = [], fallback: T[] = []) => {
  const byId = new Map<string, T>();
  current.forEach(item => byId.set(item.id, item));
  fallback.forEach(item => byId.set(item.id, item));
  loaded.forEach(item => byId.set(item.id, item));
  return Array.from(byId.values());
};

type AppAction = (...args: any[]) => any;
type AppActionMap = Record<string, AppAction>;

const useStableActions = <T extends AppActionMap>(actions: T): T => {
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  });

  return useMemo(() => {
    const stableActions = {} as T;
    (Object.keys(actions) as Array<keyof T>).forEach(key => {
      stableActions[key] = ((...args: Parameters<T[typeof key]>) => actionsRef.current[key](...args)) as T[typeof key];
    });
    return stableActions;
    // The action key set is static for AppContext; the ref keeps implementations fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

interface AppContextType {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  dataServiceStatus: DataServiceStatus;
  syncCoreDataToSupabase: () => Promise<boolean>;
  importLocalDataToSupabase: () => Promise<boolean>;
  branding: BrandingSettings;
  updateBranding: (updates: Partial<BrandingSettings>) => void;
  dailyCommandProgress: DailyCommandProgress;
  updateDailyCommandProgress: (updater: React.SetStateAction<DailyCommandProgress>) => void;
  smtpSettings: SmtpSettings;
  updateSmtpSettings: (updates: Partial<SmtpSettings>) => void;
  sendEmail: (payload: { to: string; subject: string; html?: string; text?: string; }) => Promise<boolean>;
  
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  
  addEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'laborTotal' | 'materialTotal' | 'equipmentTotal' | 'subcontractorTotal' | 'subtotal' | 'markupAmount' | 'total' | 'projectedLaborHours' | 'projectedMaterialCost' | 'projectedLaborCost' | 'marginAmount' | 'marginPercent'>) => string;
  updateEstimate: (id: string, updates: Partial<Estimate>) => void;
  deleteEstimate: (id: string) => void;
  duplicateEstimate: (id: string) => string;
  archiveEstimate: (id: string) => void;
  convertEstimateToJob: (estimateId: string, options?: { startDate?: string; dueDate?: string; copyLineItems?: boolean; copyPricing?: boolean; copyNotes?: boolean }) => string;
  
  addLaborRate: (rate: Omit<LaborRate, 'id'>) => string;
  updateLaborRate: (id: string, updates: Partial<LaborRate>) => void;
  deleteLaborRate: (id: string) => void;
  
  addMaterial: (material: Omit<Material, 'id'>) => string;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  
  addAssembly: (assembly: Omit<Assembly, 'id' | 'createdAt'>) => string;
  updateAssembly: (id: string, updates: Partial<Assembly>) => void;
  deleteAssembly: (id: string) => void;
  
  addTemplate: (template: Omit<Template, 'id' | 'createdAt'>) => string;
  updateTemplate: (id: string, updates: Partial<Template>) => void;
  deleteTemplate: (id: string) => void;
  
  addProjectTypeTemplate: (template: Omit<ProjectTypeTemplate, 'id' | 'createdAt'>) => string;
  updateProjectTypeTemplate: (id: string, updates: Partial<ProjectTypeTemplate>) => void;
  deleteProjectTypeTemplate: (id: string) => void;
  getProjectTypeTemplate: (projectType: JobType) => ProjectTypeTemplate | undefined;
  
  addJob: (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'actualCost'>) => string;
  updateJob: (id: string, updates: Partial<Job>) => void;
  deleteJob: (id: string) => void;
  duplicateJob: (id: string) => void;
  
  addWorker: (worker: Omit<Worker, 'id' | 'createdAt'>) => string;
  updateWorker: (id: string, updates: Partial<Worker>) => void;
  deleteWorker: (id: string) => void;
  
  addTimeEntry: (entry: Omit<TimeEntry, 'id' | 'createdAt' | 'laborCost'>) => void;
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;
  
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  addCompanyExpense: (expense: Omit<CompanyExpense, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateCompanyExpense: (id: string, updates: Partial<CompanyExpense>) => void;
  deleteCompanyExpense: (id: string) => void;
  
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => void;
  deletePayment: (id: string) => void;
  
  addNote: (note: Omit<NoteType, 'id' | 'createdAt'>) => void;
  deleteNote: (id: string) => void;
  
  addPhoto: (photo: Omit<PhotoType, 'id' | 'createdAt'>) => void;
  deletePhoto: (id: string) => void;
  
addChangeOrder: (co: Omit<ChangeOrderType, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateChangeOrder: (id: string, updates: Partial<ChangeOrderType>) => void;
  deleteChangeOrder: (id: string) => void;
  approveChangeOrder: (id: string) => void;

  addJobTemplate: (template: Omit<JobTemplateType, 'id' | 'createdAt'>) => void;
  updateJobTemplate: (id: string, updates: Partial<JobTemplateType>) => void;
  deleteJobTemplate: (id: string) => void;
  createJobFromTemplate: (templateId: string, name: string, address: string, customer: string) => void;

  addTimelineEntry: (entry: Omit<JobTimelineEntry, 'id'>) => void;
  updateTimelineEntry: (id: string, updates: Partial<JobTimelineEntry>) => void;
  deleteTimelineEntry: (id: string) => void;

  addJobLog: (log: Omit<JobLog, 'id' | 'createdAt'>) => void;
  updateJobLog: (id: string, updates: Partial<JobLog>) => void;
  deleteJobLog: (id: string) => void;

  addPunchListItem: (item: Omit<PunchListItem, 'id' | 'createdAt'>) => void;
  updatePunchListItem: (id: string, updates: Partial<PunchListItem>) => void;
  deletePunchListItem: (id: string) => void;

  addJobIssue: (issue: Omit<JobIssue, 'id' | 'createdAt'>) => void;
  updateJobIssue: (id: string, updates: Partial<JobIssue>) => void;
  deleteJobIssue: (id: string) => void;

  addFileAttachment: (file: Omit<FileAttachment, 'id' | 'createdAt'>) => void;
  updateFileAttachment: (id: string, updates: Partial<FileAttachment>) => void;
  deleteFileAttachment: (id: string) => void;
  addSignatureRequest: (request: Omit<SignatureRequest, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'auditTrail'> & { status?: SignatureRequest['status']; auditTrail?: SignatureRequest['auditTrail'] }) => string;
  updateSignatureRequest: (id: string, updates: Partial<SignatureRequest>) => void;
  deleteSignatureRequest: (id: string) => void;

  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => string;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;

  addMaterialOrder: (order: Omit<MaterialOrder, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateMaterialOrder: (id: string, updates: Partial<MaterialOrder>) => void;
  deleteMaterialOrder: (id: string) => void;

  addShoppingList: (list: Omit<ShoppingList, 'id' | 'createdAt'>) => string;
  updateShoppingList: (id: string, updates: Partial<ShoppingList>) => void;
  deleteShoppingList: (id: string) => void;
  addShoppingListItem: (listId: string, item: Omit<ShoppingListItem, 'id'>) => void;
  updateShoppingListItem: (listId: string, itemId: string, updates: Partial<ShoppingListItem>) => void;
  deleteShoppingListItem: (listId: string, itemId: string) => void;
  addShoppingReceipt: (receipt: Omit<Receipt, 'id'>) => string;
  addAllowance: (allowance: Omit<Allowance, 'id' | 'usedAmount' | 'remainingAmount' | 'status' | 'selections'> & { selections?: AllowanceSelection[] }) => string;
  updateAllowance: (id: string, updates: Partial<Allowance>) => void;
  deleteAllowance: (id: string) => void;
  addAllowanceSelection: (allowanceId: string, selection: Omit<AllowanceSelection, 'id' | 'allowanceId'>, reimbursable?: boolean) => void;
  updateAllowanceSelection: (allowanceId: string, selectionId: string, updates: Partial<AllowanceSelection>) => void;
  createAllowanceOverageChangeOrder: (allowanceId: string) => void;

  markAlertRead: (id: string) => void;
  clearAllAlerts: () => void;
  
  getJobLaborCost: (jobId: string) => number;
  getJobExpenseTotal: (jobId: string) => number;
  getJobChangeOrderTotal: (jobId: string) => number;
  getJobActualCost: (jobId: string) => number;
  getJobProfit: (jobId: string) => { profit: number; margin: number };
  getJobBalance: (jobId: string) => number;
  getJobProgress: (jobId: string) => number;
  
  customers: Customer[];
  estimates: Estimate[];
  laborRates: LaborRate[];
  materials: Material[];
  assemblies: Assembly[];
  templates: Template[];
  projectTypeTemplates: ProjectTypeTemplate[];
  
  jobs: Job[];
  workers: Worker[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
  companyExpenses: CompanyExpense[];
  tasks: Task[];
  invoices: Invoice[];
  payments: Payment[];
  notes: NoteType[];
  photos: PhotoType[];
  changeOrders: ChangeOrderType[];
  jobTemplates: JobTemplateType[];
  alerts: AlertType[];
  
  getCustomerById: (id: string) => Customer | undefined;
  getJobCustomer: (jobId: string) => Customer | undefined;
  getEstimateCustomer: (estimateId: string) => Customer | undefined;
  
  timeline: JobTimelineEntry[];
  jobLogs: JobLog[];
  punchLists: PunchListItem[];
  jobIssues: JobIssue[];
  fileAttachments: FileAttachment[];
  signatureRequests: SignatureRequest[];
  suppliers: Supplier[];
  materialOrders: MaterialOrder[];
  shoppingLists: ShoppingList[];
  receipts: Receipt[];
  allowances: Allowance[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_BRANDING: BrandingSettings = {
  brandName: 'Your Company',
  appName: APP_NAME,
  tagline: 'Contractor operating system',
  emailFromName: 'Your Company',
  emailFromAddress: '',
  phone: '',
  address: '',
  website: '',
  primaryColor: '#1f3a8a',
  secondaryColor: '#2563eb',
  fontFamily: 'Inter, system-ui, Arial',
  logoUrl: '',
  logoDataUrl: '',
  termsText: '',
  termsUrl: '',
  defaultTaxRate: 0,
  smartFeaturesEnabled: true,
};

const DEFAULT_SMTP_SETTINGS: SmtpSettings = {
  host: '',
  port: 587,
  user: '',
  password: '',
  secure: true,
  fromName: '',
  fromEmail: '',
  enabled: false,
};

const DEFAULT_DAILY_COMMAND_PROGRESS: DailyCommandProgress = {
  streak: 0,
  completedActionsByDate: {},
};

const normalizeAppData = (raw: AppData): AppData => {
  const data = {
    ...raw,
    branding: { ...DEFAULT_BRANDING, ...(raw.branding || {}), appName: APP_NAME },
    smtpSettings: { ...DEFAULT_SMTP_SETTINGS, ...(raw.smtpSettings || {}) },
    dailyCommandProgress: { ...DEFAULT_DAILY_COMMAND_PROGRESS, ...(raw.dailyCommandProgress || {}) },
    photos: raw.photos || [],
    changeOrders: raw.changeOrders || [],
    portalTokens: raw.portalTokens || [],
    signatureRequests: raw.signatureRequests || [],
    jobTemplates: raw.jobTemplates || [],
    alerts: raw.alerts || [],
    timeline: raw.timeline || [],
    jobLogs: raw.jobLogs || [],
    punchLists: raw.punchLists || [],
    jobIssues: raw.jobIssues || [],
    fileAttachments: raw.fileAttachments || [],
    suppliers: raw.suppliers || [],
    materialOrders: raw.materialOrders || [],
    shoppingLists: raw.shoppingLists || [],
    receipts: raw.receipts || [],
    allowances: raw.allowances || [],
    companyExpenses: raw.companyExpenses || [],
  };

  const normalizedJobs = data.jobs.map(job => ({
    ...job,
    customerId: job.customerId || data.customers.find(customer => customer.name.toLowerCase() === (job.customer || '').toLowerCase())?.id || '',
  }));
  const jobById = new Map(normalizedJobs.map(job => [job.id, job]));
  const estimateById = new Map(data.estimates.map(estimate => [estimate.id, estimate]));
  const invoiceById = new Map(data.invoices.map(invoice => [invoice.id, invoice]));
  const listById = new Map((data.shoppingLists || []).map(list => [list.id, list]));
  const getCustomerIdForJob = (jobId?: string) => jobId ? jobById.get(jobId)?.customerId : undefined;
  const getCustomerIdForEstimate = (estimateId?: string) => estimateId ? estimateById.get(estimateId)?.customerId : undefined;

  return {
    ...data,
    jobs: normalizedJobs,
    tasks: data.tasks.map(task => ({
      ...task,
      taskType: task.taskType || 'task',
      assignmentRole: task.assignmentRole || (task.assignedTo ? 'worker' : 'office'),
      customerId: task.customerId || getCustomerIdForJob(task.jobId) || getCustomerIdForEstimate(task.estimateId),
    })),
    timeEntries: data.timeEntries.map(entry => {
      const worker = data.workers.find(item => item.id === entry.workerId);
      const costFields = timeEntryCostFields(entry, worker);
      return {
        ...entry,
        ...costFields,
      };
    }),
    expenses: data.expenses.map(expense => ({
      ...expense,
      sourceType: expense.sourceType || (expense.source === 'shopping_list' ? 'shopping_list' : expense.source === 'order' ? 'material_order' : expense.source === 'time_entry' ? 'time_entry' : expense.source === 'allowance' ? 'allowance' : 'manual'),
      sourceId: expense.sourceId,
      reimbursable: expense.reimbursable ?? expense.costTreatment === 'reimbursable',
    })),
    invoices: data.invoices.map(invoice => ({
      ...invoice,
      customerId: invoice.customerId || getCustomerIdForJob(invoice.jobId),
      estimateId: invoice.estimateId || jobById.get(invoice.jobId)?.estimateId,
      subtotal: invoice.subtotal ?? invoice.amount,
      total: invoice.total ?? invoice.amount,
      paidAmount: invoice.paidAmount ?? data.payments.filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0),
      balanceDue: invoice.balanceDue ?? Math.max((invoice.total ?? invoice.amount) - data.payments.filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0), 0),
    })),
    payments: data.payments.map(payment => {
      const invoice = invoiceById.get(payment.invoiceId);
      return {
        ...payment,
        jobId: payment.jobId || invoice?.jobId,
        customerId: payment.customerId || invoice?.customerId || getCustomerIdForJob(invoice?.jobId),
      };
    }),
    materialOrders: (data.materialOrders || []).map(order => ({
      ...order,
      customerId: order.customerId || getCustomerIdForJob(order.jobId) || getCustomerIdForEstimate(order.estimateId),
    })),
    shoppingLists: (data.shoppingLists || []).map(list => ({
      ...list,
      customerId: list.customerId || getCustomerIdForJob(list.jobId),
      estimateId: list.estimateId || jobById.get(list.jobId)?.estimateId,
    })),
    receipts: (data.receipts || []).map(receipt => {
      const list = listById.get(receipt.shoppingListId);
      return {
        ...receipt,
        customerId: receipt.customerId || list?.customerId || getCustomerIdForJob(receipt.jobId),
      };
    }),
    allowances: (data.allowances || []).map(allowance => ({
      ...allowance,
      affectsContractorCost: allowance.affectsContractorCost === true,
    })),
  };
};

export function AppProvider({ children }: { children: ReactNode }) {
  const { profile, role } = useAuth();
  const [data, setData] = useState<AppData>(() => {
    if (dataService.mode !== 'supabase') {
      const stored = dataService.local.getAppData();
      if (stored) {
        if (looksLikeDemoData(stored)) {
          return normalizeAppData(generateCompleteSeedData());
        }
        return normalizeAppData(stored);
      }
    }
    return normalizeAppData(generateCompleteSeedData());
  });
  const [dataServiceStatus, setDataServiceStatus] = useState<DataServiceStatus>({
    mode: dataService.mode,
    supabaseConfigured: dataService.isSupabaseConfigured,
    isSyncing: false,
  });
  const supabaseInitialLoadComplete = useRef(dataService.mode !== 'supabase');
  const latestWorkspaceData = useRef(data);
  const workspaceSyncInFlight = useRef(false);
  const workspaceSyncQueued = useRef(false);

  latestWorkspaceData.current = data;

  useEffect(() => {
    if (dataService.mode === 'supabase' && (!supabaseInitialLoadComplete.current || looksLikeDemoData(data))) return;
    dataService.local.saveAppData(data);
  }, [data]);

  useEffect(() => {
    if (dataService.mode !== 'supabase' || !dataService.isSupabaseConfigured) return;
    if (!profile?.company_id) return;
    let cancelled = false;
    const optionalCollection = <T,>(promise: Promise<T[]>) => promise.catch(() => [] as T[]);
    Promise.all([
      dataService.customers.getAll(),
      dataService.estimates.getAll(),
      dataService.jobs.getAll(),
      dataService.tasks.getAll(),
      dataService.workers.getAll(),
      dataService.expenses.getAll(),
      dataService.timeEntries.getAll(),
      dataService.invoices.getAll(),
      dataService.payments.getAll(),
      dataService.suppliers.getAll(),
      dataService.orders.getAll(),
      dataService.shoppingLists.getAll(),
      dataService.receipts.getAll(),
      dataService.allowances.getAll(),
      optionalCollection(dataService.laborRates.getAll()),
      optionalCollection(dataService.materials.getAll()),
      optionalCollection(dataService.assemblies.getAll()),
      optionalCollection(dataService.templates.getAll()),
      optionalCollection(dataService.projectTypeTemplates.getAll()),
      dataService.notes.getAll(),
      dataService.photos.getAll(),
      optionalCollection(dataService.changeOrders.getAll()),
      optionalCollection(dataService.portalTokens.getAll()),
      optionalCollection(dataService.signatureRequests.getAll()),
      optionalCollection(dataService.activityLog.getAll()),
    ])
      .then(([customers, estimates, jobs, tasks, workers, expenses, timeEntries, invoices, payments, suppliers, materialOrders, shoppingLists, receipts, allowances, laborRates, materials, assemblies, templates, projectTypeTemplates, notes, photos, changeOrders, portalTokens, signatureRequests, activityLog]) => {
        if (cancelled) return;
        setData(prev => {
          const localData = dataService.local.getAppData();
          const localFallback = localData && !looksLikeDemoData(localData) ? localData : undefined;
          const dailyProgressRecord = activityLog.find(item => item.id === DAILY_COMMAND_PROGRESS_RECORD_ID);
          const dailyCommandProgress = (dailyProgressRecord as JobTimelineEntry & { metadata?: { dailyCommandProgress?: DailyCommandProgress } } | undefined)?.metadata?.dailyCommandProgress;
          const visibleActivityLog = activityLog.filter(item => item.id !== DAILY_COMMAND_PROGRESS_RECORD_ID);
          const loadedData = {
            ...prev,
            customers: mergeLoadedCollection(customers, prev.customers),
            estimates: mergeLoadedCollection(estimates, prev.estimates),
            jobs: mergeLoadedCollection(jobs, prev.jobs),
            tasks: mergeLoadedCollection(tasks, prev.tasks),
            workers: mergeLoadedCollection(workers, prev.workers),
            expenses: mergeLoadedCollection(expenses, prev.expenses),
            timeEntries: mergeLoadedCollection(timeEntries, prev.timeEntries),
            invoices: mergeLoadedCollection(invoices, prev.invoices),
            payments: mergeLoadedCollection(payments, prev.payments),
            suppliers: mergeLoadedCollection(suppliers, prev.suppliers || []),
            materialOrders: mergeLoadedCollection(materialOrders, prev.materialOrders || []),
            shoppingLists: mergeLoadedCollection(shoppingLists, prev.shoppingLists || []),
            receipts: mergeLoadedCollection(receipts, prev.receipts || []),
            allowances: mergeLoadedCollection(allowances, prev.allowances || []),
            laborRates: laborRates.length ? laborRates : localFallback?.laborRates || prev.laborRates,
            materials: materials.length ? materials : localFallback?.materials || prev.materials,
            assemblies: assemblies.length ? assemblies : localFallback?.assemblies || prev.assemblies,
            templates: templates.length ? templates : localFallback?.templates || prev.templates,
            projectTypeTemplates: projectTypeTemplates.length ? projectTypeTemplates : localFallback?.projectTypeTemplates || prev.projectTypeTemplates,
            notes: mergeLoadedCollection(notes, prev.notes),
            photos: mergeLoadedCollection(photos, prev.photos),
            timeline: mergeLoadedCollection(visibleActivityLog, prev.timeline || []),
            changeOrders: changeOrders.length ? changeOrders : localFallback?.changeOrders || prev.changeOrders,
            portalTokens: portalTokens.length ? portalTokens : localFallback?.portalTokens || prev.portalTokens || [],
            signatureRequests: signatureRequests.length ? signatureRequests : localFallback?.signatureRequests || prev.signatureRequests || [],
            branding: localFallback?.branding || prev.branding,
            smtpSettings: localFallback?.smtpSettings || prev.smtpSettings,
            dailyCommandProgress: dailyCommandProgress || localFallback?.dailyCommandProgress || prev.dailyCommandProgress,
          };
          return normalizeAppData(loadedData);
        });
        supabaseInitialLoadComplete.current = true;
      })
      .catch(error => {
        setDataServiceStatus(prev => ({
          ...prev,
          syncError: error instanceof Error ? error.message : 'Supabase load failed',
        }));
        supabaseInitialLoadComplete.current = true;
      });
    return () => { cancelled = true; };
  }, [profile?.company_id]);

  const scheduleWorkspaceSync = useCallback(() => {
    if (dataService.mode !== 'supabase' || !dataService.isSupabaseConfigured || !supabaseInitialLoadComplete.current) return;
    if (!profile?.company_id) return;
    if (looksLikeDemoData(latestWorkspaceData.current)) return;

    if (workspaceSyncInFlight.current) {
      workspaceSyncQueued.current = true;
      return;
    }

    workspaceSyncInFlight.current = true;
    setDataServiceStatus(prev => ({ ...prev, isSyncing: true }));
    const snapshot = latestWorkspaceData.current;

    void dataService.syncWorkspaceDataToSupabase(snapshot)
      .then(() => setDataServiceStatus(prev => ({ ...prev, lastSyncAt: new Date().toISOString(), syncError: undefined })))
      .catch(error => setDataServiceStatus(prev => ({
        ...prev,
        syncError: error instanceof Error ? error.message : 'Supabase sync failed',
      })))
      .finally(() => {
        workspaceSyncInFlight.current = false;
        setDataServiceStatus(prev => ({ ...prev, isSyncing: false }));
        if (workspaceSyncQueued.current) {
          workspaceSyncQueued.current = false;
          window.setTimeout(() => scheduleWorkspaceSync(), QUEUED_WORKSPACE_SYNC_DELAY_MS);
        }
      });
  }, [profile?.company_id]);

  useEffect(() => {
    if (dataService.mode !== 'supabase' || !dataService.isSupabaseConfigured || !supabaseInitialLoadComplete.current) return;
    if (!profile?.company_id) return;
    if (looksLikeDemoData(data)) return;
    const timeout = window.setTimeout(() => scheduleWorkspaceSync(), WORKSPACE_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [data, profile?.company_id, scheduleWorkspaceSync]);

  useEffect(() => {
    if (dataService.mode !== 'supabase' || !dataService.isSupabaseConfigured) return;
    if (!profile?.company_id) return;
    const syncWhenLeaving = () => scheduleWorkspaceSync();
    const syncWhenHidden = () => {
      if (document.visibilityState === 'hidden') scheduleWorkspaceSync();
    };
    window.addEventListener('pagehide', syncWhenLeaving);
    document.addEventListener('visibilitychange', syncWhenHidden);
    return () => {
      window.removeEventListener('pagehide', syncWhenLeaving);
      document.removeEventListener('visibilitychange', syncWhenHidden);
    };
  }, [profile?.company_id, scheduleWorkspaceSync]);

  useEffect(() => {
    if (dataService.mode !== 'supabase' || !dataService.isSupabaseConfigured) return;
    if (!profile?.company_id) return;
    if (localStorage.getItem(LOCAL_RESCUE_DONE_KEY) === profile.company_id) return;

    const localData = dataService.local.getAppData();
    if (!localData || looksLikeDemoData(localData)) {
      localStorage.setItem(LOCAL_RESCUE_DONE_KEY, profile.company_id);
      return;
    }

    void dataService.importLocalDataToSupabase(localData)
      .then(() => {
        localStorage.setItem(LOCAL_RESCUE_DONE_KEY, profile.company_id || '');
        setDataServiceStatus(prev => ({ ...prev, lastSyncAt: new Date().toISOString(), syncError: undefined }));
      })
      .catch(error => {
        setDataServiceStatus(prev => ({
          ...prev,
          syncError: error instanceof Error ? error.message : 'Local device rescue failed',
        }));
      });
  }, [profile?.company_id]);

  useEffect(() => {
    generateAlerts();
  }, [data.jobs, data.tasks, data.invoices, data.payments]);

  // Simple branding configuration accessible app-wide
  const [branding, setBranding] = useState<BrandingSettings>(() => ({
    ...DEFAULT_BRANDING,
    ...(data.branding || {}),
  }));

  useEffect(() => {
    setBranding({ ...DEFAULT_BRANDING, ...(data.branding || {}) });
  }, [data.branding]);

  const updateBranding = (updates: Partial<BrandingSettings>) => {
    setData(prev => {
      const nextBranding = { ...DEFAULT_BRANDING, ...(prev.branding || branding), ...updates, appName: APP_NAME };
      setBranding(nextBranding);
      return normalizeAppData({ ...prev, branding: nextBranding });
    });
  };

  const updateDailyCommandProgress = (updater: React.SetStateAction<DailyCommandProgress>) => {
    setData(prev => {
      const current = { ...DEFAULT_DAILY_COMMAND_PROGRESS, ...(prev.dailyCommandProgress || {}) };
      const nextProgress = typeof updater === 'function'
        ? (updater as (prev: DailyCommandProgress) => DailyCommandProgress)(current)
        : updater;
      return normalizeAppData({
        ...prev,
        dailyCommandProgress: {
          ...DEFAULT_DAILY_COMMAND_PROGRESS,
          ...nextProgress,
          updatedAt: new Date().toISOString(),
        },
      });
    });
  };

  // SMTP settings (global)
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>(() => ({
    ...DEFAULT_SMTP_SETTINGS,
    ...(data.smtpSettings || {}),
  }));

  useEffect(() => {
    setSmtpSettings({ ...DEFAULT_SMTP_SETTINGS, ...(data.smtpSettings || {}) });
  }, [data.smtpSettings]);

  const updateSmtpSettings = (updates: Partial<SmtpSettings>) => {
    setData(prev => {
      const nextSmtpSettings = { ...DEFAULT_SMTP_SETTINGS, ...(prev.smtpSettings || smtpSettings), ...updates };
      setSmtpSettings(nextSmtpSettings);
      return normalizeAppData({ ...prev, smtpSettings: nextSmtpSettings });
    });
  };

  const sendEmail = async (payload: { to: string; subject: string; html?: string; text?: string; }): Promise<boolean> => {
    const { to, subject, html, text } = payload;
    // If SMTP is configured and enabled, attempt server-side delivery
    const canUseSmtp = !!smtpSettings.enabled && !!smtpSettings.host && !!smtpSettings.fromEmail;
    if (canUseSmtp) {
      try {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject, html, text, smtp: smtpSettings, from: smtpSettings.fromEmail, fromName: smtpSettings.fromName })
        }) as Response;
        return res.ok;
      } catch {
        // fall through to mailto as a fallback
      }
    }
    // Fallback: open mail client (plaintext) via mailto with the provided text
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text || '')}`;
    window.location.href = mailto;
    return false;
  };

  const runSupabaseSync = async (syncer: () => Promise<void>): Promise<boolean> => {
    setDataServiceStatus(prev => ({ ...prev, isSyncing: true, syncError: undefined }));
    try {
      await syncer();
      setDataServiceStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
        syncError: undefined,
      }));
      return true;
    } catch (error) {
      setDataServiceStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncError: error instanceof Error ? error.message : 'Supabase sync failed',
      }));
      return false;
    }
  };

  const syncCoreDataToSupabase = () => runSupabaseSync(() => dataService.syncCoreDataToSupabase(data));
  const importLocalDataToSupabase = () => runSupabaseSync(async () => {
    const localData = dataService.local.getAppData();
    await dataService.importLocalDataToSupabase(localData || data);
  });

  // Apply branding to CSS variables globally for a premium feel
  useEffect(() => {
    const root = document.documentElement;
    const b = branding as BrandingSettings;
    if (!root) return;
    if (b.brandName) root.style.setProperty('--brand-name', b.brandName);
    if (b.primaryColor) root.style.setProperty('--primary', b.primaryColor);
    if (b.secondaryColor) root.style.setProperty('--secondary', b.secondaryColor);
    if (b.fontFamily) root.style.setProperty('--font-family', b.fontFamily);
    if (b.logoUrl) root.style.setProperty('--logo-url', b.logoUrl);
    if (b.logoDataUrl) root.style.setProperty('--logo-data-url', b.logoDataUrl);
  }, [branding]);

  const generateAlerts = () => {
    const newAlerts: AlertType[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    data.tasks.forEach(task => {
      if (task.dueDate && task.status !== 'done') {
        const due = parseDateString(task.dueDate);
        due.setHours(0, 0, 0, 0);
        if (due < now) {
          newAlerts.push({
            id: `alert-task-${task.id}`,
            type: 'task_overdue',
            severity: 'critical',
            title: 'Overdue Task',
            message: task.title,
            taskId: task.id,
            jobId: task.jobId,
            isRead: false,
            createdAt: task.dueDate,
          });
        }
      }
    });

    data.jobs.forEach(job => {
      if (job.status === 'active' && job.dueDate) {
        const due = parseDateString(job.dueDate);
        due.setHours(0, 0, 0, 0);
        const deadline = new Date(now);
        deadline.setDate(deadline.getDate() + 3);
        if (due < deadline) {
          newAlerts.push({
            id: `alert-job-${job.id}`,
            type: 'job_overdue',
            severity: due < now ? 'critical' : 'warning',
            title: due < now ? 'Overdue Job' : 'Deadline Approaching',
            message: job.name,
            jobId: job.id,
            isRead: false,
            createdAt: job.dueDate,
          });
        }
      }

      if (job.status === 'active' && job.actualCost > job.contractAmount * 0.9) {
        newAlerts.push({
          id: `alert-budget-${job.id}`,
          type: 'budget_warning',
          severity: 'warning',
          title: 'Over Budget',
          message: `${job.name} is at ${Math.round((job.actualCost / job.contractAmount) * 100)}% of budget`,
          jobId: job.id,
          isRead: false,
          createdAt: job.updatedAt,
        });
      }
    });

    data.invoices.forEach(inv => {
      if (inv.status !== 'paid' && inv.dueDate) {
        const due = parseDateString(inv.dueDate);
        due.setHours(0, 0, 0, 0);
        if (due < now) {
          newAlerts.push({
            id: `alert-invoice-${inv.id}`,
            type: 'invoice_overdue',
            severity: 'critical',
            title: 'Overdue Invoice',
            message: inv.invoiceNumber,
            invoiceId: inv.id,
            jobId: inv.jobId,
            isRead: false,
            createdAt: inv.dueDate,
          });
        }
      }
    });

    const paymentMap = new Map<string, number>();
    data.payments.forEach(p => {
      paymentMap.set(p.invoiceId, (paymentMap.get(p.invoiceId) || 0) + p.amount);
    });

    data.invoices.forEach(inv => {
      if (inv.status !== 'paid' && inv.status !== 'partial') {
        const paid = paymentMap.get(inv.id) || 0;
        if (paid < inv.amount * 0.5) {
          newAlerts.push({
            id: `alert-payment-${inv.id}`,
            type: 'payment_due',
            severity: inv.status === 'sent' ? 'warning' : 'info',
            title: 'Payment Due',
            message: `${inv.invoiceNumber} waiting for payment`,
            invoiceId: inv.id,
            jobId: inv.jobId,
            isRead: false,
            createdAt: inv.createdAt,
          });
        }
      }
    });

    setData(prev => ({ ...prev, alerts: newAlerts }));
  };

  const canSeeOwnerFinancials = canViewOwnerFinancials(role);
  const taskOps = useTasks({ data, setData });
  const jobOps = useJobs({ data, setData, addTask: taskOps.addTask, canSeeOwnerFinancials });
  const { addTask, updateTask, deleteTask } = taskOps;
  const {
    recalcJobCosts,
    addJob,
    updateJob,
    deleteJob,
    duplicateJob,
    getJobLaborCost,
    getJobExpenseTotal,
    getJobChangeOrderTotal,
    getJobActualCost,
    getJobProfit,
    getJobBalance,
    getJobProgress,
  } = jobOps;

  const addWorker = (worker: Omit<Worker, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    const newWorker: Worker = { ...worker, id, createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, workers: [...prev.workers, newWorker] }));
    return id;
  };

  const updateWorker = (id: string, updates: Partial<Worker>) => {
    setData(prev => ({
      ...prev,
      workers: prev.workers.map(w => w.id === id ? { ...w, ...updates } : w),
    }));
  };

  const deleteWorker = (id: string) => {
    setData(prev => ({
      ...prev,
      workers: prev.workers.filter(w => w.id !== id),
      timeEntries: prev.timeEntries.filter(t => t.workerId !== id),
    }));
  };

  const addTimeEntry = (entry: Omit<TimeEntry, 'id' | 'createdAt' | 'laborCost'>) => {
    const worker = data.workers.find(w => w.id === entry.workerId);
    const costFields = timeEntryCostFields(entry, worker);
    const now = new Date().toISOString();
    
    const newEntry: TimeEntry = {
      ...entry,
      id: crypto.randomUUID(),
      workerName: entry.workerName || worker?.name,
      ...costFields,
      createdAt: now,
      updatedAt: now,
    };
    const laborExpense: Expense = {
      id: `expense-time-${newEntry.id}`,
      jobId: newEntry.jobId,
      date: newEntry.date,
      vendor: worker?.name || newEntry.workerName || 'Labor',
      amount: newEntry.laborCost,
      category: 'misc',
      source: 'time_entry',
      sourceType: 'time_entry',
      sourceId: newEntry.id,
      expenseType: 'labor',
      costTreatment: 'contractor_cost',
      reimbursable: false,
      notes: newEntry.notes ? `source: time_entry\n${newEntry.notes}` : 'source: time_entry',
      createdAt: now,
      updatedAt: now,
    };
    
    setData(prev => ({
      ...prev,
      timeEntries: [...prev.timeEntries, newEntry],
      expenses: [...prev.expenses.filter(expense => expense.id !== laborExpense.id), laborExpense],
      tasks: entry.taskId ? prev.tasks.map(task => task.id === entry.taskId && task.status === 'open' ? { ...task, status: 'in_progress', updatedAt: new Date().toISOString() } : task) : prev.tasks,
    }));
    void dataService.timeEntries.create(newEntry).catch(() => undefined);
    void dataService.expenses.create(laborExpense).catch(() => undefined);
    recalcJobCosts(entry.jobId);
  };

  const updateTimeEntry = (id: string, updates: Partial<TimeEntry>) => {
    const currentEntry = data.timeEntries.find(t => t.id === id);
    const affectedJobIds = Array.from(new Set([currentEntry?.jobId, updates.jobId].filter(Boolean) as string[]));
    setData(prev => {
      const entry = prev.timeEntries.find(t => t.id === id);
      if (!entry) return prev;
      
      let laborCost = entry.laborCost;
      if (
        updates.totalHours !== undefined ||
        updates.hours !== undefined ||
        updates.workerId !== undefined ||
        updates.overtime !== undefined ||
        updates.overtimeHours !== undefined ||
        updates.hourlyRate !== undefined ||
        updates.overtimeRate !== undefined
      ) {
        const workerId = updates.workerId || entry.workerId;
        const worker = prev.workers.find(w => w.id === workerId);
        laborCost = calculateTimeEntryLaborCost({ ...entry, ...updates }, worker);
      }
      const totalHours = updates.totalHours ?? entry.totalHours;
      const updatedEntry = {
        ...entry,
        ...updates,
        totalHours,
        hours: updates.totalHours ?? updates.hours ?? entry.totalHours,
        overtimeHours: getTimeEntryOvertimeHours({ ...entry, ...updates, totalHours }, totalHours),
        laborCost,
        updatedAt: new Date().toISOString(),
      };
      const worker = prev.workers.find(w => w.id === updatedEntry.workerId);
      const laborExpense: Expense = {
        id: `expense-time-${updatedEntry.id}`,
        jobId: updatedEntry.jobId,
        date: updatedEntry.date,
        vendor: worker?.name || updatedEntry.workerName || 'Labor',
        amount: updatedEntry.laborCost,
        category: 'misc',
        source: 'time_entry',
        sourceType: 'time_entry',
        sourceId: updatedEntry.id,
        expenseType: 'labor',
        costTreatment: 'contractor_cost',
        reimbursable: false,
        notes: updatedEntry.notes ? `source: time_entry\n${updatedEntry.notes}` : 'source: time_entry',
        createdAt: prev.expenses.find(expense => expense.id === `expense-time-${updatedEntry.id}`)?.createdAt || updatedEntry.createdAt,
        updatedAt: new Date().toISOString(),
      };
      
      return {
        ...prev,
        timeEntries: prev.timeEntries.map(t => t.id === id ? updatedEntry : t),
        expenses: [...prev.expenses.filter(expense => expense.id !== laborExpense.id), laborExpense],
      };
    });
    void dataService.timeEntries.update(id, updates).catch(() => undefined);
    if (dataService.mode === 'supabase' && currentEntry) {
      const worker = data.workers.find(w => w.id === (updates.workerId || currentEntry.workerId));
      const laborCost = calculateTimeEntryLaborCost({ ...currentEntry, ...updates }, worker);
      void dataService.expenses.create({
        id: `expense-time-${id}`,
        jobId: updates.jobId || currentEntry.jobId,
        date: updates.date || currentEntry.date,
        vendor: worker?.name || updates.workerName || currentEntry.workerName || 'Labor',
        amount: laborCost,
        category: 'misc',
        source: 'time_entry',
        sourceType: 'time_entry',
        sourceId: id,
        expenseType: 'labor',
        costTreatment: 'contractor_cost',
        reimbursable: false,
        notes: updates.notes || currentEntry.notes ? `source: time_entry\n${updates.notes || currentEntry.notes || ''}` : 'source: time_entry',
        createdAt: currentEntry.createdAt,
        updatedAt: new Date().toISOString(),
      }).catch(() => undefined);
    }
    affectedJobIds.forEach(jobId => recalcJobCosts(jobId));
  };

  const deleteTimeEntry = (id: string) => {
    const entry = data.timeEntries.find(t => t.id === id);
    setData(prev => ({
      ...prev,
      timeEntries: prev.timeEntries.filter(t => t.id !== id),
      expenses: prev.expenses.filter(expense => expense.sourceType !== 'time_entry' || expense.sourceId !== id),
    }));
    void dataService.timeEntries.delete(id).catch(() => undefined);
    void dataService.expenses.delete(`expense-time-${id}`).catch(() => undefined);
    if (entry) recalcJobCosts(entry.jobId);
  };

  const addExpense = (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExpense: Expense = {
      sourceType: 'manual',
      reimbursable: expense.costTreatment === 'reimbursable',
      ...expense,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, expenses: [...prev.expenses, newExpense] }));
    void dataService.expenses.create(newExpense).catch(() => undefined);
    recalcJobCosts(expense.jobId);
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    const currentExpense = data.expenses.find(e => e.id === id);
    const affectedJobIds = Array.from(new Set([currentExpense?.jobId, updates.jobId].filter(Boolean) as string[]));
    setData(prev => ({
      ...prev,
      expenses: prev.expenses.map(e => e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e),
    }));
    void dataService.expenses.update(id, updates).catch(() => undefined);
    affectedJobIds.forEach(jobId => recalcJobCosts(jobId));
  };

  const deleteExpense = (id: string) => {
    const expense = data.expenses.find(e => e.id === id);
    setData(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => e.id !== id),
    }));
    void dataService.expenses.delete(id).catch(() => undefined);
    if (expense) recalcJobCosts(expense.jobId);
  };

  const addCompanyExpense = (expense: Omit<CompanyExpense, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newExpense: CompanyExpense = { ...expense, id, createdAt: now, updatedAt: now };
    setData(prev => ({ ...prev, companyExpenses: [...(prev.companyExpenses || []), newExpense] }));
    return id;
  };

  const updateCompanyExpense = (id: string, updates: Partial<CompanyExpense>) => {
    setData(prev => ({
      ...prev,
      companyExpenses: (prev.companyExpenses || []).map(expense =>
        expense.id === id ? { ...expense, ...updates, updatedAt: new Date().toISOString() } : expense
      ),
    }));
  };

  const deleteCompanyExpense = (id: string) => {
    setData(prev => ({
      ...prev,
      companyExpenses: (prev.companyExpenses || []).filter(expense => expense.id !== id),
    }));
  };

  const addInvoice = (invoice: Omit<Invoice, 'id' | 'createdAt'>) => {
    const job = data.jobs.find(j => j.id === invoice.jobId);
    const estimate = data.estimates.find(item => item.id === (invoice.estimateId || job?.estimateId));
    const taxable = invoice.taxable ?? estimate?.taxable ?? 'none';
    const taxRate = invoice.taxRate ?? branding.defaultTaxRate ?? 0;
    const subtotal = Number(invoice.subtotal ?? invoice.amount ?? 0);
    const tax = invoice.tax ?? calculateTax(subtotal, taxable, taxRate);
    const total = invoice.total ?? subtotal + tax;
    const newInvoice: Invoice = {
      ...invoice,
      customerId: invoice.customerId || job?.customerId,
      estimateId: invoice.estimateId || job?.estimateId,
      amount: total,
      subtotal,
      tax,
      taxRate,
      taxable,
      total,
      balanceDue: invoice.balanceDue ?? Math.max(total - (invoice.paidAmount || 0), 0),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const followUpTask: Task = {
      id: crypto.randomUUID(),
      title: `Follow up on ${newInvoice.invoiceNumber}`,
      description: 'Invoice payment follow-up.',
      dueDate: newInvoice.dueDate,
      customerId: newInvoice.customerId,
      estimateId: newInvoice.estimateId,
      jobId: newInvoice.jobId,
      invoiceId: newInvoice.id,
      priority: newInvoice.type === 'deposit' ? 'high' : 'medium',
      status: 'open',
      taskType: 'follow_up',
      assignmentRole: 'office',
      sourceType: 'manual',
      sourceId: newInvoice.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, invoices: [...prev.invoices, newInvoice], tasks: [...prev.tasks, followUpTask] }));
    void dataService.invoices.createWithItems(newInvoice, [{
      invoiceId: newInvoice.id,
      name: newInvoice.invoiceNumber,
      description: newInvoice.notes,
      quantity: 1,
      unit: 'ea',
      unitPrice: newInvoice.total ?? newInvoice.amount,
      total: newInvoice.total ?? newInvoice.amount,
      sourceType: 'invoice',
      sourceId: newInvoice.id,
    }]).catch(() => undefined);
    void dataService.tasks.create(followUpTask).catch(() => undefined);
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setData(prev => ({
      ...prev,
      invoices: prev.invoices.map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i),
    }));
    void dataService.invoices.update(id, updates).catch(() => undefined);
  };

  const deleteInvoice = (id: string) => {
    const linkedPayments = data.payments.filter(payment => payment.invoiceId === id);
    setData(prev => ({
      ...prev,
      invoices: prev.invoices.filter(i => i.id !== id),
      payments: prev.payments.filter(p => p.invoiceId !== id),
    }));
    void dataService.invoices.delete(id).catch(() => undefined);
    linkedPayments.forEach(payment => void dataService.payments.delete(payment.id).catch(() => undefined));
  };

  const addPayment = (payment: Omit<Payment, 'id' | 'createdAt'>) => {
    const invoice = data.invoices.find(i => i.id === payment.invoiceId);
    const newPayment: Payment = {
      ...payment,
      jobId: payment.jobId || invoice?.jobId,
      customerId: payment.customerId || invoice?.customerId || (invoice ? data.jobs.find(job => job.id === invoice.jobId)?.customerId : undefined),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const existingPayments = data.payments.filter(item => item.invoiceId === payment.invoiceId);
    const paidAmount = existingPayments.reduce((sum, item) => sum + item.amount, 0) + newPayment.amount;
    const invoiceTotal = invoice ? (invoice.total ?? invoice.amount) : 0;
    const balanceDue = Math.max(invoiceTotal - paidAmount, 0);
    const status: Invoice['status'] = balanceDue <= 0 && invoiceTotal > 0 ? 'paid' : paidAmount > 0 ? 'partially_paid' : invoice?.status || 'sent';
    setData(prev => ({
      ...prev,
      payments: [...prev.payments, newPayment],
      invoices: prev.invoices.map(item => item.id === payment.invoiceId ? { ...item, paidAmount, balanceDue, status, updatedAt: new Date().toISOString() } : item),
      tasks: prev.tasks.map(task => task.invoiceId === payment.invoiceId && task.status !== 'done' ? { ...task, status: 'done', updatedAt: new Date().toISOString() } : task),
    }));
    void dataService.invoices.recordPayment(newPayment.invoiceId, newPayment).catch(() => undefined);
  };

  const deletePayment = (id: string) => {
    const payment = data.payments.find(item => item.id === id);
    const invoice = payment ? data.invoices.find(item => item.id === payment.invoiceId) : undefined;
    const remainingPaidAmount = payment && invoice
      ? data.payments.filter(item => item.invoiceId === invoice.id && item.id !== id).reduce((sum, item) => sum + item.amount, 0)
      : 0;
    const remainingBalanceDue = invoice ? Math.max((invoice.total ?? invoice.amount) - remainingPaidAmount, 0) : 0;
    const remainingStatus: Invoice['status'] = invoice
      ? remainingBalanceDue <= 0 && (invoice.total ?? invoice.amount) > 0 ? 'paid' : remainingPaidAmount > 0 ? 'partially_paid' : 'sent'
      : 'sent';
    setData(prev => ({
      ...prev,
      payments: prev.payments.filter(p => p.id !== id),
      invoices: payment ? prev.invoices.map(invoice => {
        if (invoice.id !== payment.invoiceId) return invoice;
        return { ...invoice, paidAmount: remainingPaidAmount, balanceDue: remainingBalanceDue, status: remainingStatus, updatedAt: new Date().toISOString() };
      }) : prev.invoices,
    }));
    if (payment) {
      void dataService.payments.delete(id).catch(() => undefined);
      void dataService.invoices.update(payment.invoiceId, {
        paidAmount: remainingPaidAmount,
        balanceDue: remainingBalanceDue,
        status: remainingStatus,
      }).catch(() => undefined);
    }
  };

  const addNote = (note: Omit<NoteType, 'id' | 'createdAt'>) => {
    const newNote: NoteType = {
      ...note,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, notes: [...prev.notes, newNote] }));
  };

  const deleteNote = (id: string) => {
    setData(prev => ({
      ...prev,
      notes: prev.notes.filter(n => n.id !== id),
    }));
  };

  const addPhoto = (photo: Omit<PhotoType, 'id' | 'createdAt'>) => {
    const newPhoto: PhotoType = {
      ...photo,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, photos: [...prev.photos, newPhoto] }));
  };

  const deletePhoto = (id: string) => {
    setData(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== id),
    }));
  };

  const addChangeOrder = (co: Omit<ChangeOrderType, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newCO: ChangeOrderType = {
      ...co,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    setData(prev => ({ ...prev, changeOrders: [...prev.changeOrders, newCO] }));
    void dataService.changeOrders.create(newCO).catch(() => undefined);
  };

  const updateChangeOrder = (id: string, updates: Partial<ChangeOrderType>) => {
    setData(prev => ({
      ...prev,
      changeOrders: prev.changeOrders.map(co => 
        co.id === id ? { ...co, ...updates, updatedAt: new Date().toISOString() } : co
      ),
    }));
    void dataService.changeOrders.update(id, updates).catch(() => undefined);
  };

  const deleteChangeOrder = (id: string) => {
    setData(prev => ({
      ...prev,
      changeOrders: prev.changeOrders.filter(co => co.id !== id),
    }));
    void dataService.changeOrders.delete(id).catch(() => undefined);
  };

const approveChangeOrder = (id: string) => {
    const co = data.changeOrders.find(c => c.id === id);
    if (!co || co.status !== 'pending') return;

    updateChangeOrder(id, { status: 'approved' });

    const job = data.jobs.find(j => j.id === co.jobId);
    if (job) {
      updateJob(co.jobId, { contractAmount: job.contractAmount + co.amount });
    }
    recalcJobCosts(co.jobId);
  };

  const addTimelineEntry = (entry: Omit<JobTimelineEntry, 'id'>) => {
    setData(prev => ({
      ...prev,
      timeline: [...(prev.timeline || []), { ...entry, id: crypto.randomUUID() }],
    }));
  };

  const updateTimelineEntry = (id: string, updates: Partial<JobTimelineEntry>) => {
    setData(prev => ({
      ...prev,
      timeline: (prev.timeline || []).map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  };

  const deleteTimelineEntry = (id: string) => {
    setData(prev => ({
      ...prev,
      timeline: (prev.timeline || []).filter(e => e.id !== id),
    }));
  };

  const addJobLog = (log: Omit<JobLog, 'id' | 'createdAt'>) => {
    setData(prev => ({
      ...prev,
      jobLogs: [...(prev.jobLogs || []), { ...log, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
    }));
  };

  const updateJobLog = (id: string, updates: Partial<JobLog>) => {
    setData(prev => ({
      ...prev,
      jobLogs: (prev.jobLogs || []).map(l => l.id === id ? { ...l, ...updates } : l),
    }));
  };

  const deleteJobLog = (id: string) => {
    setData(prev => ({
      ...prev,
      jobLogs: (prev.jobLogs || []).filter(l => l.id !== id),
    }));
  };

  const addPunchListItem = (item: Omit<PunchListItem, 'id' | 'createdAt'>) => {
    setData(prev => ({
      ...prev,
      punchLists: [...(prev.punchLists || []), { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
    }));
  };

  const updatePunchListItem = (id: string, updates: Partial<PunchListItem>) => {
    setData(prev => ({
      ...prev,
      punchLists: (prev.punchLists || []).map(p => p.id === id ? { ...p, ...updates } : p),
    }));
  };

  const deletePunchListItem = (id: string) => {
    setData(prev => ({
      ...prev,
      punchLists: (prev.punchLists || []).filter(p => p.id !== id),
    }));
  };

  const addJobIssue = (issue: Omit<JobIssue, 'id' | 'createdAt'>) => {
    setData(prev => ({
      ...prev,
      jobIssues: [...(prev.jobIssues || []), { ...issue, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
    }));
  };

  const updateJobIssue = (id: string, updates: Partial<JobIssue>) => {
    setData(prev => ({
      ...prev,
      jobIssues: (prev.jobIssues || []).map(i => {
        if (i.id !== id) return i;
        const updated = { ...i, ...updates };
        if (updates.status === 'resolved') {
          updated.resolvedAt = new Date().toISOString();
        }
        return updated;
      }),
    }));
  };

  const deleteJobIssue = (id: string) => {
    setData(prev => ({
      ...prev,
      jobIssues: (prev.jobIssues || []).filter(i => i.id !== id),
    }));
  };

  const addFileAttachment = (file: Omit<FileAttachment, 'id' | 'createdAt'>) => {
    setData(prev => ({
      ...prev,
      fileAttachments: [...(prev.fileAttachments || []), { ...file, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
    }));
  };

  const updateFileAttachment = (id: string, updates: Partial<FileAttachment>) => {
    setData(prev => ({
      ...prev,
      fileAttachments: (prev.fileAttachments || []).map(f => f.id === id ? { ...f, ...updates } : f),
    }));
  };

  const deleteFileAttachment = (id: string) => {
    setData(prev => ({
      ...prev,
      fileAttachments: (prev.fileAttachments || []).filter(f => f.id !== id),
    }));
  };

  const addSignatureRequest = (request: Omit<SignatureRequest, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'auditTrail'> & { status?: SignatureRequest['status']; auditTrail?: SignatureRequest['auditTrail'] }) => {
    const now = new Date().toISOString();
    const newRequest: SignatureRequest = {
      ...request,
      id: crypto.randomUUID(),
      status: request.status || 'sent',
      auditTrail: request.auditTrail || [{ event: request.status === 'draft' ? 'draft_created' : 'request_sent', timestamp: now, actor: 'internal' }],
      createdAt: now,
      updatedAt: now,
    };
    setData(prev => ({ ...prev, signatureRequests: [...(prev.signatureRequests || []), newRequest] }));
    void dataService.signatureRequests.create(newRequest).catch(() => undefined);
    return newRequest.id;
  };

  const updateSignatureRequest = (id: string, updates: Partial<SignatureRequest>) => {
    const updatedAt = new Date().toISOString();
    setData(prev => ({
      ...prev,
      signatureRequests: (prev.signatureRequests || []).map(request => request.id === id ? { ...request, ...updates, updatedAt } : request),
    }));
    void dataService.signatureRequests.update(id, { ...updates, updatedAt }).catch(() => undefined);
  };

  const deleteSignatureRequest = (id: string) => {
    setData(prev => ({
      ...prev,
      signatureRequests: (prev.signatureRequests || []).filter(request => request.id !== id),
    }));
    void dataService.signatureRequests.delete(id).catch(() => undefined);
  };

  const addJobTemplate = (template: Omit<JobTemplateType, 'id' | 'createdAt'>) => {
    const newTemplate: JobTemplateType = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, jobTemplates: [...prev.jobTemplates, newTemplate] }));
  };

  const updateJobTemplate = (id: string, updates: Partial<JobTemplateType>) => {
    setData(prev => ({
      ...prev,
      jobTemplates: prev.jobTemplates.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
  };

  const deleteJobTemplate = (id: string) => {
    setData(prev => ({
      ...prev,
      jobTemplates: prev.jobTemplates.filter(t => t.id !== id),
    }));
  };

  const createJobFromTemplate = (templateId: string, name: string, address: string, customer: string) => {
    const template = data.jobTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    const jobId = addJob({
      name,
      customerId: '',
      customer,
      address,
      type: template.type,
      contractAmount: template.estimatedCost,
      estimatedCost: template.estimatedCost,
      startDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      status: 'lead',
    });
    
    template.tasks.forEach(task => {
      addTask({ title: task.title, description: task.description, jobId, priority: task.priority, status: 'open' });
    });
  };

  const markAlertRead = (id: string) => {
    setData(prev => ({
      ...prev,
      alerts: prev.alerts.map(a => a.id === id ? { ...a, isRead: true } : a),
    }));
  };

  const clearAllAlerts = () => {
    setData(prev => ({
      ...prev,
      alerts: prev.alerts.map(a => ({ ...a, isRead: true })),
    }));
  };

  const addSupplier = (supplier: Omit<Supplier, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    setData(prev => {
      const existing = supplier.isDefault ? (prev.suppliers || []).map(item => ({ ...item, isDefault: false })) : (prev.suppliers || []);
      return { ...prev, suppliers: [...existing, { ...supplier, id, createdAt: new Date().toISOString() }] };
    });
    return id;
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setData(prev => ({ ...prev, suppliers: (prev.suppliers || []).map(s => {
      if (updates.isDefault && s.id !== id) return { ...s, isDefault: false };
      return s.id === id ? { ...s, ...updates } : s;
    }) }));
  };

  const deleteSupplier = (id: string) => {
    setData(prev => ({ ...prev, suppliers: (prev.suppliers || []).filter(s => s.id !== id) }));
  };

  const addMaterialOrder = (order: Omit<MaterialOrder, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    setData(prev => {
      const job = order.jobId ? prev.jobs.find(item => item.id === order.jobId) : undefined;
      const newOrder = { ...order, id, customerId: order.customerId || job?.customerId, createdAt: now };
      const task: Task | null = order.jobId ? {
        id: crypto.randomUUID(),
        title: `Track material order ${order.poNumber}`,
        description: order.supplierName ? `Confirm status with ${order.supplierName}.` : 'Confirm supplier status and delivery date.',
        dueDate: order.expectedDate,
        customerId: newOrder.customerId,
        estimateId: order.estimateId || job?.estimateId,
        jobId: order.jobId,
        orderId: id,
        priority: 'medium',
        status: 'open',
        taskType: 'order',
        assignmentRole: 'office',
        sourceType: 'order',
        sourceId: id,
        createdAt: now,
        updatedAt: now,
      } : null;
      return { ...prev, materialOrders: [...(prev.materialOrders || []), newOrder], tasks: task ? [...prev.tasks, task] : prev.tasks };
    });
    return id;
  };

  const updateMaterialOrder = (id: string, updates: Partial<MaterialOrder>) => {
    setData(prev => {
      const existing = (prev.materialOrders || []).find(order => order.id === id);
      const updated = existing ? { ...existing, ...updates, updatedAt: new Date().toISOString() } : undefined;
      const shouldCreateExpense = updated && updated.jobId && updated.status === 'received' && existing?.status !== 'received' && !prev.expenses.some(expense => expense.sourceType === 'material_order' && expense.sourceId === id);
      const expense: Expense | null = shouldCreateExpense && updated ? {
        id: crypto.randomUUID(),
        jobId: updated.jobId!,
        date: updated.receivedDate || new Date().toISOString().split('T')[0],
        vendor: updated.supplierName || 'Material order',
        amount: updated.total,
        category: 'materials',
        source: 'order',
        sourceType: 'material_order',
        sourceId: id,
        expenseType: 'material',
        costTreatment: 'contractor_cost',
        reimbursable: false,
        paymentSource: 'company_card',
        notes: `source: material_order\nPO: ${updated.poNumber}`,
        createdAt: new Date().toISOString(),
      } : null;
      const expenses = expense ? [...prev.expenses, expense] : prev.expenses;
      const jobs = expense ? prev.jobs.map(job => {
        if (job.id !== expense.jobId) return job;
        const laborCost = prev.timeEntries.filter(entry => entry.jobId === job.id).reduce((sum, entry) => sum + entry.laborCost, 0);
        const expenseCost = expenses.filter(item => item.jobId === job.id && expenseAffectsJobCost(item)).reduce((sum, item) => sum + item.amount, 0);
        return { ...job, actualCost: laborCost + expenseCost, updatedAt: new Date().toISOString() };
      }) : prev.jobs;
      return {
        ...prev,
        jobs,
        expenses,
        tasks: updated?.status === 'received' ? prev.tasks.map(task => task.orderId === id && task.status !== 'done' ? { ...task, status: 'done', updatedAt: new Date().toISOString() } : task) : prev.tasks,
        materialOrders: (prev.materialOrders || []).map(order => order.id === id ? { ...order, ...updates, updatedAt: new Date().toISOString() } : order),
      };
    });
  };

  const deleteMaterialOrder = (id: string) => {
    setData(prev => ({ ...prev, materialOrders: (prev.materialOrders || []).filter(o => o.id !== id) }));
  };

  const addShoppingList = (list: Omit<ShoppingList, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    setData(prev => {
      const job = prev.jobs.find(item => item.id === list.jobId);
      return { ...prev, shoppingLists: [...(prev.shoppingLists || []), { ...list, id, customerId: list.customerId || job?.customerId, estimateId: list.estimateId || job?.estimateId, createdAt: new Date().toISOString() }] };
    });
    return id;
  };

  const updateShoppingList = (id: string, updates: Partial<ShoppingList>) => {
    setData(prev => ({
      ...prev,
      shoppingLists: (prev.shoppingLists || []).map(list => list.id === id ? { ...list, ...updates } : list),
    }));
  };

  const deleteShoppingList = (id: string) => {
    setData(prev => ({
      ...prev,
      shoppingLists: (prev.shoppingLists || []).filter(list => list.id !== id),
      receipts: (prev.receipts || []).filter(receipt => receipt.shoppingListId !== id),
    }));
  };

  const addShoppingListItem = (listId: string, item: Omit<ShoppingListItem, 'id'>) => {
    setData(prev => ({
      ...prev,
      shoppingLists: (prev.shoppingLists || []).map(list => list.id === listId
        ? { ...list, items: [...list.items, { ...item, id: crypto.randomUUID() }] }
        : list),
    }));
  };

  const updateShoppingListItem = (listId: string, itemId: string, updates: Partial<ShoppingListItem>) => {
    setData(prev => ({
      ...prev,
      shoppingLists: (prev.shoppingLists || []).map(list => list.id === listId
        ? { ...list, items: list.items.map(item => item.id === itemId ? { ...item, ...updates } : item) }
        : list),
    }));
  };

  const deleteShoppingListItem = (listId: string, itemId: string) => {
    setData(prev => ({
      ...prev,
      shoppingLists: (prev.shoppingLists || []).map(list => list.id === listId
        ? { ...list, items: list.items.filter(item => item.id !== itemId) }
        : list),
    }));
  };

  const addShoppingReceipt = (receipt: Omit<Receipt, 'id'>) => {
    const id = crypto.randomUUID();
    const expenseId = crypto.randomUUID();
    const now = new Date().toISOString();
    setData(prev => {
      const list = (prev.shoppingLists || []).find(item => item.id === receipt.shoppingListId);
      const reimbursableTotal = list?.items.reduce((sum, item) => {
        if (item.allowanceId && item.allowanceHandling !== 'contractor_paid_reimbursable') return sum;
        return sum + (item.actualCost || item.estimatedCost || 0);
      }, 0) || receipt.total;
      const receipts = [...(prev.receipts || []), { ...receipt, id, expenseId, customerId: receipt.customerId || list?.customerId }];
      const expense: Expense = {
        id: expenseId,
        jobId: receipt.jobId,
        date: receipt.date,
        vendor: receipt.vendor,
        amount: reimbursableTotal,
        category: 'materials',
        source: 'shopping_list',
        sourceType: 'shopping_list',
        sourceId: receipt.shoppingListId,
        expenseType: 'material',
        costTreatment: reimbursableTotal !== receipt.total ? 'allowance' : 'contractor_cost',
        reimbursable: list?.items.some(item => item.allowanceHandling === 'contractor_paid_reimbursable') || false,
        allowanceId: list?.items.find(item => item.allowanceId)?.allowanceId,
        paymentSource: 'company_card',
        receipt: receipt.imageUrl,
        notes: [`source: shopping_list_receipt`, receipt.notes, `Shopping list receipt ${id}`, reimbursableTotal !== receipt.total ? 'Client allowance/client direct items excluded from contractor cost.' : ''].filter(Boolean).join('\n'),
        createdAt: now,
      };
      const expenses = reimbursableTotal > 0 ? [...prev.expenses, expense] : prev.expenses;
      const jobEntries = prev.timeEntries.filter(entry => entry.jobId === receipt.jobId);
      const jobExpenses = expenses.filter(item => item.jobId === receipt.jobId && expenseAffectsJobCost(item));
      const actualCost = jobEntries.reduce((sum, entry) => sum + entry.laborCost, 0) + jobExpenses.reduce((sum, item) => sum + item.amount, 0);
      return {
        ...prev,
        receipts,
        expenses,
        jobs: prev.jobs.map(job => job.id === receipt.jobId ? { ...job, actualCost, updatedAt: now } : job),
        shoppingLists: (prev.shoppingLists || []).map(list => list.id === receipt.shoppingListId
          ? { ...list, status: 'completed', completedAt: receipt.date, items: list.items.map(item => ({ ...item, purchased: true })) }
          : list),
      };
    });
    return id;
  };

  const getAllowanceStatus = (allowanceAmount: number, usedAmount: number) => {
    if (usedAmount > allowanceAmount) return 'over_limit' as const;
    if (allowanceAmount > 0 && usedAmount >= allowanceAmount * 0.8) return 'near_limit' as const;
    return 'under' as const;
  };

  const normalizeAllowance = (allowance: Allowance): Allowance => {
    const usedAmount = allowance.selections.reduce((sum, selection) => sum + selection.total, 0);
    const remainingAmount = allowance.allowanceAmount - usedAmount;
    return {
      ...allowance,
      usedAmount,
      remainingAmount,
      status: getAllowanceStatus(allowance.allowanceAmount, usedAmount),
      affectsContractorCost: allowance.affectsContractorCost === true,
    };
  };

  const addAllowance = (allowance: Omit<Allowance, 'id' | 'usedAmount' | 'remainingAmount' | 'status' | 'selections'> & { selections?: AllowanceSelection[] }) => {
    const id = crypto.randomUUID();
    const newAllowance = normalizeAllowance({
      ...allowance,
      id,
      usedAmount: 0,
      remainingAmount: allowance.allowanceAmount,
      status: 'under',
      affectsContractorCost: allowance.affectsContractorCost === true,
      selections: allowance.selections || [],
    });
    setData(prev => ({ ...prev, allowances: [...(prev.allowances || []), newAllowance] }));
    return id;
  };

  const updateAllowance = (id: string, updates: Partial<Allowance>) => {
    setData(prev => ({
      ...prev,
      allowances: (prev.allowances || []).map(allowance => allowance.id === id ? normalizeAllowance({ ...allowance, ...updates }) : allowance),
    }));
  };

  const deleteAllowance = (id: string) => {
    setData(prev => ({ ...prev, allowances: (prev.allowances || []).filter(allowance => allowance.id !== id) }));
  };

  const addAllowanceSelection = (allowanceId: string, selection: Omit<AllowanceSelection, 'id' | 'allowanceId'>, reimbursable = false) => {
    const newSelection: AllowanceSelection = { ...selection, id: crypto.randomUUID(), allowanceId };
    setData(prev => {
      const allowance = (prev.allowances || []).find(item => item.id === allowanceId);
      const allowances = (prev.allowances || []).map(item => item.id === allowanceId
        ? normalizeAllowance({ ...item, selections: [...item.selections, newSelection] })
        : item);
      const expenses = reimbursable && allowance ? [...prev.expenses, {
        id: crypto.randomUUID(),
        jobId: allowance.jobId,
        date: selection.date,
        vendor: selection.vendor || 'Allowance selection',
        amount: selection.total,
        category: 'materials' as const,
        source: 'allowance' as const,
        sourceType: 'allowance' as const,
        sourceId: allowanceId,
        expenseType: 'allowance' as const,
        costTreatment: 'reimbursable' as const,
        reimbursable: true,
        allowanceId,
        paymentSource: 'company_card' as const,
        receipt: selection.receiptAttachment,
        notes: `source: reimbursable_allowance\nAllowance: ${allowance.name}\n${selection.notes || ''}`,
        createdAt: new Date().toISOString(),
      }] : prev.expenses;
      const jobId = allowance?.jobId;
      const jobs = jobId ? prev.jobs.map(job => {
        if (job.id !== jobId) return job;
        const laborCost = prev.timeEntries.filter(entry => entry.jobId === jobId).reduce((sum, entry) => sum + entry.laborCost, 0);
        const expenseCost = expenses.filter(expense => expense.jobId === jobId && expenseAffectsJobCost(expense)).reduce((sum, expense) => sum + expense.amount, 0);
        return { ...job, actualCost: laborCost + expenseCost, updatedAt: new Date().toISOString() };
      }) : prev.jobs;
      return { ...prev, allowances, expenses, jobs };
    });
  };

  const updateAllowanceSelection = (allowanceId: string, selectionId: string, updates: Partial<AllowanceSelection>) => {
    setData(prev => ({
      ...prev,
      allowances: (prev.allowances || []).map(allowance => allowance.id === allowanceId
        ? normalizeAllowance({ ...allowance, selections: allowance.selections.map(selection => selection.id === selectionId ? { ...selection, ...updates } : selection) })
        : allowance),
    }));
  };

  const createAllowanceOverageChangeOrder = (allowanceId: string) => {
    const allowance = (data.allowances || []).find(item => item.id === allowanceId);
    if (!allowance || allowance.remainingAmount >= 0) return;
    addChangeOrder({
      jobId: allowance.jobId,
      description: `${allowance.name} allowance overage`,
      amount: Math.abs(allowance.remainingAmount),
      status: 'pending',
    });
  };

  const {
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerById,
    getJobCustomer,
    getEstimateCustomer,
  } = useCustomers({ data, setData });

  const {
    addLaborRate,
    updateLaborRate,
    deleteLaborRate,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addAssembly,
    updateAssembly,
    deleteAssembly,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    addProjectTypeTemplate,
    updateProjectTypeTemplate,
    deleteProjectTypeTemplate,
    getProjectTypeTemplate,
  } = useCatalog({ data, setData });

  const {
    addEstimate,
    updateEstimate,
    deleteEstimate,
    duplicateEstimate,
    archiveEstimate,
    convertEstimateToJob,
  } = useEstimates({
    data,
    setData,
    addJob,
    addTask,
    addAllowance,
    addShoppingList,
    addMaterialOrder,
  });

  const visibleData = useMemo(() => sanitizeAppDataForRole(data, profile), [data, profile]);
  const contextActions = useStableActions({
    syncCoreDataToSupabase,
    importLocalDataToSupabase,
    updateBranding,
    updateDailyCommandProgress,
    updateSmtpSettings,
    sendEmail,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addEstimate,
    updateEstimate,
    deleteEstimate,
    duplicateEstimate,
    archiveEstimate,
    convertEstimateToJob,
    addLaborRate,
    updateLaborRate,
    deleteLaborRate,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addAssembly,
    updateAssembly,
    deleteAssembly,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    addProjectTypeTemplate,
    updateProjectTypeTemplate,
    deleteProjectTypeTemplate,
    getProjectTypeTemplate,
    addJob,
    updateJob,
    deleteJob,
    duplicateJob,
    addWorker,
    updateWorker,
    deleteWorker,
    addTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    addExpense,
    updateExpense,
    deleteExpense,
    addCompanyExpense,
    updateCompanyExpense,
    deleteCompanyExpense,
    addTask,
    updateTask,
    deleteTask,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addPayment,
    deletePayment,
    addNote,
    deleteNote,
    addPhoto,
    deletePhoto,
    addChangeOrder,
    updateChangeOrder,
    deleteChangeOrder,
    approveChangeOrder,
    addJobTemplate,
    updateJobTemplate,
    deleteJobTemplate,
    createJobFromTemplate,
    markAlertRead,
    clearAllAlerts,
    getJobLaborCost,
    getJobExpenseTotal,
    getJobChangeOrderTotal,
    getJobActualCost,
    getJobProfit,
    getJobBalance,
    getJobProgress,
    getCustomerById,
    getJobCustomer,
    getEstimateCustomer,
    addTimelineEntry,
    updateTimelineEntry,
    deleteTimelineEntry,
    addJobLog,
    updateJobLog,
    deleteJobLog,
    addPunchListItem,
    updatePunchListItem,
    deletePunchListItem,
    addJobIssue,
    updateJobIssue,
    deleteJobIssue,
    addFileAttachment,
    updateFileAttachment,
    deleteFileAttachment,
    addSignatureRequest,
    updateSignatureRequest,
    deleteSignatureRequest,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addMaterialOrder,
    updateMaterialOrder,
    deleteMaterialOrder,
    addShoppingList,
    updateShoppingList,
    deleteShoppingList,
    addShoppingListItem,
    updateShoppingListItem,
    deleteShoppingListItem,
    addShoppingReceipt,
    addAllowance,
    updateAllowance,
    deleteAllowance,
    addAllowanceSelection,
    updateAllowanceSelection,
    createAllowanceOverageChangeOrder,
  });

  const contextValue = useMemo<AppContextType>(() => ({
      data: visibleData,
      setData,
      dataServiceStatus,
      branding,
      dailyCommandProgress: visibleData.dailyCommandProgress || DEFAULT_DAILY_COMMAND_PROGRESS,
      smtpSettings,
      customers: visibleData.customers,
      estimates: visibleData.estimates,
      laborRates: visibleData.laborRates,
      materials: visibleData.materials,
      assemblies: visibleData.assemblies,
      templates: visibleData.templates,
      projectTypeTemplates: visibleData.projectTypeTemplates,
      jobs: visibleData.jobs,
      workers: visibleData.workers,
      timeEntries: visibleData.timeEntries,
      expenses: visibleData.expenses,
      companyExpenses: visibleData.companyExpenses || [],
      tasks: visibleData.tasks,
      invoices: visibleData.invoices,
      payments: visibleData.payments,
      notes: visibleData.notes,
      photos: visibleData.photos,
      changeOrders: visibleData.changeOrders,
      jobTemplates: visibleData.jobTemplates,
      alerts: visibleData.alerts,
      timeline: visibleData.timeline || [],
      jobLogs: visibleData.jobLogs || [],
      punchLists: visibleData.punchLists || [],
      jobIssues: visibleData.jobIssues || [],
      fileAttachments: visibleData.fileAttachments || [],
      signatureRequests: visibleData.signatureRequests || [],
      suppliers: visibleData.suppliers || [],
      materialOrders: visibleData.materialOrders || [],
      shoppingLists: visibleData.shoppingLists || [],
      receipts: visibleData.receipts || [],
      allowances: visibleData.allowances || [],
      ...contextActions,
    }), [branding, contextActions, dataServiceStatus, setData, smtpSettings, visibleData]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
