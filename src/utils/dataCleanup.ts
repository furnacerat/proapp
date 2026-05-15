import type { AppData, Customer, Invoice, Job } from '../data/types';
import { parseDateString } from './formatters';

export type DataCleanupSeverity = 'info' | 'warning' | 'critical';
export type DataCleanupCategory = 'customers' | 'jobs' | 'billing' | 'records' | 'price_book';

export interface DataCleanupSuggestion {
  id: string;
  category: DataCleanupCategory;
  severity: DataCleanupSeverity;
  title: string;
  description: string;
  affectedRecords: number;
  autoFixAvailable: boolean;
  applyLabel?: string;
}

export interface DataCleanupReport {
  score: number;
  summary: string;
  suggestions: DataCleanupSuggestion[];
  totals: {
    critical: number;
    warning: number;
    info: number;
    autoFixable: number;
  };
}

export interface DataCleanupApplyResult {
  data: AppData;
  applied: number;
}

const normalizeText = (value?: string) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const normalizePhone = (value?: string) => String(value || '').replace(/\D/g, '');
const dayMs = 24 * 60 * 60 * 1000;

const collection = <T>(items?: T[]) => items || [];

const getPaidByInvoice = (data: AppData) => {
  const paidByInvoice = new Map<string, number>();
  collection(data.payments).forEach(payment => {
    paidByInvoice.set(payment.invoiceId, (paidByInvoice.get(payment.invoiceId) || 0) + Number(payment.amount || 0));
  });
  return paidByInvoice;
};

const getInvoiceBalance = (invoice: Invoice, paidByInvoice: Map<string, number>) => {
  const total = Number(invoice.total ?? invoice.amount ?? 0);
  const paid = paidByInvoice.get(invoice.id) || 0;
  return {
    total,
    paid,
    balance: Math.max(0, total - paid),
  };
};

const getCustomerMatchKey = (customer: Customer) => {
  const email = normalizeText(customer.email);
  const phone = normalizePhone(customer.phone);
  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  return `name:${normalizeText(customer.name)}|address:${normalizeText(customer.address)}`;
};

const findCustomerForJob = (job: Job, customers: Customer[]) => {
  const jobEmail = normalizeText(job.customerEmail);
  const jobPhone = normalizePhone(job.customerPhone);
  const jobName = normalizeText(job.customer);
  const jobAddress = normalizeText(job.address);

  return customers.find(customer => {
    if (jobEmail && normalizeText(customer.email) === jobEmail) return true;
    if (jobPhone && normalizePhone(customer.phone) === jobPhone) return true;
    if (jobName && normalizeText(customer.name) === jobName) return true;
    return !!jobAddress && normalizeText(customer.address) === jobAddress;
  });
};

const shouldSetInvoiceOverdue = (invoice: Invoice, balance: number, now: Date) => {
  if (balance <= 0) return false;
  if (!invoice.dueDate) return false;
  if (invoice.status === 'draft' || invoice.status === 'cancelled') return false;
  return parseDateString(invoice.dueDate).getTime() < now.getTime();
};

const getNormalizedInvoiceStatus = (invoice: Invoice, paid: number, balance: number, now: Date): Invoice['status'] => {
  if (balance <= 0 && paid > 0) return 'paid';
  if (paid > 0 && balance > 0) return 'partial';
  if (shouldSetInvoiceOverdue(invoice, balance, now)) return 'overdue';
  return invoice.status;
};

export function getSmartDataCleanupReport(data: AppData, now = new Date()): DataCleanupReport {
  const suggestions: DataCleanupSuggestion[] = [];
  const customers = collection(data.customers);
  const jobs = collection(data.jobs);
  const invoices = collection(data.invoices);
  const payments = collection(data.payments);
  const jobIds = new Set(jobs.map(job => job.id));
  const invoiceIds = new Set(invoices.map(invoice => invoice.id));
  const paidByInvoice = getPaidByInvoice(data);

  const customerGroups = new Map<string, Customer[]>();
  customers.forEach(customer => {
    const key = getCustomerMatchKey(customer);
    if (!key.endsWith('address:') && key !== 'name:|address:') {
      customerGroups.set(key, [...(customerGroups.get(key) || []), customer]);
    }
  });
  const duplicateCustomerCount = Array.from(customerGroups.values()).filter(group => group.length > 1).reduce((sum, group) => sum + group.length, 0);
  if (duplicateCustomerCount > 0) {
    suggestions.push({
      id: 'duplicate-customers',
      category: 'customers',
      severity: 'warning',
      title: 'Possible duplicate customers',
      description: 'Customers share the same email, phone, or name/address. Review before merging so job history stays attached correctly.',
      affectedRecords: duplicateCustomerCount,
      autoFixAvailable: false,
    });
  }

  const linkableJobs = jobs.filter(job => !job.customerId && !!findCustomerForJob(job, customers));
  if (linkableJobs.length > 0) {
    suggestions.push({
      id: 'link-job-customers',
      category: 'jobs',
      severity: 'warning',
      title: 'Jobs can be linked to customers',
      description: 'Some jobs have matching customer records but are not linked by customer ID, which can fragment customer history and reporting.',
      affectedRecords: linkableJobs.length,
      autoFixAvailable: true,
      applyLabel: 'Link matched jobs',
    });
  }

  const jobsMissingContact = jobs.filter(job => {
    if (!job.customerId) return false;
    const customer = customers.find(item => item.id === job.customerId);
    return !!customer && ((!job.customerEmail && customer.email) || (!job.customerPhone && customer.phone) || (!job.customer && customer.name));
  });
  if (jobsMissingContact.length > 0) {
    suggestions.push({
      id: 'sync-job-customer-contact',
      category: 'jobs',
      severity: 'info',
      title: 'Job contact fields can be filled',
      description: 'Linked customer records have phone, email, or name values missing from their jobs.',
      affectedRecords: jobsMissingContact.length,
      autoFixAvailable: true,
      applyLabel: 'Fill job contact fields',
    });
  }

  const invoicesNeedingBalanceSync = invoices.filter(invoice => {
    const { paid, balance } = getInvoiceBalance(invoice, paidByInvoice);
    const status = getNormalizedInvoiceStatus(invoice, paid, balance, now);
    return Math.round(Number(invoice.paidAmount || 0) * 100) !== Math.round(paid * 100)
      || Math.round(Number(invoice.balanceDue ?? invoice.amount) * 100) !== Math.round(balance * 100)
      || invoice.status !== status;
  });
  if (invoicesNeedingBalanceSync.length > 0) {
    suggestions.push({
      id: 'normalize-invoice-balances',
      category: 'billing',
      severity: 'critical',
      title: 'Invoice balances or statuses are stale',
      description: 'Payment records and invoice status fields disagree. Syncing them improves reports, reminders, and job balance totals.',
      affectedRecords: invoicesNeedingBalanceSync.length,
      autoFixAvailable: true,
      applyLabel: 'Sync invoice balances',
    });
  }

  const orphanPaymentCount = payments.filter(payment => !invoiceIds.has(payment.invoiceId)).length;
  if (orphanPaymentCount > 0) {
    suggestions.push({
      id: 'orphan-payments',
      category: 'billing',
      severity: 'critical',
      title: 'Payments are missing invoices',
      description: 'Some payments point to invoices that no longer exist. Review these before deleting or reassigning money.',
      affectedRecords: orphanPaymentCount,
      autoFixAvailable: false,
    });
  }

  const orphanJobRecordCount = [
    ...collection(data.tasks).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.expenses).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.timeEntries).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.invoices).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.notes).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.photos).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.changeOrders).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.jobLogs).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.punchLists).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.jobIssues).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.fileAttachments).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.materialOrders).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.shoppingLists).filter(record => record.jobId && !jobIds.has(record.jobId)),
    ...collection(data.allowances).filter(record => record.jobId && !jobIds.has(record.jobId)),
  ].length;
  if (orphanJobRecordCount > 0) {
    suggestions.push({
      id: 'orphan-job-records',
      category: 'records',
      severity: 'critical',
      title: 'Records reference missing jobs',
      description: 'Operational records point to jobs that are not in the workspace. Review before removing because these may be imported history.',
      affectedRecords: orphanJobRecordCount,
      autoFixAvailable: false,
    });
  }

  const completedJobsWithOpenTasks = jobs.filter(job => ['completed', 'closed'].includes(job.status))
    .filter(job => collection(data.tasks).some(task => task.jobId === job.id && task.status !== 'done'));
  if (completedJobsWithOpenTasks.length > 0) {
    suggestions.push({
      id: 'completed-jobs-open-tasks',
      category: 'jobs',
      severity: 'warning',
      title: 'Completed jobs still have open tasks',
      description: 'Open tasks on closed work can make progress and command-center recommendations look stale.',
      affectedRecords: completedJobsWithOpenTasks.length,
      autoFixAvailable: false,
    });
  }

  const staleMaterials = collection(data.materials).filter(material => material.isActive && (!material.unitPrice || material.unitPrice <= 0 || material.priceEstimateOnly));
  if (staleMaterials.length > 0) {
    suggestions.push({
      id: 'price-book-needs-review',
      category: 'price_book',
      severity: 'info',
      title: 'Price book items need review',
      description: 'Some active materials have missing prices or estimate-only pricing.',
      affectedRecords: staleMaterials.length,
      autoFixAvailable: false,
    });
  }

  const critical = suggestions.filter(item => item.severity === 'critical').length;
  const warning = suggestions.filter(item => item.severity === 'warning').length;
  const info = suggestions.filter(item => item.severity === 'info').length;
  const autoFixable = suggestions.filter(item => item.autoFixAvailable).length;
  const score = Math.max(0, Math.min(100, 100 - critical * 18 - warning * 10 - info * 4));
  const summary = suggestions.length
    ? `${suggestions.length} cleanup item${suggestions.length === 1 ? '' : 's'} found, ${autoFixable} safe fix${autoFixable === 1 ? '' : 'es'} available.`
    : 'Workspace data looks clean.';

  return {
    score,
    summary,
    suggestions: suggestions.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    totals: { critical, warning, info, autoFixable },
  };
}

export function applySmartDataCleanup(data: AppData, suggestionIds: string[] | string, now = new Date()): DataCleanupApplyResult {
  const ids = new Set(Array.isArray(suggestionIds) ? suggestionIds : [suggestionIds]);
  const customers = collection(data.customers);
  const paidByInvoice = getPaidByInvoice(data);
  let applied = 0;
  let next: AppData = { ...data };

  if (ids.has('link-job-customers')) {
    let count = 0;
    next = {
      ...next,
      jobs: collection(next.jobs).map(job => {
        if (job.customerId) return job;
        const customer = findCustomerForJob(job, customers);
        if (!customer) return job;
        count += 1;
        return {
          ...job,
          customerId: customer.id,
          customer: job.customer || customer.name,
          customerPhone: job.customerPhone || customer.phone,
          customerEmail: job.customerEmail || customer.email,
          updatedAt: new Date().toISOString(),
        };
      }),
    };
    if (count > 0) applied += 1;
  }

  if (ids.has('sync-job-customer-contact')) {
    let count = 0;
    next = {
      ...next,
      jobs: collection(next.jobs).map(job => {
        if (!job.customerId) return job;
        const customer = customers.find(item => item.id === job.customerId);
        if (!customer) return job;
        const updates = {
          customer: job.customer || customer.name,
          customerPhone: job.customerPhone || customer.phone,
          customerEmail: job.customerEmail || customer.email,
        };
        if (updates.customer === job.customer && updates.customerPhone === job.customerPhone && updates.customerEmail === job.customerEmail) return job;
        count += 1;
        return { ...job, ...updates, updatedAt: new Date().toISOString() };
      }),
    };
    if (count > 0) applied += 1;
  }

  if (ids.has('normalize-invoice-balances')) {
    let count = 0;
    next = {
      ...next,
      invoices: collection(next.invoices).map(invoice => {
        const { paid, balance } = getInvoiceBalance(invoice, paidByInvoice);
        const status = getNormalizedInvoiceStatus(invoice, paid, balance, now);
        if (invoice.paidAmount === paid && invoice.balanceDue === balance && invoice.status === status) return invoice;
        count += 1;
        return {
          ...invoice,
          paidAmount: paid,
          balanceDue: balance,
          status,
          updatedAt: new Date().toISOString(),
        };
      }),
    };
    if (count > 0) applied += 1;
  }

  return { data: next, applied };
}
