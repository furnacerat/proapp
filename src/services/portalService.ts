import type { AppData, ChangeOrder, Customer, Estimate, Invoice, Job, JobTimelineEntry, Note, Payment, Photo, PortalAccessToken, SignatureRequest } from '../data/types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { dataService } from './dataService';

export interface PortalWorkspace {
  access: PortalAccessToken;
  customer: Customer;
  jobs: Job[];
  estimates: Estimate[];
  invoices: Invoice[];
  payments: Payment[];
  changeOrders: ChangeOrder[];
  notes: Note[];
  photos: Photo[];
  timeline: JobTimelineEntry[];
  signatureRequests: SignatureRequest[];
}

const encoder = new TextEncoder();

export async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createPortalToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function portalUrlForToken(token: string) {
  return `${window.location.origin}/portal/${token}`;
}

function activeToken(access: PortalAccessToken) {
  if (!access.active) return false;
  if (!access.expiresAt) return true;
  return new Date(access.expiresAt).getTime() > Date.now();
}

function localPortalData(data: AppData, access: PortalAccessToken): PortalWorkspace | null {
  if (!activeToken(access)) return null;
  const customer = data.customers.find(item => item.id === access.customerId);
  if (!customer) return null;

  const jobs = (data.jobs || []).filter(job =>
    access.jobId ? job.id === access.jobId : job.customerId === customer.id || job.customerEmail === customer.email || job.customer === customer.name,
  );
  const jobIds = new Set(jobs.map(job => job.id));
  const estimates = (data.estimates || []).filter(estimate =>
    estimate.customerId === customer.id && (!access.jobId || estimate.convertedToJobId === access.jobId || jobs.some(job => job.estimateId === estimate.id)),
  );
  const invoices = (data.invoices || []).filter(invoice =>
    (invoice.customerId && invoice.customerId === customer.id) || jobIds.has(invoice.jobId),
  );
  const changeOrders = (data.changeOrders || []).filter(order => jobIds.has(order.jobId));
  const notes = (data.notes || []).filter(note => jobIds.has(note.jobId) && (note as Note & { clientVisible?: boolean }).clientVisible === true);
  const photos = (data.photos || []).filter(photo => jobIds.has(photo.jobId) && (photo as Photo & { clientVisible?: boolean }).clientVisible !== false);
  const timeline = (data.timeline || []).filter(entry =>
    jobIds.has(entry.jobId) && ['update', 'photo', 'change_order', 'invoice', 'payment'].includes(entry.type),
  );
  const signatureRequests = (data.signatureRequests || []).filter(request =>
    request.customerId === customer.id && (!access.jobId || request.jobId === access.jobId),
  );

  return {
    access,
    customer,
    jobs,
    estimates,
    invoices,
    payments: data.payments || [],
    changeOrders,
    notes,
    photos,
    timeline,
    signatureRequests,
  };
}

export async function createPortalAccess(customer: Customer, jobId?: string) {
  const token = createPortalToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const access: PortalAccessToken = {
    id: crypto.randomUUID(),
    tokenHash,
    customerId: customer.id,
    jobId,
    email: customer.email,
    label: jobId ? 'Project portal' : 'Customer portal',
    active: true,
    permissions: ['view', 'approve_estimates', 'approve_change_orders', 'view_invoices', 'sign_documents'],
    createdAt: now,
    updatedAt: now,
  };
  await dataService.portalTokens.create(access);
  return { access, token, url: portalUrlForToken(token) };
}

export async function getPortalWorkspace(token: string): Promise<PortalWorkspace | null> {
  const tokenHash = await sha256Hex(token);

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('get_customer_portal', { p_token: token });
    if (!error && data) return { ...(data as PortalWorkspace), signatureRequests: (data as Partial<PortalWorkspace>).signatureRequests || [] };
  }

  const data = dataService.local.getAppData();
  if (!data) return null;
  const access = (data.portalTokens || []).find(item => item.tokenHash === tokenHash);
  if (!access) return null;
  return localPortalData(data, access);
}

export async function approvePortalEstimate(token: string, estimateId: string, customerName: string) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc('portal_approve_estimate', { p_token: token, p_estimate_id: estimateId, p_customer_name: customerName });
    if (!error) return;
  }

  const data = dataService.local.getAppData();
  if (!data) return;
  const tokenHash = await sha256Hex(token);
  const access = (data.portalTokens || []).find(item => item.tokenHash === tokenHash);
  if (!access || !activeToken(access)) return;
  const now = new Date().toISOString();
  dataService.local.saveAppData({
    ...data,
    estimates: data.estimates.map(estimate => estimate.id === estimateId && estimate.customerId === access.customerId
      ? { ...estimate, status: 'approved', viewedAt: estimate.viewedAt || now, approvedAt: now, approvedBy: customerName, updatedAt: now } as Estimate
      : estimate),
  });
}

export async function approvePortalChangeOrder(token: string, changeOrderId: string, customerName: string) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc('portal_approve_change_order', { p_token: token, p_change_order_id: changeOrderId, p_customer_name: customerName });
    if (!error) return;
  }

  const data = dataService.local.getAppData();
  if (!data) return;
  const tokenHash = await sha256Hex(token);
  const access = (data.portalTokens || []).find(item => item.tokenHash === tokenHash);
  if (!access || !activeToken(access)) return;
  const allowedJobIds = new Set((data.jobs || []).filter(job => access.jobId ? job.id === access.jobId : job.customerId === access.customerId).map(job => job.id));
  const now = new Date().toISOString();
  dataService.local.saveAppData({
    ...data,
    changeOrders: data.changeOrders.map(order => order.id === changeOrderId && allowedJobIds.has(order.jobId)
      ? { ...order, status: 'approved', approvedAt: now, approvedBy: customerName, updatedAt: now } as ChangeOrder
      : order),
  });
}

export async function signPortalDocument(token: string, requestId: string, signatureText: string, signatureDataUrl: string, signerName: string) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc('portal_sign_document', {
      p_token: token,
      p_request_id: requestId,
      p_signature_text: signatureText,
      p_signature_data_url: signatureDataUrl,
      p_signer_name: signerName,
    });
    if (!error) return;
  }

  const data = dataService.local.getAppData();
  if (!data) return;
  const tokenHash = await sha256Hex(token);
  const access = (data.portalTokens || []).find(item => item.tokenHash === tokenHash);
  if (!access || !activeToken(access)) return;
  const now = new Date().toISOString();
  dataService.local.saveAppData({
    ...data,
    signatureRequests: (data.signatureRequests || []).map(request => {
      if (request.id !== requestId || request.customerId !== access.customerId) return request;
      if (access.jobId && request.jobId !== access.jobId) return request;
      return {
        ...request,
        status: 'signed',
        signatureText,
        signatureDataUrl,
        signerName,
        viewedAt: request.viewedAt || now,
        signedAt: now,
        updatedAt: now,
        auditTrail: [
          ...(request.auditTrail || []),
          { event: 'document_signed', timestamp: now, actor: signerName || 'Customer', details: 'Signed from customer portal' },
        ],
      } as SignatureRequest;
    }),
  });
}
