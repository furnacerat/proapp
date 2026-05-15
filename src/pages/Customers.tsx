import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate, parseDateString } from '../utils/formatters';
import { dataService } from '../services/dataService';
import { createPortalAccess } from '../services/portalService';
import type { Customer, Estimate, Invoice, Job, SignatureDocumentType } from '../data/types';
import {
  Activity,
  BadgeDollarSign,
  BriefcaseBusiness,
  ClipboardList,
  Copy,
  Edit,
  FilePlus2,
  FileSignature,
  Filter,
  Link2,
  Mail,
  MapPin,
  MessageSquarePlus,
  NotebookPen,
  Phone,
  Plus,
  Receipt,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';

type SegmentKey = 'all' | 'leads' | 'active' | 'past' | 'open_estimate' | 'balance_due';
type DetailTab = 'overview' | 'estimates' | 'jobs' | 'invoices' | 'documents' | 'notes';
type CommunicationPurpose = 'general_update' | 'estimate_follow_up' | 'job_update' | 'invoice_reminder' | 'schedule_confirmation' | 'delay_notice' | 'portal_invite';
type CommunicationChannel = 'email' | 'sms';

interface CommunicationDraft {
  subject: string;
  body: string;
  sms: string;
  tone: string;
  callToAction: string;
  warnings: string[];
}

const communicationPurposes: { value: CommunicationPurpose; label: string }[] = [
  { value: 'general_update', label: 'General update' },
  { value: 'estimate_follow_up', label: 'Estimate follow-up' },
  { value: 'job_update', label: 'Job update' },
  { value: 'invoice_reminder', label: 'Invoice reminder' },
  { value: 'schedule_confirmation', label: 'Schedule confirmation' },
  { value: 'delay_notice', label: 'Delay notice' },
  { value: 'portal_invite', label: 'Portal invite' },
];

interface CustomerSummary {
  customer: Customer;
  estimates: Estimate[];
  jobs: Job[];
  invoices: Invoice[];
  balanceDue: number;
  lifetimeValue: number;
  activeJobs: Job[];
  openEstimates: Estimate[];
  status: 'Lead' | 'Active Customer' | 'Past Customer';
}

interface RecommendedAction {
  message: string;
  buttonLabel: string;
  tab?: DetailTab;
  to?: string;
}

const openEstimateStatuses = new Set(['draft', 'in_review', 'sent', 'viewed', 'approved']);
const activeJobStatuses = new Set(['approved', 'scheduled', 'active', 'awaiting_materials', 'awaiting_payment']);

const statusClassMap: Record<CustomerSummary['status'], string> = {
  Lead: 'badge-blue',
  'Active Customer': 'badge-green',
  'Past Customer': 'badge-slate',
};

const segmentLabels: { key: SegmentKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'leads', label: 'Leads' },
  { key: 'active', label: 'Active Customers' },
  { key: 'past', label: 'Past Customers' },
  { key: 'open_estimate', label: 'Has Open Estimate' },
  { key: 'balance_due', label: 'Has Balance Due' },
];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] || 'C'}${parts[1]?.[0] || ''}`.toUpperCase();
};

const getCityState = (address?: string) => {
  if (!address) return 'No address';
  const parts = address.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(', ');
  return address;
};

const matchesCustomer = (customer: Customer, job: Job) => {
  if (job.customerId) return job.customerId === customer.id;
  const customerName = customer.name.toLowerCase();
  return job.customer?.toLowerCase() === customerName || job.customerEmail?.toLowerCase() === customer.email?.toLowerCase();
};

const getInvoiceBalance = (invoice: Invoice, payments: { invoiceId: string; amount: number }[]) => {
  const paid = payments.filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + payment.amount, 0);
  return Math.max(invoice.amount - paid, 0);
};

export function Customers() {
  const {
    customers: contextCustomers,
    setData,
    estimates,
    jobs,
    invoices,
    payments,
    branding,
    sendEmail,
    convertEstimateToJob,
    getJobProgress,
    getJobProfit,
    signatureRequests,
    addSignatureRequest,
  } = useApp();
  const { session } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>(contextCustomers);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [customerLoadError, setCustomerLoadError] = useState('');
  const [segment, setSegment] = useState<SegmentKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(contextCustomers[0]?.id || null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [portalLink, setPortalLink] = useState('');
  const [signatureForm, setSignatureForm] = useState({
    title: '',
    documentType: 'contract' as SignatureDocumentType,
    jobId: '',
    documentBody: '',
    message: '',
    expiresAt: '',
  });
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', address: '', notes: ''
  });
  const [communicationForm, setCommunicationForm] = useState({
    purpose: 'general_update' as CommunicationPurpose,
    channel: 'email' as CommunicationChannel,
    customPrompt: '',
  });
  const [communicationDraft, setCommunicationDraft] = useState<CommunicationDraft | null>(null);
  const [isGeneratingCommunication, setIsGeneratingCommunication] = useState(false);
  const [isSendingCommunication, setIsSendingCommunication] = useState(false);

  const refreshCustomers = async () => {
    setIsLoadingCustomers(true);
    setCustomerLoadError('');
    try {
      const loaded = await dataService.customers.getAll();
      setCustomers(loaded);
      setSelectedId(current => current && loaded.some(customer => customer.id === current)
        ? current
        : loaded[0]?.id || null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load customers';
      setCustomerLoadError(message);
      setCustomers(contextCustomers);
      showToast(message, 'error');
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  useEffect(() => {
    refreshCustomers();
  }, []);

  const summaries = useMemo<CustomerSummary[]>(() => customers.map(customer => {
    const customerEstimates = estimates.filter(estimate => estimate.customerId === customer.id);
    const customerJobs = jobs.filter(job => matchesCustomer(customer, job));
    const customerInvoices = invoices.filter(invoice => customerJobs.some(job => job.id === invoice.jobId));
    const balanceDue = customerInvoices.reduce((sum, invoice) => sum + getInvoiceBalance(invoice, payments), 0);
    const lifetimeValue = customerJobs.reduce((sum, job) => sum + job.contractAmount, 0);
    const activeJobs = customerJobs.filter(job => activeJobStatuses.has(job.status));
    const openEstimates = customerEstimates.filter(estimate => openEstimateStatuses.has(estimate.status) && !estimate.convertedToJobId);
    const status: CustomerSummary['status'] = activeJobs.length > 0
      ? 'Active Customer'
      : customerEstimates.length > 0 && customerJobs.length === 0
        ? 'Lead'
        : 'Past Customer';

    return {
      customer,
      estimates: customerEstimates,
      jobs: customerJobs,
      invoices: customerInvoices,
      balanceDue,
      lifetimeValue,
      activeJobs,
      openEstimates,
      status,
    };
  }), [customers, estimates, jobs, invoices, payments]);

  const filteredSummaries = useMemo(() => {
    const s = search.toLowerCase();
    return summaries.filter(summary => {
      const { customer } = summary;
      const matchesSearch = !search ||
        customer.name.toLowerCase().includes(s) ||
        customer.company?.toLowerCase().includes(s) ||
        customer.email?.toLowerCase().includes(s) ||
        customer.phone?.toLowerCase().includes(s) ||
        customer.address?.toLowerCase().includes(s);

      if (!matchesSearch) return false;
      if (segment === 'leads') return summary.status === 'Lead';
      if (segment === 'active') return summary.status === 'Active Customer';
      if (segment === 'past') return summary.status === 'Past Customer';
      if (segment === 'open_estimate') return summary.openEstimates.length > 0;
      if (segment === 'balance_due') return summary.balanceDue > 0;
      return true;
    });
  }, [search, segment, summaries]);

  const selectedSummary = summaries.find(summary => summary.customer.id === selectedId) || filteredSummaries[0] || summaries[0];
  const selectedCustomer = selectedSummary?.customer;
  const selectedRecommendedAction = selectedSummary ? getRecommendedAction(selectedSummary) : null;
  const selectedSignatureRequests = useMemo(() => (
    selectedCustomer
      ? (signatureRequests || []).filter(request => request.customerId === selectedCustomer.id)
      : []
  ), [selectedCustomer, signatureRequests]);

  const kpis = useMemo(() => {
    const activeJobsCount = summaries.reduce((sum, summary) => sum + summary.activeJobs.length, 0);
    const openEstimatesCount = summaries.reduce((sum, summary) => sum + summary.openEstimates.length, 0);
    const outstandingBalance = summaries.reduce((sum, summary) => sum + summary.balanceDue, 0);
    return [
      { label: 'Total Customers', value: customers.length.toString(), sub: `${filteredSummaries.length} visible`, icon: Users },
      { label: 'Active Jobs', value: activeJobsCount.toString(), sub: 'In production or scheduled', icon: BriefcaseBusiness },
      { label: 'Open Estimates', value: openEstimatesCount.toString(), sub: 'Draft, sent, or approved', icon: ClipboardList },
      { label: 'Outstanding Balance', value: formatCurrency(outstandingBalance), sub: 'Across customer invoices', icon: BadgeDollarSign },
    ];
  }, [customers.length, filteredSummaries.length, summaries]);

  const noteEntries = useMemo(() => {
    if (!selectedCustomer?.notes) return [];
    return selectedCustomer.notes.split('\n').map(note => note.trim()).filter(Boolean);
  }, [selectedCustomer]);

  const handleSave = async () => {
    if (!form.name) { showToast('Enter customer name', 'error'); return; }

    try {
      if (editingCustomer) {
        const updated = await dataService.customers.update(editingCustomer.id, form);
        if (!updated) throw new Error('Customer was not found.');
        setCustomers(prev => prev.map(customer => customer.id === editingCustomer.id ? updated : customer));
        setData(prev => ({ ...prev, customers: prev.customers.map(customer => customer.id === editingCustomer.id ? updated : customer) }));
        showToast('Customer updated');
        setSelectedId(editingCustomer.id);
      } else {
        const timestamp = new Date().toISOString();
        const created = await dataService.customers.create({
          id: crypto.randomUUID(),
          ...form,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        setCustomers(prev => [...prev, created]);
        setData(prev => ({ ...prev, customers: [...prev.customers, created] }));
        showToast('Customer created');
        setSelectedId(created.id);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Customer save failed', 'error');
      return;
    }

    setForm({ name: '', company: '', email: '', phone: '', address: '', notes: '' });
    setShowModal(false);
    setEditingCustomer(null);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || '',
      company: customer.company || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      try {
        await dataService.customers.delete(deleteId);
        setCustomers(prev => prev.filter(customer => customer.id !== deleteId));
        setData(prev => ({ ...prev, customers: prev.customers.filter(customer => customer.id !== deleteId) }));
        showToast('Customer deleted');
        setDeleteId(null);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Customer delete failed', 'error');
      }
    }
  };

  const handleNewCustomer = () => {
    setEditingCustomer(null);
    setForm({ name: '', company: '', email: '', phone: '', address: '', notes: '' });
    setShowModal(true);
  };

  const handleAddNote = () => {
    if (!selectedCustomer || !noteDraft.trim()) return;
    const timestamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const nextNotes = [selectedCustomer.notes, `[${timestamp}] ${noteDraft.trim()}`].filter(Boolean).join('\n');
    dataService.customers.update(selectedCustomer.id, { notes: nextNotes })
      .then(updated => {
        if (!updated) return;
        setCustomers(prev => prev.map(customer => customer.id === selectedCustomer.id ? updated : customer));
        setData(prev => ({ ...prev, customers: prev.customers.map(customer => customer.id === selectedCustomer.id ? updated : customer) }));
      })
      .catch(error => showToast(error instanceof Error ? error.message : 'Note save failed', 'error'));
    setNoteDraft('');
    showToast('Note added');
  };

  const handleRecommendedAction = () => {
    if (!selectedRecommendedAction) return;
    if (selectedRecommendedAction.tab) setActiveTab(selectedRecommendedAction.tab);
    if (selectedRecommendedAction.to) navigate(selectedRecommendedAction.to);
  };

  const handleUpdateNote = (index: number) => {
    if (!selectedCustomer || !editingNoteText.trim()) return;
    const nextNotes = noteEntries.map((note, noteIndex) => noteIndex === index ? editingNoteText.trim() : note).join('\n');
    dataService.customers.update(selectedCustomer.id, { notes: nextNotes })
      .then(updated => {
        if (!updated) return;
        setCustomers(prev => prev.map(customer => customer.id === selectedCustomer.id ? updated : customer));
        setData(prev => ({ ...prev, customers: prev.customers.map(customer => customer.id === selectedCustomer.id ? updated : customer) }));
      })
      .catch(error => showToast(error instanceof Error ? error.message : 'Note update failed', 'error'));
    setEditingNoteIndex(null);
    setEditingNoteText('');
    showToast('Note updated');
  };

  const handleDeleteNote = (index: number) => {
    if (!selectedCustomer) return;
    dataService.customers.update(selectedCustomer.id, { notes: noteEntries.filter((_, noteIndex) => noteIndex !== index).join('\n') })
      .then(updated => {
        if (!updated) return;
        setCustomers(prev => prev.map(customer => customer.id === selectedCustomer.id ? updated : customer));
        setData(prev => ({ ...prev, customers: prev.customers.map(customer => customer.id === selectedCustomer.id ? updated : customer) }));
      })
      .catch(error => showToast(error instanceof Error ? error.message : 'Note delete failed', 'error'));
    showToast('Note deleted');
  };

  const handleConvertEstimate = (estimate: Estimate) => {
    const jobId = convertEstimateToJob(estimate.id);
    showToast('Estimate converted to job');
    navigate(`/jobs/${jobId}`);
  };

  const logContact = () => {
    if (!selectedCustomer) return;
    const timestamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    dataService.customers.update(selectedCustomer.id, {
      notes: [selectedCustomer.notes, `[${timestamp}] Contact logged with ${selectedCustomer.name}.`].filter(Boolean).join('\n')
    })
      .then(updated => {
        if (!updated) return;
        setCustomers(prev => prev.map(customer => customer.id === selectedCustomer.id ? updated : customer));
        setData(prev => ({ ...prev, customers: prev.customers.map(customer => customer.id === selectedCustomer.id ? updated : customer) }));
      })
      .catch(error => showToast(error instanceof Error ? error.message : 'Contact log failed', 'error'));
    showToast('Contact logged');
    setActiveTab('notes');
  };

  const handleCreatePortalLink = async () => {
    if (!selectedCustomer) return;
    try {
      const { access, url } = await createPortalAccess(selectedCustomer);
      setPortalLink(url);
      setData(prev => ({ ...prev, portalTokens: [...(prev.portalTokens || []), access] }));
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url).catch(() => undefined);
      }
      showToast('Customer portal link copied');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create portal link', 'error');
    }
  };

  const openSignatureRequest = () => {
    if (!selectedCustomer) return;
    const primaryJob = selectedSummary?.activeJobs[0] || selectedSummary?.jobs[0];
    const defaultExpires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setSignatureForm({
      title: `${selectedCustomer.name} document approval`,
      documentType: 'contract',
      jobId: primaryJob?.id || '',
      documentBody: '',
      message: 'Please review and sign this document from your customer portal.',
      expiresAt: defaultExpires,
    });
    setShowSignatureModal(true);
  };

  const handleCreateSignatureRequest = async () => {
    if (!selectedCustomer) return;
    if (!signatureForm.title.trim() || !signatureForm.documentBody.trim()) {
      showToast('Add a title and document text before sending', 'warning');
      return;
    }
    try {
      const { access, url } = await createPortalAccess(selectedCustomer, signatureForm.jobId || undefined);
      setData(prev => ({ ...prev, portalTokens: [...(prev.portalTokens || []), access] }));
      addSignatureRequest({
        customerId: selectedCustomer.id,
        jobId: signatureForm.jobId || undefined,
        portalTokenId: access.id,
        title: signatureForm.title.trim(),
        documentTitle: signatureForm.title.trim(),
        documentType: signatureForm.documentType,
        documentBody: signatureForm.documentBody.trim(),
        message: signatureForm.message.trim() || undefined,
        signerName: selectedCustomer.name,
        signerEmail: selectedCustomer.email,
        signerPhone: selectedCustomer.phone,
        sentAt: new Date().toISOString(),
        expiresAt: signatureForm.expiresAt || undefined,
        status: 'sent',
      });
      setPortalLink(url);
      setActiveTab('documents');
      setShowSignatureModal(false);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url).catch(() => undefined);
      }
      showToast('Signature request created and portal link copied');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create signature request', 'error');
    }
  };

  const appendCustomerNote = async (text: string, successMessage = 'Note added') => {
    if (!selectedCustomer || !text.trim()) return;
    const timestamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const nextNotes = [selectedCustomer.notes, `[${timestamp}] ${text.trim()}`].filter(Boolean).join('\n');
    try {
      const updated = await dataService.customers.update(selectedCustomer.id, { notes: nextNotes });
      if (!updated) return;
      setCustomers(prev => prev.map(customer => customer.id === selectedCustomer.id ? updated : customer));
      setData(prev => ({ ...prev, customers: prev.customers.map(customer => customer.id === selectedCustomer.id ? updated : customer) }));
      showToast(successMessage);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Note save failed', 'error');
    }
  };

  const generateCommunication = async () => {
    if (!selectedCustomer || !selectedSummary) return;
    if (branding.smartFeaturesEnabled === false) {
      showToast('Smart Mode is turned off in settings', 'warning');
      return;
    }
    setIsGeneratingCommunication(true);
    setCommunicationDraft(null);
    try {
      const response = await fetch('/api/customers/communication', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          purpose: communicationForm.purpose,
          channel: communicationForm.channel,
          customPrompt: communicationForm.customPrompt,
          company: {
            name: branding.brandName || 'Your Company',
            phone: branding.phone || '',
            email: branding.emailFromAddress,
          },
          customer: selectedCustomer,
          context: {
            status: selectedSummary.status,
            balanceDue: selectedSummary.balanceDue,
            lifetimeValue: selectedSummary.lifetimeValue,
            portalLink,
            jobs: selectedSummary.jobs.map(job => ({
              name: job.name,
              status: job.status,
              address: job.address,
              startDate: job.startDate,
              dueDate: job.dueDate,
              contractAmount: job.contractAmount,
              notes: job.notes,
            })),
            estimates: selectedSummary.estimates.map(estimate => ({
              name: estimate.name,
              status: estimate.status,
              total: estimate.total,
              validUntil: estimate.validUntil,
              updatedAt: estimate.updatedAt,
            })),
            invoices: selectedSummary.invoices.map(invoice => ({
              invoiceNumber: invoice.invoiceNumber,
              status: invoice.status,
              amount: invoice.amount,
              dueDate: invoice.dueDate,
              balance: getInvoiceBalance(invoice, payments),
            })),
            recentNotes: noteEntries.slice(-8),
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Communication generation failed');
      setCommunicationDraft(data as CommunicationDraft);
      showToast('Customer message draft ready');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Communication generation failed', 'error');
    } finally {
      setIsGeneratingCommunication(false);
    }
  };

  const copyCommunication = async () => {
    if (!communicationDraft) return;
    const text = communicationForm.channel === 'sms'
      ? communicationDraft.sms
      : `Subject: ${communicationDraft.subject}\n\n${communicationDraft.body}`;
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    showToast('Message copied');
  };

  const sendCommunication = async () => {
    if (!selectedCustomer || !communicationDraft) return;
    if (communicationForm.channel === 'sms') {
      if (!selectedCustomer.phone) {
        showToast('Add a customer phone number before texting', 'warning');
        return;
      }
      const separator = navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') ? '&' : '?';
      window.location.href = `sms:${selectedCustomer.phone}${separator}body=${encodeURIComponent(communicationDraft.sms)}`;
      await appendCustomerNote(`Text draft opened: ${communicationDraft.sms}`, 'Customer text logged');
      return;
    }

    if (!selectedCustomer.email) {
      showToast('Add a customer email before sending', 'warning');
      return;
    }
    setIsSendingCommunication(true);
    const html = communicationDraft.body
      .split('\n')
      .filter(Boolean)
      .map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
      .join('');
    try {
      const delivered = await sendEmail({
        to: selectedCustomer.email,
        subject: communicationDraft.subject,
        text: communicationDraft.body,
        html,
      });
      await appendCustomerNote(`${delivered ? 'Email sent' : 'Email draft opened'}: ${communicationDraft.subject}`, delivered ? 'Customer email sent and logged' : 'Customer email draft logged');
    } finally {
      setIsSendingCommunication(false);
    }
  };

  if (isLoadingCustomers) {
    return (
      <div>
        <div className="customers-page-header page-header">
          <div>
            <div className="page-eyebrow">CRM Command Center</div>
            <h1 className="page-title">Customers</h1>
            <p className="page-subtitle">Manage clients, job history, estimates, invoices, and contact details in one place.</p>
          </div>
        </div>
        <div className="customers-page page-content">
          <div className="card"><div className="card-body">Loading customers...</div></div>
        </div>
      </div>
    );
  }

  if (customerLoadError) {
    return (
      <div>
        <div className="customers-page-header page-header">
          <div>
            <div className="page-eyebrow">CRM Command Center</div>
            <h1 className="page-title">Customers</h1>
            <p className="page-subtitle">Manage clients, job history, estimates, invoices, and contact details in one place.</p>
          </div>
          <button className="btn btn-secondary" onClick={refreshCustomers}>Retry</button>
        </div>
        <div className="customers-page page-content">
          <div className="card"><div className="card-body text-danger">{customerLoadError}</div></div>
        </div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div>
        <div className="customers-page-header page-header">
          <div>
            <div className="page-eyebrow">CRM Command Center</div>
            <h1 className="page-title">Customers</h1>
            <p className="page-subtitle">Manage clients, job history, estimates, invoices, and contact details in one place.</p>
          </div>
          <button className="btn btn-primary" onClick={handleNewCustomer}><Plus size={18} /> Add Customer</button>
        </div>
        <div className="customers-page page-content">
          <div className="customers-empty-state">
            <div className="customers-empty-icon"><UserRound size={34} /></div>
            <h2>Add your first customer</h2>
            <p>Customers connect estimates, jobs, invoices, and payments together.</p>
            <div className="customers-empty-actions">
              <button className="btn btn-primary" onClick={handleNewCustomer}><Plus size={18} /> Add Customer</button>
            </div>
          </div>
        </div>
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Customer">
          <CustomerForm form={form} setForm={setForm} onCancel={() => setShowModal(false)} onSave={handleSave} isEditing={false} />
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <div className="customers-page-header page-header">
        <div>
          <div className="page-eyebrow">CRM Command Center</div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage clients, job history, estimates, invoices, and contact details in one place.</p>
        </div>
        <div className="customers-header-actions">
          <div className="customers-search">
            <Search size={18} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customers..." />
          </div>
          <button className="btn btn-secondary" onClick={() => { setSearch(''); setSegment('all'); }} disabled={!search && segment === 'all'}><Filter size={18} /> Clear Filters</button>
          <button className="btn btn-primary" onClick={handleNewCustomer}><Plus size={18} /> Add Customer</button>
        </div>
      </div>

      <div className="customers-page page-content">
        <div className="customers-kpi-grid">
          {kpis.map(({ label, value, sub, icon: Icon }) => (
            <div className="customers-kpi-card" key={label}>
              <div className="customers-kpi-icon"><Icon size={20} /></div>
              <div>
                <div className="customers-kpi-label">{label}</div>
                <div className="customers-kpi-value">{value}</div>
                <div className="customers-kpi-sub">{sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="customers-segments">
          {segmentLabels.map(item => (
            <button
              key={item.key}
              className={`customers-chip ${segment === item.key ? 'active' : ''}`}
              onClick={() => setSegment(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="customers-command-grid">
          <section className="customers-list-panel">
            <div className="customers-panel-title">
              <span>{filteredSummaries.length} customer{filteredSummaries.length === 1 ? '' : 's'}</span>
              <span>{segmentLabels.find(item => item.key === segment)?.label}</span>
            </div>
            <div className="customers-list">
              {filteredSummaries.length === 0 ? (
                <div className="customers-no-results">
                  <Search size={28} />
                  <h3>No matching customers</h3>
                  <p>Try a different search or segment.</p>
                </div>
              ) : filteredSummaries.map(summary => (
                <div
                  key={summary.customer.id}
                  role="button"
                  tabIndex={0}
                  className={`customer-card ${selectedCustomer?.id === summary.customer.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedId(summary.customer.id);
                    setActiveTab('overview');
                  }}
                  onKeyDown={event => {
                    if (event.currentTarget !== event.target) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedId(summary.customer.id);
                      setActiveTab('overview');
                    }
                  }}
                >
                  <div className="customer-card-top">
                    <div className="customer-avatar">{getInitials(summary.customer.name)}</div>
                    <div className="customer-card-main">
                      <div className="customer-card-name">{summary.customer.name}</div>
                      <div className="customer-card-company">{summary.customer.company || 'Residential client'}</div>
                    </div>
                    <span className={`badge ${statusClassMap[summary.status]}`}>{summary.status}</span>
                  </div>
                  <div className="customer-card-contact">
                    <span><Mail size={14} /> {summary.customer.email || 'No email'}</span>
                    <span><Phone size={14} /> {summary.customer.phone || 'No phone'}</span>
                    <span><MapPin size={14} /> {getCityState(summary.customer.address)}</span>
                  </div>
                  <div className="customer-card-stats">
                    <span><strong>{summary.estimates.length}</strong> estimates</span>
                    <span><strong>{summary.jobs.length}</strong> jobs</span>
                    <span><strong>{formatCurrency(summary.balanceDue)}</strong> due</span>
                  </div>
                  <div className="customer-card-actions" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
                    <a className="customer-icon-btn" href={summary.customer.phone ? `tel:${summary.customer.phone}` : undefined} title="Call"><Phone size={16} /></a>
                    <a className="customer-icon-btn" href={summary.customer.email ? `mailto:${summary.customer.email}` : undefined} title="Email"><Mail size={16} /></a>
                    <Link className="customer-icon-btn" to="/estimates/new" title="New Estimate"><FilePlus2 size={16} /></Link>
                    <button className="customer-icon-btn" onClick={() => handleEdit(summary.customer)} title="Edit"><Edit size={16} /></button>
                    <button className="customer-icon-btn danger" onClick={() => setDeleteId(summary.customer.id)} title="Delete"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {selectedSummary && selectedCustomer && (
            <aside className="customer-detail-panel">
              <div className="customer-detail-hero">
                <div className="customer-avatar large">{getInitials(selectedCustomer.name)}</div>
                <div>
                  <h2>{selectedCustomer.name}</h2>
                  <p>{selectedCustomer.company || 'Residential client'}</p>
                  <span className={`badge ${statusClassMap[selectedSummary.status]}`}>{selectedSummary.status}</span>
                </div>
                <button className="customer-icon-btn" onClick={() => handleEdit(selectedCustomer)} title="Edit customer"><Edit size={17} /></button>
              </div>

              <div className="customer-smart-actions">
                <Link className="btn btn-primary btn-sm" to="/estimates/new"><FilePlus2 size={16} /> New Estimate</Link>
                <Link className="btn btn-secondary btn-sm" to="/jobs"><BriefcaseBusiness size={16} /> New Job</Link>
                <Link className="btn btn-secondary btn-sm" to="/invoices"><Receipt size={16} /> Create Invoice</Link>
                <button className="btn btn-secondary btn-sm" onClick={handleCreatePortalLink}><Link2 size={16} /> Portal Link</button>
                <button className="btn btn-secondary btn-sm" onClick={openSignatureRequest}><FileSignature size={16} /> Request Signature</button>
                <button className="btn btn-secondary btn-sm" onClick={logContact}><Phone size={16} /> Log Contact</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('notes')}><MessageSquarePlus size={16} /> Add Note</button>
              </div>

              <div className="customer-communication-generator">
                <div className="customer-communication-head">
                  <div>
                    <span><Sparkles size={15} /> Customer Communication Generator</span>
                    <strong>Draft a polished email or text</strong>
                  </div>
                  <span className="customer-communication-pill">{branding.smartFeaturesEnabled === false ? 'Smart Mode Off' : 'AI Ready'}</span>
                </div>
                <div className="customer-communication-form">
                  <label>
                    <span>Purpose</span>
                    <select value={communicationForm.purpose} onChange={event => setCommunicationForm({ ...communicationForm, purpose: event.target.value as CommunicationPurpose })}>
                      {communicationPurposes.map(purpose => <option key={purpose.value} value={purpose.value}>{purpose.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Channel</span>
                    <select value={communicationForm.channel} onChange={event => setCommunicationForm({ ...communicationForm, channel: event.target.value as CommunicationChannel })}>
                      <option value="email">Email</option>
                      <option value="sms">Text</option>
                    </select>
                  </label>
                </div>
                <textarea
                  className="customer-communication-prompt"
                  value={communicationForm.customPrompt}
                  onChange={event => setCommunicationForm({ ...communicationForm, customPrompt: event.target.value })}
                  placeholder="Optional direction: mention schedule change, ask for approval, keep it short, explain next steps..."
                />
                <div className="customer-communication-actions">
                  <button className="btn btn-primary btn-sm" onClick={generateCommunication} disabled={branding.smartFeaturesEnabled === false || isGeneratingCommunication}>
                    <Sparkles size={16} /> {isGeneratingCommunication ? 'Drafting...' : 'Generate'}
                  </button>
                  {communicationDraft && (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={copyCommunication}><Copy size={16} /> Copy</button>
                      <button className="btn btn-secondary btn-sm" onClick={sendCommunication} disabled={isSendingCommunication}>
                        <Send size={16} /> {communicationForm.channel === 'sms' ? 'Open Text' : isSendingCommunication ? 'Sending...' : 'Send Email'}
                      </button>
                    </>
                  )}
                </div>
                {branding.smartFeaturesEnabled === false && (
                  <div className="customer-communication-warning">Turn Smart Mode on in Settings to generate customer messages.</div>
                )}
                {communicationDraft && (
                  <div className="customer-communication-draft">
                    {communicationForm.channel === 'email' && (
                      <label>
                        <span>Subject</span>
                        <input value={communicationDraft.subject} onChange={event => setCommunicationDraft({ ...communicationDraft, subject: event.target.value })} />
                      </label>
                    )}
                    <label>
                      <span>{communicationForm.channel === 'sms' ? 'Text message' : 'Email body'}</span>
                      <textarea
                        value={communicationForm.channel === 'sms' ? communicationDraft.sms : communicationDraft.body}
                        onChange={event => setCommunicationDraft(communicationForm.channel === 'sms'
                          ? { ...communicationDraft, sms: event.target.value }
                          : { ...communicationDraft, body: event.target.value })}
                      />
                    </label>
                    <div className="customer-communication-meta">
                      <span>{communicationDraft.tone}</span>
                      <span>{communicationDraft.callToAction}</span>
                    </div>
                    {communicationDraft.warnings.length > 0 && (
                      <div className="customer-communication-warning">{communicationDraft.warnings.join(' ')}</div>
                    )}
                  </div>
                )}
              </div>

              {portalLink && (
                <div className="customer-portal-share">
                  <div>
                    <strong>Customer portal ready</strong>
                    <span>Send this link by email or text. It opens a limited customer view.</span>
                  </div>
                  <input value={portalLink} readOnly onFocus={event => event.currentTarget.select()} />
                  <a className="btn btn-primary btn-sm" href={selectedCustomer.email ? `mailto:${selectedCustomer.email}?subject=${encodeURIComponent('Your project portal')}&body=${encodeURIComponent(`Here is your project portal link:\n\n${portalLink}`)}` : `sms:${selectedCustomer.phone || ''}?&body=${encodeURIComponent(`Your project portal: ${portalLink}`)}`}>
                    <Mail size={16} /> Send
                  </a>
                </div>
              )}

              <div className="customer-detail-metrics">
                <Metric label="Lifetime Value" value={formatCurrency(selectedSummary.lifetimeValue)} />
                <Metric label="Balance Due" value={formatCurrency(selectedSummary.balanceDue)} tone={selectedSummary.balanceDue > 0 ? 'warning' : 'good'} />
                <Metric label="Active Jobs" value={selectedSummary.activeJobs.length.toString()} />
                <Metric label="Open Estimates" value={selectedSummary.openEstimates.length.toString()} />
              </div>

              <div className="customer-tabs">
                {(['overview', 'estimates', 'jobs', 'invoices', 'documents', 'notes'] as DetailTab[]).map(tab => (
                  <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
                    {tab}
                  </button>
                ))}
              </div>

              <div className="customer-tab-body">
                {activeTab === 'overview' && (
                  <div className="customer-overview-grid">
                    <InfoBlock icon={Mail} label="Email" value={selectedCustomer.email || 'No email on file'} />
                    <InfoBlock icon={Phone} label="Phone" value={selectedCustomer.phone || 'No phone on file'} />
                    <InfoBlock icon={MapPin} label="Address" value={selectedCustomer.address || 'No address on file'} wide />
                    <InfoBlock icon={Activity} label="Recent Activity" value={getRecentActivity(selectedSummary)} wide />
                    <InfoBlock icon={ClipboardList} label="Last Estimate" value={selectedSummary.estimates[0] ? `${selectedSummary.estimates[0].name} - ${formatCurrency(selectedSummary.estimates[0].total)}` : 'No estimates yet'} />
                    <InfoBlock icon={BriefcaseBusiness} label="Last Job" value={selectedSummary.jobs[0] ? selectedSummary.jobs[0].name : 'No jobs yet'} />
                    {selectedRecommendedAction && (
                      <div className="customer-recommendation">
                        <Sparkles size={18} />
                        <div>
                          <span>Next recommended action</span>
                          <strong>{selectedRecommendedAction.message}</strong>
                        </div>
                        <button className="btn btn-sm btn-primary" onClick={handleRecommendedAction}>
                          {selectedRecommendedAction.buttonLabel}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'estimates' && (
                  <RecordList empty="No estimates for this customer yet.">
                    {selectedSummary.estimates.map(estimate => (
                      <div className="customer-record" key={estimate.id}>
                        <div>
                          <Link to={`/estimates/${estimate.id}`} className="customer-record-title">{estimate.name}</Link>
                          <span>{formatDate(estimate.updatedAt)} · {estimate.estimateNumber}</span>
                        </div>
                        <span className="badge badge-blue">{estimate.status.replace('_', ' ')}</span>
                        <strong>{formatCurrency(estimate.total)}</strong>
                        {estimate.status === 'approved' && !estimate.convertedToJobId ? (
                          <button className="btn btn-sm btn-primary" onClick={() => handleConvertEstimate(estimate)}>Convert to Job</button>
                        ) : (
                          <Link className="btn btn-sm btn-secondary" to={`/estimates/${estimate.id}`}>View</Link>
                        )}
                      </div>
                    ))}
                  </RecordList>
                )}

                {activeTab === 'jobs' && (
                  <RecordList empty="No jobs for this customer yet.">
                    {selectedSummary.jobs.map(job => {
                      const profit = getJobProfit(job.id);
                      return (
                        <div className="customer-record" key={job.id}>
                          <div>
                            <Link to={`/jobs/${job.id}`} className="customer-record-title">{job.name}</Link>
                            <span>{job.status.replace('_', ' ')} · {getJobProgress(job.id)}% progress</span>
                          </div>
                          <div className="customer-progress"><span style={{ width: `${getJobProgress(job.id)}%` }} /></div>
                          <strong className={profit.profit >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(profit.profit)}</strong>
                          <Link className="btn btn-sm btn-secondary" to={`/jobs/${job.id}`}>View Job</Link>
                        </div>
                      );
                    })}
                  </RecordList>
                )}

                {activeTab === 'invoices' && (
                  <RecordList empty="No invoices for this customer yet.">
                    {selectedSummary.invoices.map(invoice => {
                      const balance = getInvoiceBalance(invoice, payments);
                      return (
                        <div className="customer-record" key={invoice.id}>
                          <div>
                            <div className="customer-record-title">{invoice.invoiceNumber}</div>
                            <span>Due {invoice.dueDate ? formatDate(invoice.dueDate) : 'not set'}</span>
                          </div>
                          <span className={`badge ${balance > 0 ? 'badge-orange' : 'badge-green'}`}>{balance > 0 ? 'unpaid' : 'paid'}</span>
                          <strong>{formatCurrency(invoice.amount)}</strong>
                          <span className="customer-record-muted">{invoice.status}</span>
                        </div>
                      );
                    })}
                  </RecordList>
                )}

                {activeTab === 'documents' && (
                  <RecordList empty="No signature requests for this customer yet.">
                    {selectedSignatureRequests.map(request => (
                      <div className="customer-record" key={request.id}>
                        <div>
                          <div className="customer-record-title">{request.title}</div>
                          <span>{request.documentType.replace('_', ' ')} {request.sentAt ? `sent ${formatDate(request.sentAt)}` : `created ${formatDate(request.createdAt)}`}</span>
                        </div>
                        <span className={`badge ${request.status === 'signed' ? 'badge-green' : request.status === 'sent' ? 'badge-blue' : 'badge-slate'}`}>{request.status}</span>
                        <span className="customer-record-muted">{request.signedAt ? `Signed ${formatDate(request.signedAt)}` : request.expiresAt ? `Expires ${formatDate(request.expiresAt)}` : 'No expiry'}</span>
                        <button className="btn btn-sm btn-secondary" onClick={openSignatureRequest}>New Request</button>
                      </div>
                    ))}
                  </RecordList>
                )}

                {activeTab === 'notes' && (
                  <div className="customer-notes">
                    <div className="customer-note-composer">
                      <textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} placeholder="Add a timestamped customer note..." />
                      <button className="btn btn-primary btn-sm" onClick={handleAddNote}><NotebookPen size={16} /> Add Note</button>
                    </div>
                    <RecordList empty="No customer notes yet.">
                      {noteEntries.map((note, index) => (
                        <div className="customer-note" key={`${note}-${index}`}>
                          {editingNoteIndex === index ? (
                            <>
                              <textarea value={editingNoteText} onChange={event => setEditingNoteText(event.target.value)} />
                              <div className="customer-note-actions">
                                <button className="btn btn-sm btn-primary" onClick={() => handleUpdateNote(index)}>Save</button>
                                <button className="btn btn-sm btn-secondary" onClick={() => setEditingNoteIndex(null)}>Cancel</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p>{note}</p>
                              <div className="customer-note-actions">
                                <button className="btn btn-sm btn-secondary" onClick={() => { setEditingNoteIndex(index); setEditingNoteText(note); }}>Edit</button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleDeleteNote(index)}>Delete</button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </RecordList>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCustomer ? 'Edit Customer' : 'New Customer'}>
        <CustomerForm form={form} setForm={setForm} onCancel={() => setShowModal(false)} onSave={handleSave} isEditing={!!editingCustomer} />
      </Modal>

      <Modal isOpen={showSignatureModal} onClose={() => setShowSignatureModal(false)} title="Request Signature" size="lg">
        <div className="signature-request-form">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Document title *</label>
              <input className="form-input" value={signatureForm.title} onChange={event => setSignatureForm({ ...signatureForm, title: event.target.value })} placeholder="Contract, waiver, approval letter..." />
            </div>
            <div className="form-group">
              <label className="form-label">Document type</label>
              <select className="form-select" value={signatureForm.documentType} onChange={event => setSignatureForm({ ...signatureForm, documentType: event.target.value as SignatureDocumentType })}>
                <option value="contract">Contract</option>
                <option value="estimate">Estimate</option>
                <option value="change_order">Change order</option>
                <option value="invoice">Invoice</option>
                <option value="custom">Custom document</option>
              </select>
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Project</label>
              <select className="form-select" value={signatureForm.jobId} onChange={event => setSignatureForm({ ...signatureForm, jobId: event.target.value })}>
                <option value="">Customer-wide document</option>
                {selectedSummary?.jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Expires</label>
              <input className="form-input" type="date" value={signatureForm.expiresAt} onChange={event => setSignatureForm({ ...signatureForm, expiresAt: event.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Portal message</label>
            <input className="form-input" value={signatureForm.message} onChange={event => setSignatureForm({ ...signatureForm, message: event.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Document text *</label>
            <textarea className="form-textarea signature-document-editor" value={signatureForm.documentBody} onChange={event => setSignatureForm({ ...signatureForm, documentBody: event.target.value })} placeholder="Paste the agreement, authorization, or approval language the customer needs to sign." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowSignatureModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreateSignatureRequest}><FileSignature size={16} /> Create Request</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function CustomerForm({
  form,
  setForm,
  onCancel,
  onSave,
  isEditing,
}: {
  form: { name: string; company: string; email: string; phone: string; address: string; notes: string };
  setForm: (form: { name: string; company: string; email: string; phone: string; address: string; notes: string }) => void;
  onCancel: () => void;
  onSave: () => void;
  isEditing: boolean;
}) {
  return (
    <>
      <div className="form-row form-row-2">
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Customer name" />
        </div>
        <div className="form-group">
          <label className="form-label">Company</label>
          <input className="form-input" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Company name" />
        </div>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="customer@example.com" />
        </div>
        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Address</label>
        <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City, State" />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
      </div>
      <div className="modal-footer" style={{ padding: 0, borderTop: 'none' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave}>{isEditing ? 'Update' : 'Create'}</button>
      </div>
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warning' }) {
  return (
    <div className="customer-metric">
      <span>{label}</span>
      <strong className={tone ? `customer-metric-${tone}` : ''}>{value}</strong>
    </div>
  );
}

function InfoBlock({ icon: Icon, label, value, wide }: { icon: typeof Mail; label: string; value: string; wide?: boolean }) {
  return (
    <div className={`customer-info-block ${wide ? 'wide' : ''}`}>
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RecordList({ children, empty }: { children: React.ReactNode; empty: string }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return hasChildren ? <div className="customer-record-list">{children}</div> : <div className="customer-panel-empty">{empty}</div>;
}

function getRecentActivity(summary: CustomerSummary) {
  const dates = [
    ...summary.estimates.map(estimate => ({ label: `Estimate updated: ${estimate.name}`, date: estimate.updatedAt })),
    ...summary.jobs.map(job => ({ label: `Job updated: ${job.name}`, date: job.updatedAt })),
  ].sort((a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime());

  return dates[0] ? `${dates[0].label} on ${formatDate(dates[0].date)}` : 'No recent activity yet';
}

function getRecommendedAction(summary: CustomerSummary): RecommendedAction {
  const firstOpenEstimate = summary.openEstimates[0];
  const firstActiveJob = summary.activeJobs[0];

  if (summary.balanceDue > 0) {
    return {
      message: 'Follow up on the outstanding invoice balance.',
      buttonLabel: 'Open invoices',
      tab: 'invoices',
    };
  }

  if (firstOpenEstimate) {
    return {
      message: 'Review open estimates and push the next decision.',
      buttonLabel: 'Open estimate',
      to: `/estimates/${firstOpenEstimate.id}`,
    };
  }

  if (firstActiveJob) {
    return {
      message: 'Check job progress and confirm the next milestone.',
      buttonLabel: 'Open job',
      to: `/jobs/${firstActiveJob.id}`,
    };
  }

  return {
    message: 'Create a new estimate or log the next customer touchpoint.',
    buttonLabel: 'Start estimate',
    to: `/estimates/new?customerId=${encodeURIComponent(summary.customer.id)}`,
  };
}

export default Customers;
