import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate, parseDateString } from '../utils/formatters';
import { dataService } from '../services/dataService';
import { createPortalAccess } from '../services/portalService';
import type { Customer, Estimate, Invoice, Job } from '../data/types';
import {
  Activity,
  BadgeDollarSign,
  BriefcaseBusiness,
  ClipboardList,
  Edit,
  FilePlus2,
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
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';

type SegmentKey = 'all' | 'leads' | 'active' | 'past' | 'open_estimate' | 'balance_due';
type DetailTab = 'overview' | 'estimates' | 'jobs' | 'invoices' | 'notes';

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
    convertEstimateToJob,
    getJobProgress,
    getJobProfit,
  } = useApp();
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
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [portalLink, setPortalLink] = useState('');
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', address: '', notes: ''
  });

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
          <button className="btn btn-secondary"><Filter size={18} /> Filter</button>
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
                <button
                  key={summary.customer.id}
                  className={`customer-card ${selectedCustomer?.id === summary.customer.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedId(summary.customer.id);
                    setActiveTab('overview');
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
                  <div className="customer-card-actions" onClick={event => event.stopPropagation()}>
                    <a className="customer-icon-btn" href={summary.customer.phone ? `tel:${summary.customer.phone}` : undefined} title="Call"><Phone size={16} /></a>
                    <a className="customer-icon-btn" href={summary.customer.email ? `mailto:${summary.customer.email}` : undefined} title="Email"><Mail size={16} /></a>
                    <Link className="customer-icon-btn" to="/estimates/new" title="New Estimate"><FilePlus2 size={16} /></Link>
                    <button className="customer-icon-btn" onClick={() => handleEdit(summary.customer)} title="Edit"><Edit size={16} /></button>
                    <button className="customer-icon-btn danger" onClick={() => setDeleteId(summary.customer.id)} title="Delete"><Trash2 size={16} /></button>
                  </div>
                </button>
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
                <button className="btn btn-secondary btn-sm" onClick={logContact}><Phone size={16} /> Log Contact</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('notes')}><MessageSquarePlus size={16} /> Add Note</button>
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
                {(['overview', 'estimates', 'jobs', 'invoices', 'notes'] as DetailTab[]).map(tab => (
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
                    <div className="customer-recommendation">
                      <Sparkles size={18} />
                      <div>
                        <span>Next recommended action</span>
                        <strong>{getRecommendedAction(selectedSummary)}</strong>
                      </div>
                    </div>
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

function getRecommendedAction(summary: CustomerSummary) {
  if (summary.balanceDue > 0) return 'Follow up on the outstanding invoice balance.';
  if (summary.openEstimates.length > 0) return 'Review open estimates and push the next decision.';
  if (summary.activeJobs.length > 0) return 'Check job progress and confirm the next milestone.';
  return 'Create a new estimate or log the next customer touchpoint.';
}

export default Customers;
