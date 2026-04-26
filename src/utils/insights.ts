import { Job, Expense, TimeEntry, Worker, Invoice, Payment, Task, Estimate, JobType, Material, LaborRate, ProjectTypeTemplate, EstimateLineItem, EstimateLineCategory, MaterialOrder, ShoppingList, Allowance } from '../data/types';
import { formatCurrency } from './formatters';

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

export interface SmartAction {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionLabel: string;
  to: string;
  category: 'follow_up' | 'job' | 'payment' | 'delay' | 'profit' | 'cash_flow' | 'materials' | 'scope' | 'allowance';
}

export interface PerformanceInsight {
  averageProfitMargin: number;
  mostProfitableJobTypes: { type: string; margin: number; profit: number; count: number }[];
  closeRate: number;
  expenseBreakdown: { category: string; amount: number; percent: number }[];
  underpricingWarnings: string[];
  cashFlowBalance: number;
}

export interface EstimateSuggestion {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  category: EstimateLineCategory;
  isLabor: boolean;
  linkedMaterialId?: string;
  linkedLaborRateId?: string;
  reason: string;
}

const dayMs = 24 * 60 * 60 * 1000;

function daysSince(date?: string) {
  if (!date) return 999;
  return Math.floor((Date.now() - new Date(date).getTime()) / dayMs);
}

function getPaidByInvoice(payments: Payment[]) {
  const paymentMap = new Map<string, number>();
  payments.forEach(payment => {
    paymentMap.set(payment.invoiceId, (paymentMap.get(payment.invoiceId) || 0) + payment.amount);
  });
  return paymentMap;
}

function getActualJobCost(job: Job, expenses: Expense[], timeEntries: TimeEntry[]) {
  const expenseTotal = expenses.filter(expense => expense.jobId === job.id).reduce((sum, expense) => sum + expense.amount, 0);
  const laborTotal = timeEntries.filter(entry => entry.jobId === job.id).reduce((sum, entry) => sum + entry.laborCost, 0);
  return expenseTotal + laborTotal;
}

export function generateSmartNextActions(
  estimates: Estimate[],
  jobs: Job[],
  expenses: Expense[],
  timeEntries: TimeEntry[],
  invoices: Invoice[],
  payments: Payment[],
  tasks: Task[],
  materialOrders: MaterialOrder[] = [],
  shoppingLists: ShoppingList[] = [],
  allowances: Allowance[] = []
): SmartAction[] {
  const actions: SmartAction[] = [];
  const paidByInvoice = getPaidByInvoice(payments);
  const openStatuses = ['sent', 'viewed', 'in_review'];

  estimates
    .filter(estimate => openStatuses.includes(estimate.status))
    .forEach(estimate => {
      const idleDays = daysSince(estimate.updatedAt || estimate.createdAt);
      if (idleDays >= 3) {
        actions.push({
          id: `estimate-followup-${estimate.id}`,
          priority: idleDays >= 7 ? 'high' : 'medium',
          title: `Follow up on ${estimate.name}`,
          description: `${estimate.status.replace('_', ' ')} estimate has had no activity for ${idleDays} days.`,
          actionLabel: 'Open estimate',
          to: `/estimates/${estimate.id}`,
          category: 'follow_up',
        });
      }
    });

  estimates
    .filter(estimate => estimate.status === 'approved' && !estimate.convertedToJobId)
    .forEach(estimate => {
      actions.push({
        id: `approved-estimate-${estimate.id}`,
        priority: 'high',
        title: `Convert approved estimate: ${estimate.name}`,
        description: 'Approved estimates should become jobs before scope, materials, and billing drift.',
        actionLabel: 'Convert to job',
        to: `/estimates/${estimate.id}`,
        category: 'job',
      });
    });

  invoices
    .filter(invoice => invoice.status !== 'paid')
    .forEach(invoice => {
      const balance = invoice.amount - (paidByInvoice.get(invoice.id) || 0);
      const daysPastDue = Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / dayMs);
      if (balance > 0 && daysPastDue >= -3) {
        actions.push({
          id: `invoice-${invoice.id}`,
          priority: daysPastDue > 0 ? 'critical' : 'high',
          title: daysPastDue > 0 ? `Payment overdue: ${invoice.invoiceNumber}` : `Payment due soon: ${invoice.invoiceNumber}`,
          description: `${formatCurrency(balance)} ${daysPastDue > 0 ? `overdue by ${daysPastDue} days` : 'expected within 3 days'}.`,
          actionLabel: 'View invoices',
          to: '/invoices',
          category: 'payment',
        });
      }
    });

  jobs
    .filter(job => job.status === 'active' || job.status === 'scheduled' || job.status === 'awaiting_materials')
    .forEach(job => {
      const jobTime = timeEntries.filter(entry => entry.jobId === job.id);
      const jobExpenses = expenses.filter(expense => expense.jobId === job.id);
      const lastActivity = [job.updatedAt, ...jobTime.map(entry => entry.date), ...jobExpenses.map(expense => expense.date)]
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
      const idleDays = daysSince(lastActivity);
      const dueDays = Math.ceil((new Date(job.dueDate).getTime() - Date.now()) / dayMs);
      const actualCost = getActualJobCost(job, expenses, timeEntries);
      const budgetUsage = job.estimatedCost > 0 ? (actualCost / job.estimatedCost) * 100 : 0;

      if (idleDays >= 5) {
        actions.push({
          id: `job-inactive-${job.id}`,
          priority: idleDays >= 10 ? 'high' : 'medium',
          title: `Check inactive job: ${job.name}`,
          description: `No time, expense, or job update activity for ${idleDays} days.`,
          actionLabel: 'Open job',
          to: `/jobs/${job.id}`,
          category: 'delay',
        });
      }

      if (dueDays < 0) {
        actions.push({
          id: `job-overdue-${job.id}`,
          priority: 'critical',
          title: `${job.name} missed its deadline`,
          description: `Due date passed ${Math.abs(dueDays)} days ago.`,
          actionLabel: 'Open job',
          to: `/jobs/${job.id}`,
          category: 'job',
        });
      }

      if (budgetUsage >= 90) {
        actions.push({
          id: `job-budget-${job.id}`,
          priority: budgetUsage > 100 ? 'critical' : 'high',
          title: `${job.name} is ${budgetUsage > 100 ? 'over' : 'near'} budget`,
          description: `${Math.round(budgetUsage)}% of estimated cost has been used.`,
          actionLabel: 'Review job',
          to: `/jobs/${job.id}`,
          category: 'profit',
        });
      }

      const jobTasks = tasks.filter(task => task.jobId === job.id && task.status !== 'done');
      if (jobTasks.length === 0) {
        actions.push({
          id: `job-missing-tasks-${job.id}`,
          priority: 'medium',
          title: `${job.name} has no open tasks`,
          description: 'Add a checklist so field work and office follow-up stay accountable.',
          actionLabel: 'Add tasks',
          to: '/tasks',
          category: 'job',
        });
      }

      const jobOrders = materialOrders.filter(order => order.jobId === job.id);
      const jobShopping = shoppingLists.filter(list => list.jobId === job.id);
      if (job.status === 'active' && jobOrders.length === 0 && jobShopping.length === 0) {
        actions.push({
          id: `job-missing-materials-${job.id}`,
          priority: 'high',
          title: `${job.name} has no material plan`,
          description: 'Create an order or shopping list before the crew loses time.',
          actionLabel: 'Create order',
          to: '/estimates/orders',
          category: 'materials',
        });
      }
    });

  shoppingLists
    .filter(list => list.status === 'completed')
    .forEach(list => {
      const hasReceiptExpense = expenses.some(expense => expense.sourceType === 'shopping_list' && expense.sourceId === list.id);
      if (!hasReceiptExpense) {
        actions.push({
          id: `shopping-receipt-${list.id}`,
          priority: 'high',
          title: `Add receipt for ${list.title}`,
          description: 'Completed shopping lists should create job expenses and update profit.',
          actionLabel: 'Open shopping lists',
          to: '/shopping-lists',
          category: 'materials',
        });
      }
    });

  expenses
    .filter(expense => expense.sourceType === 'manual' && !expense.notes?.toLowerCase().includes('estimate'))
    .slice(0, 4)
    .forEach(expense => {
      const job = jobs.find(item => item.id === expense.jobId);
      actions.push({
        id: `expense-change-order-${expense.id}`,
        priority: expense.amount > 1000 ? 'high' : 'medium',
        title: `Review unestimated expense${job ? ` on ${job.name}` : ''}`,
        description: `${formatCurrency(expense.amount)} from ${expense.vendor} may need a change order or client approval.`,
        actionLabel: 'Review expenses',
        to: '/expenses',
        category: 'scope',
      });
    });

  allowances
    .filter(allowance => allowance.remainingAmount < 0)
    .forEach(allowance => {
      actions.push({
        id: `allowance-overage-${allowance.id}`,
        priority: 'high',
        title: `${allowance.name} allowance is over budget`,
        description: `Create a change order for ${formatCurrency(Math.abs(allowance.remainingAmount))}.`,
        actionLabel: 'Open job',
        to: `/jobs/${allowance.jobId}`,
        category: 'allowance',
      });
    });

  jobs
    .filter(job => job.status === 'completed')
    .forEach(job => {
      const hasFinalInvoice = invoices.some(invoice => invoice.jobId === job.id && invoice.type === 'final');
      if (!hasFinalInvoice) {
        actions.push({
          id: `final-invoice-${job.id}`,
          priority: 'high',
          title: `Create final invoice for ${job.name}`,
          description: 'Completed jobs should close the billing loop.',
          actionLabel: 'Create invoice',
          to: '/invoices',
          category: 'payment',
        });
      }
    });

  const overdueTasks = tasks.filter(task => task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date());
  if (overdueTasks.length > 0) {
    actions.push({
      id: 'overdue-task-stack',
      priority: 'critical',
      title: `${overdueTasks.length} overdue tasks need attention`,
      description: 'Missed deadlines can slow active jobs and payment collection.',
      actionLabel: 'Review tasks',
      to: '/tasks',
      category: 'delay',
    });
  }

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 8);
}

export function getPerformanceInsights(
  estimates: Estimate[],
  jobs: Job[],
  expenses: Expense[],
  timeEntries: TimeEntry[],
  invoices: Invoice[],
  payments: Payment[]
): PerformanceInsight {
  const jobSummaries = jobs.map(job => {
    const actualCost = getActualJobCost(job, expenses, timeEntries) || job.actualCost || 0;
    const profit = job.contractAmount - actualCost;
    const margin = job.contractAmount > 0 ? (profit / job.contractAmount) * 100 : 0;
    return { job, actualCost, profit, margin };
  });

  const revenue = jobSummaries.reduce((sum, item) => sum + item.job.contractAmount, 0);
  const profit = jobSummaries.reduce((sum, item) => sum + item.profit, 0);
  const averageProfitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const byType: Record<string, { revenue: number; profit: number; count: number }> = {};
  jobSummaries.forEach(item => {
    if (!byType[item.job.type]) byType[item.job.type] = { revenue: 0, profit: 0, count: 0 };
    byType[item.job.type].revenue += item.job.contractAmount;
    byType[item.job.type].profit += item.profit;
    byType[item.job.type].count += 1;
  });

  const mostProfitableJobTypes = Object.entries(byType)
    .map(([type, data]) => ({
      type,
      margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
      profit: data.profit,
      count: data.count,
    }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 4);

  const closedEstimates = estimates.filter(estimate => ['approved', 'converted', 'rejected'].includes(estimate.status));
  const wonEstimates = closedEstimates.filter(estimate => estimate.status === 'approved' || estimate.status === 'converted');
  const closeRate = closedEstimates.length > 0 ? (wonEstimates.length / closedEstimates.length) * 100 : 0;

  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const expenseByCategory: Record<string, number> = {};
  expenses.forEach(expense => {
    expenseByCategory[expense.category] = (expenseByCategory[expense.category] || 0) + expense.amount;
  });
  const expenseBreakdown = Object.entries(expenseByCategory)
    .map(([category, amount]) => ({ category, amount, percent: expenseTotal > 0 ? (amount / expenseTotal) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const underpricingWarnings = jobSummaries
    .filter(item => item.job.status === 'completed' || item.job.status === 'closed')
    .filter(item => item.margin < 12 || item.actualCost > item.job.estimatedCost * 1.15)
    .slice(0, 4)
    .map(item => `${item.job.name}: ${Math.round(item.margin)}% margin, ${formatCurrency(item.actualCost)} actual cost.`);

  const paidByInvoice = getPaidByInvoice(payments);
  const expectedPayments = invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.amount - (paidByInvoice.get(invoice.id) || 0)), 0);
  const upcomingExpenses = expenses
    .filter(expense => Math.abs(daysSince(expense.date)) <= 14)
    .reduce((sum, expense) => sum + expense.amount, 0);

  return {
    averageProfitMargin,
    mostProfitableJobTypes,
    closeRate,
    expenseBreakdown,
    underpricingWarnings,
    cashFlowBalance: expectedPayments - upcomingExpenses,
  };
}

export function getEstimateSuggestions(
  projectType: JobType,
  materials: Material[],
  laborRates: LaborRate[],
  projectTypeTemplates: ProjectTypeTemplate[],
  jobs: Job[],
  expenses: Expense[],
  timeEntries: TimeEntry[]
): EstimateSuggestion[] {
  const suggestions: EstimateSuggestion[] = [];
  const template = projectTypeTemplates.find(item => item.projectType === projectType);

  template?.sections?.forEach(section => {
    section.items?.forEach(item => {
      const category = item.category === 'optional' ? 'other' : item.category === 'subcontractor' ? 'subcontractor' : item.category as EstimateLineCategory;
      suggestions.push({
        id: `template-${item.id}`,
        name: item.name,
        description: item.description || section.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        category,
        isLabor: !!item.isLabor || category === 'labor',
        linkedMaterialId: item.linkedMaterialId,
        linkedLaborRateId: item.linkedLaborRateId,
        reason: `Common ${projectType.replace('_', ' ')} scope item`,
      });
    });
  });

  const matchingJobs = jobs.filter(job => job.type === projectType);
  const expenseCounts: Record<string, { count: number; total: number; category: EstimateLineCategory }> = {};
  matchingJobs.forEach(job => {
    expenses.filter(expense => expense.jobId === job.id).forEach(expense => {
      const key = expense.category;
      if (!expenseCounts[key]) expenseCounts[key] = { count: 0, total: 0, category: 'material' };
      expenseCounts[key].count += 1;
      expenseCounts[key].total += expense.amount;
    });
  });

  Object.entries(expenseCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3)
    .forEach(([category, data]) => {
      suggestions.push({
        id: `history-expense-${category}`,
        name: `${category.replace('_', ' ')} allowance`,
        quantity: 1,
        unit: 'allowance',
        unitPrice: Math.round(data.total / Math.max(1, data.count)),
        category: 'allowance',
        isLabor: false,
        reason: 'Based on past jobs of this type',
      });
    });

  laborRates.filter(rate => rate.isActive !== false).slice(0, 2).forEach(rate => {
    suggestions.push({
      id: `labor-${rate.id}`,
      name: rate.name,
      description: rate.trade,
      quantity: 8,
      unit: 'hr',
      unitPrice: rate.hourlyRate,
      category: 'labor',
      isLabor: true,
      linkedLaborRateId: rate.id,
      reason: 'Active labor rate available',
    });
  });

  materials.filter(material => material.isActive !== false).slice(0, 4).forEach(material => {
    suggestions.push({
      id: `material-${material.id}`,
      name: material.name,
      description: material.category,
      quantity: 1,
      unit: material.unit,
      unitPrice: material.unitPrice,
      category: 'material',
      isLabor: false,
      linkedMaterialId: material.id,
      reason: 'Common price book material',
    });
  });

  const seen = new Set<string>();
  return suggestions.filter(item => {
    const key = `${item.name}-${item.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
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
