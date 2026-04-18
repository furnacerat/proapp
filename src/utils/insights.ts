import { Job, Expense, TimeEntry, Worker, Invoice, Payment, Task } from '../data/types';

export interface Insight {
  id: string;
  type: 'budget' | 'labor' | 'profit' | 'efficiency' | 'alert' | 'recommendation';
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  description: string;
  jobId?: string;
  action?: string;
  metric?: number;
}

export function generateInsights(
  jobs: Job[],
  expenses: Expense[],
  timeEntries: TimeEntry[],
  workers: Worker[],
  invoices: Invoice[],
  payments: Payment[],
  tasks: Task[]
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  jobs.forEach(job => {
    if (job.status !== 'active' && job.status !== 'completed') return;
    
    const jobExpenses = expenses.filter(e => e.jobId === job.id);
    const jobTime = timeEntries.filter(t => t.jobId === job.id);
    
    const laborCost = jobTime.reduce((sum, t) => sum + t.laborCost, 0);
    const materialCost = jobExpenses.reduce((sum, e) => sum + e.amount, 0);
    const actualCost = laborCost + materialCost;
    const profit = job.contractAmount - actualCost;
    const margin = job.contractAmount > 0 ? (profit / job.contractAmount) * 100 : 0;
    const budgetUsage = job.contractAmount > 0 ? (actualCost / job.contractAmount) * 100 : 0;

    if (job.status === 'active' && budgetUsage > 90) {
      insights.push({
        id: `budget-${job.id}`,
        type: 'budget',
        severity: budgetUsage > 100 ? 'critical' : 'warning',
        title: `${job.name} ${budgetUsage > 100 ? 'Over Budget' : 'Near Budget'}`,
        description: `Spent ${Math.round(budgetUsage)}% of contract ($${actualCost.toLocaleString()} of $${job.contractAmount.toLocaleString()})`,
        jobId: job.id,
      });
    }

    if (job.status === 'completed' && margin > 30) {
      insights.push({
        id: `profit-${job.id}`,
        type: 'profit',
        severity: 'success',
        title: `${job.name} High Profit`,
        description: `${Math.round(margin)}% margin ($${profit.toLocaleString()})`,
        jobId: job.id,
        metric: margin,
      });
    }

    if (job.status === 'completed' && margin < 10) {
      insights.push({
        id: `lowprofit-${job.id}`,
        type: 'profit',
        severity: 'warning',
        title: `${job.name} Low Profit`,
        description: `Only ${Math.round(margin)}% margin - review costs`,
        jobId: job.id,
      });
    }
  });

  const jobTypeProfit: Record<string, { revenue: number; cost: number; count: number }> = {};
  jobs.filter(j => j.status === 'completed').forEach(job => {
    if (!jobTypeProfit[job.type]) {
      jobTypeProfit[job.type] = { revenue: 0, cost: 0, count: 0 };
    }
    jobTypeProfit[job.type].revenue += job.contractAmount;
    jobTypeProfit[job.type].cost += job.actualCost;
    jobTypeProfit[job.type].count += 1;
  });

  let bestType = '';
  let bestMargin = 0;
  Object.entries(jobTypeProfit).forEach(([type, data]) => {
    const margin = data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0;
    if (margin > bestMargin) {
      bestMargin = margin;
      bestType = type;
    }
  });

  if (bestType) {
    insights.push({
      id: 'best-type',
      type: 'recommendation',
      severity: 'info',
      title: `Best Performing Job Type`,
      description: `${bestType.replace('_', ' ')} projects have highest margins`,
    });
  }

  const workerHours: Record<string, number> = {};
  timeEntries.forEach(t => {
    workerHours[t.workerId] = (workerHours[t.workerId] || 0) + t.totalHours;
  });

  const topWorker = Object.entries(workerHours).sort((a, b) => b[1] - a[1])[0];
  if (topWorker) {
    const worker = workers.find(w => w.id === topWorker[0]);
    if (worker) {
      insights.push({
        id: 'top-worker',
        type: 'efficiency',
        severity: 'info',
        title: `Top Performer`,
        description: `${worker.name} with ${topWorker[1].toFixed(1)} hours`,
      });
    }
  }

  const overdueTasks = tasks.filter(t => {
    if (!t.dueDate || t.status === 'done') return false;
    return new Date(t.dueDate) < now;
  });

  if (overdueTasks.length > 0) {
    insights.push({
      id: 'overdue-tasks',
      type: 'alert',
      severity: 'critical',
      title: `${overdueTasks.length} Overdue Tasks`,
      description: 'Tasks past due date need attention',
    });
  }

  const unpaidFilter = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.amount, 0);
  const paidFilter = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = unpaidFilter - paidFilter;

  if (outstanding > 0) {
    insights.push({
      id: 'outstanding',
      type: 'alert',
      severity: 'warning',
      title: `$${outstanding.toLocaleString()} Outstanding`,
      description: 'Collect unpaid invoices',
    });
  }

  const recentExpenses = expenses.slice(-30);
  const categoryTotals: Record<string, number> = {};
  recentExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });
  
  const highestCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  if (highestCategory) {
    insights.push({
      id: 'top-expense',
      type: 'efficiency',
      severity: 'info',
      title: `Top Expense Category`,
      description: `${highestCategory[0]}: $${highestCategory[1].toLocaleString()}`,
    });
  }

  return insights.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function getJobInsights(job: Job, expenses: Expense[], timeEntries: TimeEntry[]): Insight[] {
  const insights: Insight[] = [];
  
  const laborCost = timeEntries.reduce((sum, t) => sum + t.laborCost, 0);
  const materialCost = expenses.reduce((sum, e) => sum + e.amount, 0);
  const actualCost = laborCost + materialCost;
  const profit = job.contractAmount - actualCost;
  const margin = job.contractAmount > 0 ? (profit / job.contractAmount) * 100 : 0;
  const budgetUsage = job.contractAmount > 0 ? (actualCost / job.contractAmount) * 100 : 0;

  if (job.status === 'active') {
    if (budgetUsage > 100) {
      insights.push({
        id: `${job.id}-overbudget`,
        type: 'budget',
        severity: 'critical',
        title: 'Over Budget',
        description: `Spent ${Math.round(budgetUsage)}% of contract`,
      });
    } else if (budgetUsage > 75) {
      insights.push({
        id: `${job.id}-nearbudget`,
        type: 'budget',
        severity: 'warning',
        title: 'Approaching Budget',
        description: `Used ${Math.round(budgetUsage)}% of ${job.contractAmount}`,
      });
    } else if (budgetUsage < 25) {
      insights.push({
        id: `${job.id}-ontrack`,
        type: 'budget',
        severity: 'success',
        title: 'On Track',
        description: 'Under budget so far',
      });
    }
  }

  if (margin > 25) {
    insights.push({
      id: `${job.id}-highmargin`,
      type: 'profit',
      severity: 'success',
      title: 'High Profitability',
      description: `${Math.round(margin)}% margin expected`,
    });
  } else if (margin < 0) {
    insights.push({
      id: `${job.id}-loss`,
      type: 'profit',
      severity: 'critical',
      title: 'At Loss',
      description: `Over budget by $${Math.abs(profit).toLocaleString()}`,
    });
  }

  if (laborCost > job.estimatedCost * 0.5) {
    insights.push({
      id: `${job.id}-labor`,
      type: 'labor',
      severity: 'warning',
      title: 'High Labor Cost',
      description: `Labor: $${laborCost.toLocaleString()} (${Math.round((laborCost / job.estimatedCost) * 100)}% of estimate)`,
    });
  }

  return insights;
}

export function getWeeklySummary(
  jobs: Job[],
  timeEntries: TimeEntry[],
  expenses: Expense[],
  payments: Payment[]
) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weekEntries = timeEntries.filter(t => new Date(t.date) >= startOfWeek);
  const weekExpenses = expenses.filter(e => new Date(e.date) >= startOfWeek);
  const weekPayments = payments.filter(p => new Date(p.date) >= startOfWeek);

  return {
    hours: weekEntries.reduce((sum, t) => sum + t.totalHours, 0),
    laborCost: weekEntries.reduce((sum, t) => sum + t.laborCost, 0),
    expenses: weekExpenses.reduce((sum, e) => sum + e.amount, 0),
    revenue: weekPayments.reduce((sum, p) => sum + p.amount, 0),
    activeJobs: jobs.filter(j => j.status === 'active').length,
  };
}

export function getKPIS(
  jobs: Job[],
  expenses: Expense[],
  timeEntries: TimeEntry[],
  invoices: Invoice[],
  payments: Payment[]
) {
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const activeJobs = jobs.filter(j => j.status === 'active');

  const totalRevenue = jobs.reduce((sum, j) => sum + j.contractAmount, 0);
  const totalCost = jobs.reduce((sum, j) => sum + j.actualCost, 0);
  const totalProfit = totalRevenue - totalCost;

  const invoiceMap = new Map<string, number>();
  payments.forEach(p => {
    invoiceMap.set(p.invoiceId, (invoiceMap.get(p.invoiceId) || 0) + p.amount);
  });
  
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = Array.from(invoiceMap.values()).reduce((sum, v) => sum + v, 0);
  const outstanding = totalInvoiced - totalPaid;

  const totalHours = timeEntries.reduce((sum, t) => sum + t.totalHours, 0);
  const laborCost = timeEntries.reduce((sum, t) => sum + t.laborCost, 0);
  const materialCost = expenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    totalJobs: jobs.length,
    activeJobs: activeJobs.length,
    completedJobs: completedJobs.length,
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    outstanding,
    totalHours,
    laborCost,
    materialCost,
    laborPercentage: totalCost > 0 ? (laborCost / totalCost) * 100 : 0,
    materialPercentage: totalCost > 0 ? (materialCost / totalCost) * 100 : 0,
  };
}