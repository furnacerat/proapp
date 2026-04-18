import { Job, TimeEntry, Expense, Worker, Invoice, Payment, Task } from '../data/types';
import { formatCurrency } from './formatters';

export function calculateProjectedProfit(job: Job): number {
  return job.contractAmount - job.actualCost;
}

export function calculateProfitMargin(job: Job): number {
  if (job.contractAmount === 0) return 0;
  return ((job.contractAmount - job.actualCost) / job.contractAmount) * 100;
}

export function calculateBalanceDue(invoices: Invoice[], payments: Payment[]): number {
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaid = payments.reduce((sum, pay) => sum + pay.amount, 0);
  return totalInvoiced - totalPaid;
}

export function getWorkerHours(workerId: string, timeEntries: TimeEntry[]): number {
  return timeEntries
    .filter(t => t.workerId === workerId)
    .reduce((sum, t) => sum + t.totalHours, 0);
}

export function getWorkerOwed(workerId: string, workers: Worker[], timeEntries: TimeEntry[]): number {
  const worker = workers.find(w => w.id === workerId);
  if (!worker) return 0;
  
  const hours = getWorkerHours(workerId, timeEntries);
  
  if (worker.payType === 'hourly' && worker.hourlyRate) {
    return hours * worker.hourlyRate;
  }
  return 0;
}

export function getJobLaborCost(jobId: string, timeEntries: TimeEntry[]): number {
  return timeEntries
    .filter(t => t.jobId === jobId)
    .reduce((sum, t) => sum + t.laborCost, 0);
}

export function getJobExpenseTotal(jobId: string, expenses: Expense[]): number {
  return expenses
    .filter(e => e.jobId === jobId)
    .reduce((sum, e) => sum + e.amount, 0);
}

export function getJobTotalCost(jobId: string, timeEntries: TimeEntry[], expenses: Expense[]): number {
  return getJobLaborCost(jobId, timeEntries) + getJobExpenseTotal(jobId, expenses);
}

export function getThisWeekExpenses(expenses: Expense[]): number {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  return expenses
    .filter(e => new Date(e.date) >= startOfWeek)
    .reduce((sum, e) => sum + e.amount, 0);
}

export function getThisWeekHours(timeEntries: TimeEntry[]): number {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  return timeEntries
    .filter(e => new Date(e.date) >= startOfWeek)
    .reduce((sum, e) => sum + e.totalHours, 0);
}

export function getThisWeekPayments(invoices: Invoice[], payments: Payment[]): number {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const invoiceIds = invoices.map(i => i.id);
  
  return payments
    .filter(p => invoiceIds.includes(p.invoiceId) && new Date(p.date) >= startOfWeek)
    .reduce((sum, p) => sum + p.amount, 0);
}

export function getOutstandingBalance(invoices: Invoice[], payments: Payment[]): number {
  const invoiceMap = new Map(invoices.map(inv => [inv.id, inv.amount]));
  const paymentMap = new Map< string, number >();
  
  payments.forEach(p => {
    const current = paymentMap.get(p.invoiceId) || 0;
    paymentMap.set(p.invoiceId, current + p.amount);
  });
  
  let total = 0;
  invoiceMap.forEach((amount, id) => {
    total += amount - (paymentMap.get(id) || 0);
  });
  
  return total;
}

export function getActiveJobs(jobs: Job[]): Job[] {
  return jobs.filter(j => j.status === 'active' || j.status === 'scheduled');
}

export function getJobsDueSoon(jobs: Job[], days: number = 7): Job[] {
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  
  return jobs.filter(j => {
    const due = new Date(j.dueDate);
    return due <= future && (j.status === 'active' || j.status === 'scheduled');
  });
}

export function getOverdueTasks(tasks: Task[]): Task[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  return tasks.filter(t => {
    if (!t.dueDate) return false;
    if (t.status === 'done') return false;
    return new Date(t.dueDate) < now;
  });
}

export function getWorkersOnDate(workerJobs: { jobId: string }[], date: string): string[] {
  const workerMap = new Set<string>();
  workerJobs.forEach(w => workerMap.add(w.jobId));
  return Array.from(workerMap);
}

export function groupExpensesByCategory(expenses: Expense[]): Record<string, number> {
  return expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
}

export function groupHoursByWorker(timeEntries: TimeEntry[]): Record<string, number> {
  return timeEntries.reduce((acc, t) => {
    acc[t.workerId] = (acc[t.workerId] || 0) + t.totalHours;
    return acc;
  }, {} as Record<string, number>);
}

export function getProfitByJob(
  jobs: Job[],
  timeEntries: TimeEntry[],
  expenses: Expense[]
): { name: string; revenue: number; cost: number; profit: number }[] {
  return jobs
    .filter(j => j.status === 'completed' || j.status === 'active')
    .map(j => {
      const laborCost = getJobLaborCost(j.id, timeEntries);
      const materialCost = getJobExpenseTotal(j.id, expenses);
      const totalCost = laborCost + materialCost;
      return {
        name: j.name,
        revenue: j.contractAmount,
        cost: totalCost,
        profit: j.contractAmount - totalCost,
      };
    });
}

export function getLaborCostByJob(
  jobs: Job[],
  timeEntries: TimeEntry[]
): { name: string; labor: number }[] {
  return jobs.map(j => ({
    name: j.name,
    labor: getJobLaborCost(j.id, timeEntries),
  }));
}

export function getExpensesByCategory(
  expenses: Expense[]
): { category: string; amount: number }[] {
  const grouped = groupExpensesByCategory(expenses);
  return Object.entries(grouped).map(([category, amount]) => ({
    category,
    amount,
  }));
}

export function getUnpaidInvoices(
  invoices: Invoice[],
  payments: Payment[]
): { invoice: Invoice; jobName: string; balance: number }[] {
  const paymentMap = new Map< string, number >();
  payments.forEach(p => {
    const current = paymentMap.get(p.invoiceId) || 0;
    paymentMap.set(p.invoiceId, current + p.amount);
  });
  
  return invoices
    .filter(inv => {
      const paid = paymentMap.get(inv.id) || 0;
      return paid < inv.amount;
    })
    .map(inv => ({
      invoice: inv,
      jobName: '',
      balance: inv.amount - (paymentMap.get(inv.id) || 0),
    }));
}

export function getHoursByWorker(
  workers: Worker[],
  timeEntries: TimeEntry[]
): { name: string; hours: number }[] {
  return workers.map(w => ({
    name: w.name,
    hours: getWorkerHours(w.id, timeEntries),
  }));
}