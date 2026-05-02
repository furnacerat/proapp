import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import type { AppData, Job, Worker, TimeEntry, Expense, CompanyExpense, Task, Invoice, Payment, Note, Photo, ChangeOrder, JobTemplate, Alert, Note as NoteType, Photo as PhotoType, ChangeOrder as ChangeOrderType, JobTemplate as JobTemplateType, Alert as AlertType, Customer, Estimate, EstimateLineItem, EstimateScope, LaborRate, Material, Assembly, Template, ProjectTypeTemplate, ProjectTypeTemplateItem, JobType, BrandingSettings, SmtpSettings, JobTimelineEntry, JobLog, PunchListItem, JobIssue, FileAttachment, Supplier, MaterialOrder, MaterialOrderStatus, ShoppingList, ShoppingListItem, Receipt, Allowance, AllowanceSelection } from '../data/types';
import { generateCompleteSeedData } from '../data/seedData';
import { dataService } from '../services/dataService';
import { useAuth } from './AuthContext';
import { canViewOwnerFinancials, sanitizeAppDataForRole } from '../auth/rbac';
import { calculateTimeEntryLaborCost, expenseAffectsJobCost, getTimeEntryOvertimeHours, timeEntryCostFields } from '../utils/timeEntries';
import { parseDateString } from '../utils/formatters';

interface DataServiceStatus {
  mode: 'local' | 'supabase';
  supabaseConfigured: boolean;
  isSyncing: boolean;
  lastSyncAt?: string;
  syncError?: string;
}

const LOCAL_RESCUE_DONE_KEY = 'buildops_pro_local_rescue_done';

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

interface AppContextType {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  dataServiceStatus: DataServiceStatus;
  syncCoreDataToSupabase: () => Promise<boolean>;
  importLocalDataToSupabase: () => Promise<boolean>;
  branding: BrandingSettings;
  updateBranding: (updates: Partial<BrandingSettings>) => void;
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
  suppliers: Supplier[];
  materialOrders: MaterialOrder[];
  shoppingLists: ShoppingList[];
  receipts: Receipt[];
  allowances: Allowance[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const normalizeAppData = (raw: AppData): AppData => {
  const data = {
    ...raw,
    photos: raw.photos || [],
    changeOrders: raw.changeOrders || [],
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
    ])
      .then(([customers, estimates, jobs, tasks, workers, expenses, timeEntries, invoices, payments, suppliers, materialOrders, shoppingLists, receipts, allowances, laborRates, materials, assemblies, templates, projectTypeTemplates, notes, photos]) => {
        if (cancelled) return;
        setData(prev => {
          const localData = dataService.local.getAppData();
          const localFallback = localData && !looksLikeDemoData(localData) ? localData : undefined;
          const loadedData = {
            ...prev,
            customers,
            estimates,
            jobs,
            tasks,
            workers,
            expenses,
            timeEntries,
            invoices,
            payments,
            suppliers,
            materialOrders,
            shoppingLists,
            receipts,
            allowances,
            laborRates: laborRates.length ? laborRates : localFallback?.laborRates || prev.laborRates,
            materials: materials.length ? materials : localFallback?.materials || prev.materials,
            assemblies: assemblies.length ? assemblies : localFallback?.assemblies || prev.assemblies,
            templates: templates.length ? templates : localFallback?.templates || prev.templates,
            projectTypeTemplates: projectTypeTemplates.length ? projectTypeTemplates : localFallback?.projectTypeTemplates || prev.projectTypeTemplates,
            notes,
            photos,
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

  useEffect(() => {
    if (dataService.mode !== 'supabase' || !dataService.isSupabaseConfigured || !supabaseInitialLoadComplete.current) return;
    if (!profile?.company_id) return;
    if (looksLikeDemoData(data)) return;
    const sync = () => {
      void dataService.syncWorkspaceDataToSupabase(data)
        .then(() => setDataServiceStatus(prev => ({ ...prev, lastSyncAt: new Date().toISOString(), syncError: undefined })))
        .catch(error => setDataServiceStatus(prev => ({
          ...prev,
          syncError: error instanceof Error ? error.message : 'Supabase sync failed',
        })));
    };
    const syncWhenLeaving = () => sync();
    const syncWhenHidden = () => {
      if (document.visibilityState === 'hidden') sync();
    };
    const timeout = window.setTimeout(sync, 250);
    window.addEventListener('pagehide', syncWhenLeaving);
    document.addEventListener('visibilitychange', syncWhenHidden);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('pagehide', syncWhenLeaving);
      document.removeEventListener('visibilitychange', syncWhenHidden);
    };
  }, [data, profile?.company_id]);

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
  const [branding, setBranding] = useState<BrandingSettings>({
    brandName: "Allen's Contractor's",
    emailFromName: "Allen's Contractor's",
    primaryColor: '#1f3a8a',
    secondaryColor: '#2563eb',
    fontFamily: 'Inter, system-ui, Arial',
    logoUrl: '',
    logoDataUrl: '',
    termsText: '',
    termsUrl: '',
    smartFeaturesEnabled: true,
  } as BrandingSettings);

  const updateBranding = (updates: Partial<BrandingSettings>) => {
    setBranding(prev => ({ ...prev, ...updates }));
  };

  // SMTP settings (global)
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
    host: '', port: 587, user: '', password: '', secure: true,
    fromName: '', fromEmail: '', enabled: false
  });

  const updateSmtpSettings = (updates: Partial<SmtpSettings>) => {
    setSmtpSettings(prev => ({ ...prev, ...updates }));
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

  const recalcJobCosts = (jobId: string) => {
    setData(prev => {
      const job = prev.jobs.find(j => j.id === jobId);
      if (!job) return prev;
      
      const jobEntries = prev.timeEntries.filter(t => t.jobId === jobId);
      const jobExpenses = prev.expenses.filter(e => e.jobId === jobId && expenseAffectsJobCost(e));
      const laborCost = jobEntries.reduce((sum, t) => sum + t.laborCost, 0);
      const expenseCost = jobExpenses.reduce((sum, e) => sum + e.amount, 0);
      const actualCost = laborCost + expenseCost;
      
      const updatedJobs = prev.jobs.map(j =>
        j.id === jobId ? { ...j, actualCost, updatedAt: new Date().toISOString() } : j
      );
      void dataService.jobs.update(jobId, { actualCost } as Partial<Job>).catch(() => undefined);
      
      return { ...prev, jobs: updatedJobs };
    });
  };

  const addJob = (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'actualCost'>) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newJob: Job = { ...job, id, actualCost: 0, createdAt: now, updatedAt: now };
    const starterTask: Task = {
      id: crypto.randomUUID(),
      title: `Confirm next steps for ${job.name}`,
      description: 'Review schedule, materials, and first field action.',
      dueDate: newJob.startDate || now.split('T')[0],
      jobId: id,
      customerId: newJob.customerId,
      estimateId: newJob.estimateId,
      priority: newJob.status === 'active' ? 'high' : 'medium',
      status: 'open',
      taskType: 'task',
      assignmentRole: 'owner',
      sourceType: 'job_creation',
      sourceId: id,
      createdAt: now,
      updatedAt: now,
    };
    setData(prev => ({ ...prev, jobs: [...prev.jobs, newJob], tasks: [...prev.tasks, starterTask] }));
    void dataService.jobs.create(newJob).catch(() => undefined);
    void dataService.tasks.create(starterTask).catch(() => undefined);
    return id;
  };

  const updateJob = (id: string, updates: Partial<Job>) => {
    setData(prev => ({
      ...prev,
      jobs: prev.jobs.map(j => j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j),
    }));
    void dataService.jobs.update(id, updates).catch(() => undefined);
  };

  const deleteJob = (id: string) => {
    setData(prev => ({
      ...prev,
      jobs: prev.jobs.filter(j => j.id !== id),
      timeEntries: prev.timeEntries.filter(t => t.jobId !== id),
      expenses: prev.expenses.filter(e => e.jobId !== id),
      tasks: prev.tasks.filter(t => t.jobId !== id),
      invoices: prev.invoices.filter(i => i.jobId !== id),
      notes: prev.notes.filter(n => n.jobId !== id),
      photos: prev.photos.filter(p => p.jobId !== id),
      changeOrders: prev.changeOrders.filter(co => co.jobId !== id),
      timeline: (prev.timeline || []).filter(t => t.jobId !== id),
      jobLogs: (prev.jobLogs || []).filter(l => l.jobId !== id),
      punchLists: (prev.punchLists || []).filter(p => p.jobId !== id),
      jobIssues: (prev.jobIssues || []).filter(i => i.jobId !== id),
      fileAttachments: (prev.fileAttachments || []).filter(f => f.jobId !== id),
    }));
    void dataService.jobs.delete(id).catch(() => undefined);
  };

  const duplicateJob = (id: string) => {
    const job = data.jobs.find(j => j.id === id);
    if (!job) return;
    
    const newJobId = addJob({
      name: `${job.name} (Copy)`,
      customerId: job.customerId,
      customer: job.customer,
      customerPhone: job.customerPhone,
      customerEmail: job.customerEmail,
      address: job.address,
      type: job.type,
      contractAmount: job.contractAmount,
      estimatedCost: job.estimatedCost,
      startDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      status: 'lead',
      notes: job.notes,
    });
    
    const jobTasks = data.tasks.filter(t => t.jobId === id);
    jobTasks.forEach(task => {
      addTask({
        title: task.title,
        description: task.description,
        jobId: newJobId,
        priority: task.priority,
        status: 'open',
      });
    });
  };

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

  const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const job = task.jobId ? data.jobs.find(item => item.id === task.jobId) : undefined;
    const newTask: Task = {
      taskType: 'task',
      assignmentRole: task.assignedTo ? 'worker' : 'office',
      ...task,
      customerId: task.customerId || job?.customerId,
      estimateId: task.estimateId || job?.estimateId,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    setData(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t),
    }));
  };

  const deleteTask = (id: string) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== id),
    }));
  };

  const addInvoice = (invoice: Omit<Invoice, 'id' | 'createdAt'>) => {
    const job = data.jobs.find(j => j.id === invoice.jobId);
    const newInvoice: Invoice = {
      ...invoice,
      customerId: invoice.customerId || job?.customerId,
      estimateId: invoice.estimateId || job?.estimateId,
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
  };

  const updateChangeOrder = (id: string, updates: Partial<ChangeOrderType>) => {
    setData(prev => ({
      ...prev,
      changeOrders: prev.changeOrders.map(co => 
        co.id === id ? { ...co, ...updates, updatedAt: new Date().toISOString() } : co
      ),
    }));
  };

  const deleteChangeOrder = (id: string) => {
    setData(prev => ({
      ...prev,
      changeOrders: prev.changeOrders.filter(co => co.id !== id),
    }));
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

  const getJobLaborCost = (jobId: string) => 
    !canSeeOwnerFinancials ? 0 :
    data.timeEntries.filter(t => t.jobId === jobId).reduce((sum, t) => sum + t.laborCost, 0);

  const getJobExpenseTotal = (jobId: string) => 
    !canSeeOwnerFinancials ? 0 :
    data.expenses.filter(e => e.jobId === jobId && expenseAffectsJobCost(e)).reduce((sum, e) => sum + e.amount, 0);

  const getJobChangeOrderTotal = (jobId: string) => 
    data.changeOrders.filter(co => co.jobId === jobId && co.status === 'approved').reduce((sum, co) => sum + co.amount, 0);

  const getJobActualCost = (jobId: string) => {
    return getJobLaborCost(jobId) + getJobExpenseTotal(jobId);
  };

  const getJobProfit = (jobId: string) => {
    if (!canSeeOwnerFinancials) return { profit: 0, margin: 0 };
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return { profit: 0, margin: 0 };
    
    const cost = getJobActualCost(jobId);
    const profit = job.contractAmount - cost;
    const margin = job.contractAmount > 0 ? (profit / job.contractAmount) * 100 : 0;
    return { profit, margin };
  };

  const getJobBalance = (jobId: string) => {
    if (!canSeeOwnerFinancials) return 0;
    const jobInvoices = data.invoices.filter(i => i.jobId === jobId);
    const invoiceIds = jobInvoices.map(i => i.id);
    const jobPayments = data.payments.filter(p => invoiceIds.includes(p.invoiceId));
    
    const totalInvoiced = jobInvoices.reduce((sum, i) => sum + i.amount, 0);
    const totalPaid = jobPayments.reduce((sum, p) => sum + p.amount, 0);
    
    return totalInvoiced - totalPaid;
  };

  const getJobProgress = (jobId: string) => {
    const jobTasks = data.tasks.filter(t => t.jobId === jobId);
    if (jobTasks.length === 0) return 0;
    
    const doneTasks = jobTasks.filter(t => t.status === 'done').length;
    return Math.round((doneTasks / jobTasks.length) * 100);
  };

  const addCustomer = (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newCustomer: Customer = { ...customer, id, createdAt: now, updatedAt: now };
    setData(prev => ({ ...prev, customers: [...prev.customers, newCustomer] }));
    return id;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setData(prev => ({
      ...prev,
      customers: prev.customers.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c),
    }));
  };

  const deleteCustomer = (id: string) => {
    setData(prev => ({ ...prev, customers: prev.customers.filter(c => c.id !== id) }));
  };

  const getCustomerById = (id: string) => data.customers.find(c => c.id === id);
  const getJobCustomer = (jobId: string) => {
    const job = data.jobs.find(j => j.id === jobId);
    return job ? data.customers.find(c => c.id === job.customerId) : undefined;
  };
  const getEstimateCustomer = (estimateId: string) => {
    const estimate = data.estimates.find(e => e.id === estimateId);
    return estimate ? data.customers.find(c => c.id === estimate.customerId) : undefined;
  };

  const calculateEstimateTotals = (estimate: Partial<Estimate>) => {
    const allScopes = estimate.scopes || [];
    const legacySections = estimate.sections || [];
    let allItems: EstimateLineItem[] = [];
    const scopeTotals: Record<string, number> = {};
    const lineTotal = (item: EstimateLineItem) => (item.quantity || 0) * (item.unitPrice || 0);
    const isCounted = (item: EstimateLineItem) => !item.isExcluded;
    
    allScopes.forEach(scope => {
      const scopeItems = (scope.sections?.flatMap(s => s.lineItems || []) || []).filter(isCounted);
      allItems = [...allItems, ...scopeItems];
      
      scopeTotals[scope.id] = scopeItems.reduce((sum, i) => sum + lineTotal(i), 0);
    });

    legacySections.forEach(section => {
      allItems = [...allItems, ...(section.lineItems || []).filter(isCounted)];
    });
    
    const laborTotal = allItems.filter(i => i.isLabor || i.category === 'labor').reduce((sum, i) => sum + lineTotal(i), 0);
    const materialTotal = allItems.filter(i => i.category === 'material').reduce((sum, i) => sum + lineTotal(i), 0);
    const equipmentTotal = allItems.filter(i => i.category === 'equipment').reduce((sum, i) => sum + lineTotal(i), 0);
    const subcontractorTotal = allItems.filter(i => i.category === 'subcontractor').reduce((sum, i) => sum + lineTotal(i), 0);
    
    const subtotal = allItems.reduce((sum, i) => sum + lineTotal(i), 0);
    const markupAmount = subtotal * ((estimate.markupPercent || 0) / 100);
    const total = subtotal + markupAmount;
    
    const projectedLaborHours = allItems.filter(i => i.isLabor || i.category === 'labor').reduce((sum, i) => sum + (i.hours || 0), 0);
    const projectedMaterialCost = materialTotal;
    const projectedLaborCost = laborTotal;
    
    return { 
      laborTotal, 
      materialTotal, 
      equipmentTotal, 
      subcontractorTotal,
      subtotal, 
      markupAmount, 
      total, 
      projectedLaborHours,
      projectedMaterialCost,
      projectedLaborCost,
      marginAmount: 0,
      marginPercent: 0,
      scopeTotals
    };
  };

  const addEstimate = (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'laborTotal' | 'materialTotal' | 'equipmentTotal' | 'subcontractorTotal' | 'subtotal' | 'markupAmount' | 'total' | 'projectedLaborHours' | 'projectedMaterialCost' | 'projectedLaborCost' | 'marginAmount' | 'marginPercent'>) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const totals = calculateEstimateTotals({ ...estimate, markupPercent: estimate.markupPercent || 20 });
    const newEstimate: Estimate = { 
      ...estimate, 
      ...totals, 
      id, 
      createdAt: now, 
      updatedAt: now,
      taxable: estimate.taxable || 'none'
    };
    setData(prev => ({ ...prev, estimates: [...prev.estimates, newEstimate] }));
    void dataService.estimates.createWithItems(newEstimate, [
      ...(newEstimate.scopes || []).flatMap(scope => scope.sections.flatMap(section => section.lineItems || [])),
      ...(newEstimate.sections || []).flatMap(section => section.lineItems || []),
    ]).catch(() => undefined);
    return id;
  };

  const updateEstimate = (id: string, updates: Partial<Estimate>) => {
    setData(prev => {
      const existing = prev.estimates.find(e => e.id === id);
      if (!existing) return prev;
      const merged = { ...existing, ...updates };
      const totals = calculateEstimateTotals(merged);
      return {
        ...prev,
        estimates: prev.estimates.map(e => e.id === id ? { ...e, ...updates, ...totals, updatedAt: new Date().toISOString() } : e),
      };
    });
    const existing = data.estimates.find(e => e.id === id);
    if (existing) {
      const merged = { ...existing, ...updates };
      const totals = calculateEstimateTotals(merged);
      const updated = { ...merged, ...totals, updatedAt: new Date().toISOString() };
      void dataService.estimates.updateWithItems(id, updated, [
        ...(updated.scopes || []).flatMap(scope => scope.sections.flatMap(section => section.lineItems || [])),
        ...(updated.sections || []).flatMap(section => section.lineItems || []),
      ]).catch(() => undefined);
    }
  };

  const duplicateEstimate = (id: string) => {
    const estimate = data.estimates.find(e => e.id === id);
    if (!estimate) return '';

    const duplicateSections = (sections: NonNullable<Estimate['sections']> = []) => sections.map(section => ({
      ...section,
      id: crypto.randomUUID(),
      lineItems: section.lineItems?.map(item => ({ ...item, id: crypto.randomUUID() })) || [],
    }));
    
    const newId = addEstimate({
      estimateNumber: `EST-${new Date().getFullYear()}-${String(data.estimates.length + 1).padStart(3, '0')}`,
      customerId: estimate.customerId,
      name: `${estimate.name} (Copy)`,
      address: estimate.address,
      type: estimate.type,
      status: 'draft',
      scopes: estimate.scopes?.map(scope => ({
        ...scope,
        id: crypto.randomUUID(),
        sections: duplicateSections(scope.sections || []),
      })) || [],
      sections: duplicateSections(estimate.sections || []),
      markupPercent: estimate.markupPercent,
      taxable: estimate.taxable,
      notes: estimate.notes,
      validUntil: estimate.validUntil,
    });
    return newId;
  };

  const archiveEstimate = (id: string) => {
    updateEstimate(id, { status: 'archived', archivedAt: new Date().toISOString() });
  };

  const deleteEstimate = (id: string) => {
    setData(prev => ({ ...prev, estimates: prev.estimates.filter(e => e.id !== id) }));
    void dataService.estimates.delete(id).catch(() => undefined);
  };

  const convertEstimateToJob = (estimateId: string, options?: { startDate?: string; dueDate?: string; copyLineItems?: boolean; copyPricing?: boolean; copyNotes?: boolean }) => {
    const estimate = data.estimates.find(e => e.id === estimateId);
    if (!estimate) return '';
    
    const customer = data.customers.find(c => c.id === estimate.customerId);
    const opt = options || {};
    const jobId = addJob({
      name: estimate.name,
      customerId: estimate.customerId,
      customer: customer?.name || '',
      customerPhone: customer?.phone || '',
      customerEmail: customer?.email || '',
      address: estimate.address,
      type: estimate.type,
      contractAmount: opt.copyPricing !== false ? estimate.total : 0,
      estimatedCost: opt.copyPricing !== false ? estimate.subtotal : 0,
      startDate: opt.startDate || new Date().toISOString().split('T')[0],
      dueDate: opt.dueDate || '',
      status: 'active',
      estimateId: estimate.id,
      notes: opt.copyNotes ? estimate.notes : '',
    });
    
    updateEstimate(estimateId, { status: 'converted', convertedToJobId: jobId });
    void dataService.jobs.copyEstimateItemsToJob(jobId, estimateId).catch(() => undefined);
    (estimate.clientAllowances || []).forEach(allowance => {
      addAllowance({
        ...allowance,
        jobId,
        estimateId,
        affectsContractorCost: false,
      });
    });
    const estimateItems = [
      ...(estimate.scopes || []).flatMap(scope => scope.sections.flatMap(section => section.lineItems || [])),
      ...(estimate.sections || []).flatMap(section => section.lineItems || []),
    ];
    const materialItems = estimateItems.filter(item => item.category === 'material' && !item.isExcluded);
    if (materialItems.length > 0) {
      addShoppingList({
        jobId,
        jobName: estimate.name,
        customerId: estimate.customerId,
        estimateId,
        title: `${estimate.name} Material List`,
        status: 'open',
        notes: 'Created from approved estimate during job conversion.',
        items: materialItems.map(item => ({
          id: crypto.randomUUID(),
          name: item.name,
          category: 'material' as const,
          quantity: item.quantity || item.defaultQuantity || 0,
          unit: item.unit,
          estimatedCost: (item.quantity || item.defaultQuantity || 0) * (item.unitCost || item.unitPrice || 0),
          purchased: false,
          urgent: false,
          notes: item.notes,
          linkedPriceBookItemId: item.linkedMaterialId,
          linkedEstimateLineItemId: item.id,
          addOnStatus: 'included_expense' as const,
          allowanceId: item.isAllowance ? item.id : undefined,
        })),
      });
      addMaterialOrder({
        estimateId,
        jobId,
        customerId: estimate.customerId,
        poNumber: `PO-${Date.now().toString().slice(-6)}`,
        status: 'draft',
        items: materialItems.map(item => {
          const quantity = item.quantity || item.defaultQuantity || 0;
          const unitPrice = item.unitCost || item.unitPrice || 0;
          return {
            id: crypto.randomUUID(),
            name: item.name,
            description: item.description,
            quantity,
            unit: item.unit,
            unitPrice,
            category: 'material' as const,
            lineTotal: quantity * unitPrice,
            allowanceId: item.isAllowance ? item.id : undefined,
          };
        }),
        subtotal: materialItems.reduce((sum, item) => {
          const quantity = item.quantity || item.defaultQuantity || 0;
          return sum + quantity * (item.unitCost || item.unitPrice || 0);
        }, 0),
        total: materialItems.reduce((sum, item) => {
          const quantity = item.quantity || item.defaultQuantity || 0;
          return sum + quantity * (item.unitCost || item.unitPrice || 0);
        }, 0),
        notes: 'Draft material order created from approved estimate.',
      });
    }
    [
      { title: 'Collect deposit', priority: 'high' as const, taskType: 'follow_up' as const },
      { title: 'Order materials', priority: 'high' as const, taskType: 'order' as const },
      { title: 'Schedule kickoff / inspection', priority: 'medium' as const, taskType: 'inspection' as const },
      { title: 'Start demo / first work phase', priority: 'medium' as const, taskType: 'task' as const },
    ].forEach(task => addTask({
      title: task.title,
      description: `Auto-created from approved estimate ${estimate.estimateNumber}.`,
      dueDate: new Date().toISOString().split('T')[0],
      customerId: estimate.customerId,
      estimateId,
      jobId,
      priority: task.priority,
      status: 'open',
      taskType: task.taskType,
      assignmentRole: 'office',
      sourceType: 'approved_estimate',
      sourceId: estimateId,
    }));
    return jobId;
  };

  const addLaborRate = (rate: Omit<LaborRate, 'id'>) => {
    const id = crypto.randomUUID();
    const newRate: LaborRate = { ...rate, id };
    setData(prev => ({ ...prev, laborRates: [...prev.laborRates, newRate] }));
    return id;
  };

  const updateLaborRate = (id: string, updates: Partial<LaborRate>) => {
    setData(prev => ({
      ...prev,
      laborRates: prev.laborRates.map(r => r.id === id ? { ...r, ...updates } : r),
    }));
  };

  const deleteLaborRate = (id: string) => {
    setData(prev => ({ ...prev, laborRates: prev.laborRates.filter(r => r.id !== id) }));
  };

  const addMaterial = (material: Omit<Material, 'id'>) => {
    const id = crypto.randomUUID();
    const newMaterial: Material = { ...material, id };
    setData(prev => ({ ...prev, materials: [...prev.materials, newMaterial] }));
    return id;
  };

  const updateMaterial = (id: string, updates: Partial<Material>) => {
    setData(prev => ({
      ...prev,
      materials: prev.materials.map(m => m.id === id ? { ...m, ...updates } : m),
    }));
  };

  const deleteMaterial = (id: string) => {
    setData(prev => ({ ...prev, materials: prev.materials.filter(m => m.id !== id) }));
  };

  const addAssembly = (assembly: Omit<Assembly, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    const newAssembly: Assembly = { ...assembly, id, createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, assemblies: [...prev.assemblies, newAssembly] }));
    return id;
  };

  const updateAssembly = (id: string, updates: Partial<Assembly>) => {
    setData(prev => ({
      ...prev,
      assemblies: prev.assemblies.map(a => a.id === id ? { ...a, ...updates } : a),
    }));
  };

  const deleteAssembly = (id: string) => {
    setData(prev => ({ ...prev, assemblies: prev.assemblies.filter(a => a.id !== id) }));
  };

  const addTemplate = (template: Omit<Template, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    const newTemplate: Template = { ...template, id, createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, templates: [...prev.templates, newTemplate] }));
    return id;
  };

  const updateTemplate = (id: string, updates: Partial<Template>) => {
    setData(prev => ({
      ...prev,
      templates: prev.templates.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
  };

  const deleteTemplate = (id: string) => {
    setData(prev => ({ ...prev, templates: prev.templates.filter(t => t.id !== id) }));
  };

  const addProjectTypeTemplate = (template: Omit<ProjectTypeTemplate, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    const newTemplate: ProjectTypeTemplate = { ...template, id, createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, projectTypeTemplates: [...prev.projectTypeTemplates, newTemplate] }));
    return id;
  };

  const updateProjectTypeTemplate = (id: string, updates: Partial<ProjectTypeTemplate>) => {
    setData(prev => ({
      ...prev,
      projectTypeTemplates: prev.projectTypeTemplates.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
  };

  const deleteProjectTypeTemplate = (id: string) => {
    setData(prev => ({ ...prev, projectTypeTemplates: prev.projectTypeTemplates.filter(t => t.id !== id) }));
  };

  const getProjectTypeTemplate = (projectType: JobType) =>
    data.projectTypeTemplates.find(t => t.projectType === projectType);

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

  const visibleData = useMemo(() => sanitizeAppDataForRole(data, profile), [data, profile]);
  const canSeeOwnerFinancials = canViewOwnerFinancials(role);

  return (
    <AppContext.Provider value={{
      data: visibleData,
      setData,
      dataServiceStatus,
      syncCoreDataToSupabase,
      importLocalDataToSupabase,
      branding,
      updateBranding,
      smtpSettings,
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
      suppliers: visibleData.suppliers || [],
      materialOrders: visibleData.materialOrders || [],
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
      shoppingLists: visibleData.shoppingLists || [],
      receipts: visibleData.receipts || [],
      addAllowance,
      updateAllowance,
      deleteAllowance,
      addAllowanceSelection,
      updateAllowanceSelection,
      createAllowanceOverageChangeOrder,
      allowances: visibleData.allowances || [],
    }}>
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
