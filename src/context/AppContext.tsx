import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import type { AppData, Job, Worker, TimeEntry, Expense, Task, Invoice, Payment, Note, Photo, ChangeOrder, JobTemplate, Alert, Note as NoteType, Photo as PhotoType, ChangeOrder as ChangeOrderType, JobTemplate as JobTemplateType, Alert as AlertType, Customer, Estimate, EstimateLineItem, LaborRate, Material, Assembly, Template } from '../data/types';
import { generateCompleteSeedData } from '../data/seedData';

interface AppContextType {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  
  addEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'laborTotal' | 'materialTotal' | 'equipmentTotal' | 'subtotal' | 'markupAmount' | 'total' | 'projectedLaborHours' | 'projectedProfit'>) => string;
  updateEstimate: (id: string, updates: Partial<Estimate>) => void;
  deleteEstimate: (id: string) => void;
  convertEstimateToJob: (estimateId: string) => string;
  
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
  
  jobs: Job[];
  workers: Worker[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'buildops_pro_data';

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          photos: parsed.photos || [],
          changeOrders: parsed.changeOrders || [],
          jobTemplates: parsed.jobTemplates || [],
          alerts: parsed.alerts || [],
        };
      } catch {
        return generateCompleteSeedData();
      }
    }
    return generateCompleteSeedData();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    generateAlerts();
  }, [data.jobs, data.tasks, data.invoices, data.payments]);

  const generateAlerts = () => {
    const newAlerts: AlertType[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    data.tasks.forEach(task => {
      if (task.dueDate && task.status !== 'done') {
        const due = new Date(task.dueDate);
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
        const due = new Date(job.dueDate);
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
        const due = new Date(inv.dueDate);
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
      const jobExpenses = prev.expenses.filter(e => e.jobId === jobId);
      const jobChangeOrders = prev.changeOrders.filter(co => co.jobId === jobId && co.status === 'approved');
      
      const laborCost = jobEntries.reduce((sum, t) => sum + t.laborCost, 0);
      const expenseCost = jobExpenses.reduce((sum, e) => sum + e.amount, 0);
      const changeOrderCost = jobChangeOrders.reduce((sum, co) => sum + co.amount, 0);
      
      const updatedJobs = prev.jobs.map(j => 
        j.id === jobId ? { ...j, actualCost: laborCost + expenseCost + changeOrderCost, updatedAt: new Date().toISOString() } : j
      );
      
      return { ...prev, jobs: updatedJobs };
    });
  };

  const addJob = (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'actualCost'>) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newJob: Job = { ...job, id, actualCost: 0, createdAt: now, updatedAt: now };
    setData(prev => ({ ...prev, jobs: [...prev.jobs, newJob] }));
    return id;
  };

  const updateJob = (id: string, updates: Partial<Job>) => {
    setData(prev => ({
      ...prev,
      jobs: prev.jobs.map(j => j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j),
    }));
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
    }));
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
    const hours = entry.totalHours;
    const rate = worker?.hourlyRate || 0;
    const laborCost = hours * rate;
    
    const newEntry: TimeEntry = {
      ...entry,
      id: crypto.randomUUID(),
      laborCost,
      createdAt: new Date().toISOString(),
    };
    
    setData(prev => ({ ...prev, timeEntries: [...prev.timeEntries, newEntry] }));
    recalcJobCosts(entry.jobId);
  };

  const updateTimeEntry = (id: string, updates: Partial<TimeEntry>) => {
    setData(prev => {
      const entry = prev.timeEntries.find(t => t.id === id);
      if (!entry) return prev;
      
      let laborCost = entry.laborCost;
      if (updates.totalHours !== undefined || updates.workerId !== undefined) {
        const workerId = updates.workerId || entry.workerId;
        const worker = prev.workers.find(w => w.id === workerId);
        const hours = updates.totalHours ?? entry.totalHours;
        laborCost = hours * (worker?.hourlyRate || 0);
      }
      
      return {
        ...prev,
        timeEntries: prev.timeEntries.map(t => 
          t.id === id ? { ...t, ...updates, laborCost } : t
        ),
      };
    });
    if (updates.jobId) recalcJobCosts(updates.jobId);
  };

  const deleteTimeEntry = (id: string) => {
    const entry = data.timeEntries.find(t => t.id === id);
    setData(prev => ({
      ...prev,
      timeEntries: prev.timeEntries.filter(t => t.id !== id),
    }));
    if (entry) recalcJobCosts(entry.jobId);
  };

  const addExpense = (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExpense: Expense = {
      ...expense,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, expenses: [...prev.expenses, newExpense] }));
    recalcJobCosts(expense.jobId);
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setData(prev => ({
      ...prev,
      expenses: prev.expenses.map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  };

  const deleteExpense = (id: string) => {
    const expense = data.expenses.find(e => e.id === id);
    setData(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => e.id !== id),
    }));
    if (expense) recalcJobCosts(expense.jobId);
  };

  const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...task,
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
    const newInvoice: Invoice = {
      ...invoice,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, invoices: [...prev.invoices, newInvoice] }));
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setData(prev => ({
      ...prev,
      invoices: prev.invoices.map(i => i.id === id ? { ...i, ...updates } : i),
    }));
  };

  const deleteInvoice = (id: string) => {
    setData(prev => ({
      ...prev,
      invoices: prev.invoices.filter(i => i.id !== id),
      payments: prev.payments.filter(p => p.invoiceId !== id),
    }));
  };

  const addPayment = (payment: Omit<Payment, 'id' | 'createdAt'>) => {
    const newPayment: Payment = {
      ...payment,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
  };

  const deletePayment = (id: string) => {
    setData(prev => ({
      ...prev,
      payments: prev.payments.filter(p => p.id !== id),
    }));
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
    data.timeEntries.filter(t => t.jobId === jobId).reduce((sum, t) => sum + t.laborCost, 0);

  const getJobExpenseTotal = (jobId: string) => 
    data.expenses.filter(e => e.jobId === jobId).reduce((sum, e) => sum + e.amount, 0);

  const getJobChangeOrderTotal = (jobId: string) => 
    data.changeOrders.filter(co => co.jobId === jobId && co.status === 'approved').reduce((sum, co) => sum + co.amount, 0);

  const getJobActualCost = (jobId: string) => {
    const job = data.jobs.find(j => j.id === jobId);
    return job?.actualCost || getJobLaborCost(jobId) + getJobExpenseTotal(jobId);
  };

  const getJobProfit = (jobId: string) => {
    const job = data.jobs.find(j => j.id === jobId);
    if (!job) return { profit: 0, margin: 0 };
    
    const cost = getJobActualCost(jobId);
    const profit = job.contractAmount - cost;
    const margin = job.contractAmount > 0 ? (profit / job.contractAmount) * 100 : 0;
    return { profit, margin };
  };

  const getJobBalance = (jobId: string) => {
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

  const calculateEstimateTotals = (estimate: Partial<Estimate>): { laborTotal: number; materialTotal: number; equipmentTotal: number; subtotal: number; markupAmount: number; total: number; projectedLaborHours: number; projectedProfit: number } => {
    const laborTotal = estimate.lineItems?.filter(i => i.isLabor).reduce((sum, i) => sum + i.total, 0) || 0;
    const materialTotal = estimate.lineItems?.filter(i => i.category === 'materials').reduce((sum, i) => sum + i.total, 0) || 0;
    const equipmentTotal = estimate.lineItems?.filter(i => i.category === 'equipment').reduce((sum, i) => sum + i.total, 0) || 0;
    const subtotal = laborTotal + materialTotal + equipmentTotal;
    const markupAmount = subtotal * ((estimate.markupPercent || 0) / 100);
    const total = subtotal + markupAmount;
    const projectedLaborHours = estimate.lineItems?.filter(i => i.isLabor).reduce((sum, i) => sum + (i.hours || 0), 0) || 0;
    const projectedProfit = 0;
    return { laborTotal, materialTotal, equipmentTotal, subtotal, markupAmount, total, projectedLaborHours, projectedProfit };
  };

  const addEstimate = (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'laborTotal' | 'materialTotal' | 'equipmentTotal' | 'subtotal' | 'markupAmount' | 'total' | 'projectedLaborHours' | 'projectedProfit'>) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const totals = calculateEstimateTotals({ ...estimate, markupPercent: estimate.markupPercent || 20 });
    const newEstimate: Estimate = { ...estimate, ...totals, id, createdAt: now, updatedAt: now };
    setData(prev => ({ ...prev, estimates: [...prev.estimates, newEstimate] }));
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
  };

  const deleteEstimate = (id: string) => {
    setData(prev => ({ ...prev, estimates: prev.estimates.filter(e => e.id !== id) }));
  };

  const convertEstimateToJob = (estimateId: string) => {
    const estimate = data.estimates.find(e => e.id === estimateId);
    if (!estimate) return '';
    
    const customer = data.customers.find(c => c.id === estimate.customerId);
    const jobId = addJob({
      name: estimate.name,
      customerId: estimate.customerId,
      customer: customer?.name || '',
      customerPhone: customer?.phone || '',
      customerEmail: customer?.email || '',
      address: estimate.address,
      type: estimate.type,
      contractAmount: estimate.total,
      estimatedCost: estimate.subtotal,
      startDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      status: 'approved',
      estimateId: estimate.id,
    });
    
    updateEstimate(estimateId, { status: 'approved', convertedToJobId: jobId });
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

  return (
    <AppContext.Provider value={{
      data,
      setData,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addEstimate,
      updateEstimate,
      deleteEstimate,
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
      customers: data.customers,
      estimates: data.estimates,
      laborRates: data.laborRates,
      materials: data.materials,
      assemblies: data.assemblies,
      templates: data.templates,
      jobs: data.jobs,
      workers: data.workers,
      timeEntries: data.timeEntries,
      expenses: data.expenses,
      tasks: data.tasks,
      invoices: data.invoices,
      payments: data.payments,
      notes: data.notes,
      photos: data.photos,
      changeOrders: data.changeOrders,
      jobTemplates: data.jobTemplates,
      alerts: data.alerts,
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