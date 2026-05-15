import type { Dispatch, SetStateAction } from 'react';
import type { AppData, Job, Task } from '../../data/types';
import { dataService } from '../../services/dataService';
import { expenseAffectsJobCost } from '../../utils/timeEntries';

interface JobHookDeps {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  canSeeOwnerFinancials: boolean;
}

export function useJobs({ data, setData, addTask, canSeeOwnerFinancials }: JobHookDeps) {
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
      signatureRequests: (prev.signatureRequests || []).filter(request => request.jobId !== id),
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

  return {
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
  };
}
