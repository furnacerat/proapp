import type { AppData, Estimate, Job, Material, Worker } from '../data/types';

export type UserRole = 'owner' | 'admin' | 'project_manager' | 'estimator' | 'crew' | 'viewer';

export interface UserProfile {
  id: string;
  user_id: string;
  role: UserRole;
  display_name?: string;
  email?: string;
  job_title?: string;
  active: boolean;
}

const ownerOnlyRoutes = ['/settings', '/reports', '/expenses', '/invoices'];
const crewRoutes = ['/', '/jobs', '/tasks', '/schedule', '/shopping-lists', '/time-entries'];

const routeAccess: Record<UserRole, string[]> = {
  owner: ['*'],
  admin: ['/', '/dashboard', '/jobs', '/customers', '/estimates', '/workers', '/time-entries', '/shopping-lists', '/tasks', '/schedule', '/admin/team'],
  project_manager: ['/', '/dashboard', '/jobs', '/customers', '/workers', '/time-entries', '/shopping-lists', '/tasks', '/schedule', '/estimates/orders', '/estimates/suppliers'],
  estimator: ['/', '/dashboard', '/customers', '/estimates', '/jobs', '/schedule'],
  crew: crewRoutes,
  viewer: ['/', '/dashboard', '/jobs', '/customers', '/tasks', '/schedule'],
};

export const roleLabels: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  project_manager: 'Project Manager',
  estimator: 'Estimator',
  crew: 'Crew',
  viewer: 'Viewer',
};

export const canViewOwnerFinancials = (role: UserRole) => role === 'owner';

export const canAccessRoute = (role: UserRole, pathname: string) => {
  if (role === 'owner') return true;
  if (ownerOnlyRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))) return false;
  if (pathname.startsWith('/admin/team') && !['owner', 'admin'].includes(role)) return false;
  if (role === 'crew' && pathname.startsWith('/jobs/') && pathname !== '/jobs/new') return true;
  if (role === 'estimator' && (pathname.startsWith('/estimates/orders') || pathname.startsWith('/estimates/suppliers'))) return false;

  const allowed = routeAccess[role];
  return allowed.some(route => {
    if (route === '*') return true;
    if (route === '/') return pathname === '/';
    return pathname === route || pathname.startsWith(`${route}/`);
  });
};

export const getDefaultRouteForRole = (role: UserRole) => role === 'crew' ? '/' : '/dashboard';

const redactWorkerPay = (worker: Worker): Worker => ({
  ...worker,
  hourlyRate: undefined,
  flatRate: undefined,
});

const redactJobFinancials = (job: Job): Job => ({
  ...job,
  contractAmount: 0,
  estimatedCost: 0,
  actualCost: 0,
});

const redactEstimateFinancials = (estimate: Estimate): Estimate => ({
  ...estimate,
  laborTotal: 0,
  materialTotal: 0,
  equipmentTotal: 0,
  subcontractorTotal: 0,
  subtotal: 0,
  markupPercent: 0,
  markupAmount: 0,
  projectedLaborCost: 0,
  projectedMaterialCost: 0,
  marginAmount: undefined,
  marginPercent: undefined,
});

const redactPriceBookCostSettings = (material: Material): Material => ({
  ...material,
  basePrice: undefined,
  currentPrice: undefined,
  priceSource: undefined,
  pricingSource: undefined,
  pricingVerified: undefined,
  priceEstimateOnly: undefined,
  matchConfidence: undefined,
  matchStatus: undefined,
});

const findCrewWorkerId = (data: AppData, profile: UserProfile | null) => {
  const email = profile?.email?.toLowerCase();
  return data.workers.find(worker =>
    (email && worker.email?.toLowerCase() === email) ||
    (profile?.user_id && (worker as Worker & { userId?: string; user_id?: string }).userId === profile.user_id) ||
    (profile?.user_id && (worker as Worker & { userId?: string; user_id?: string }).user_id === profile.user_id)
  )?.id;
};

export const sanitizeAppDataForRole = (data: AppData, profile: UserProfile | null): AppData => {
  const role = profile?.role || 'owner';
  if (role === 'owner') return data;

  let scoped = data;
  if (role === 'crew') {
    const workerId = findCrewWorkerId(data, profile);
    const assignedTasks = workerId
      ? data.tasks.filter(task => task.assignedTo === workerId)
      : [];
    const assignedJobIds = new Set(assignedTasks.map(task => task.jobId).filter(Boolean));
    scoped = {
      ...data,
      jobs: data.jobs.filter(job => assignedJobIds.has(job.id)),
      tasks: assignedTasks,
      shoppingLists: (data.shoppingLists || []).filter(list => assignedJobIds.has(list.jobId)),
      timeEntries: data.timeEntries.filter(entry => assignedJobIds.has(entry.jobId) || entry.workerId === workerId),
      notes: data.notes.filter(note => assignedJobIds.has(note.jobId)),
      photos: data.photos.filter(photo => assignedJobIds.has(photo.jobId)),
      timeline: (data.timeline || []).filter(item => assignedJobIds.has(item.jobId || '')),
      jobLogs: (data.jobLogs || []).filter(log => assignedJobIds.has(log.jobId)),
      punchLists: (data.punchLists || []).filter(item => assignedJobIds.has(item.jobId)),
      jobIssues: (data.jobIssues || []).filter(item => assignedJobIds.has(item.jobId)),
      fileAttachments: (data.fileAttachments || []).filter(item => assignedJobIds.has(item.jobId)),
      customers: [],
      estimates: [],
      assemblies: [],
      templates: [],
      projectTypeTemplates: [],
      estimateTemplates: [],
      materials: [],
      suppliers: [],
      materialOrders: [],
      allowances: [],
      receipts: [],
    };
  }

  return {
    ...scoped,
    workers: scoped.workers.map(redactWorkerPay),
    laborRates: [],
    expenses: [],
    invoices: [],
    payments: [],
    jobs: scoped.jobs.map(redactJobFinancials),
    estimates: scoped.estimates.map(redactEstimateFinancials),
    materials: scoped.materials.map(redactPriceBookCostSettings),
  };
};
