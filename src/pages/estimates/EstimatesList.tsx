import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ESTIMATE_STATUSES, JOB_TYPES } from '../../data/types';
import type { Estimate, EstimateStatus, JobType } from '../../data/types';
import { useToast } from '../../components/common/Toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Modal } from '../../components/common/Modal';
import {
  ArrowUpRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  Filter,
  Layers3,
  Mail,
  MoreVertical,
  PenLine,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';

type PipelineFilter = 'all' | 'draft' | 'sent' | 'awaiting' | 'approved' | 'converted' | 'rejected';

const pipelineChips: { key: PipelineFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'awaiting', label: 'Awaiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'converted', label: 'Converted' },
  { key: 'rejected', label: 'Rejected' },
];

const awaitingStatuses = new Set<EstimateStatus>(['in_review', 'sent', 'viewed']);

const statusTone: Record<EstimateStatus, string> = {
  draft: 'estimate-status-draft',
  in_review: 'estimate-status-awaiting',
  sent: 'estimate-status-sent',
  viewed: 'estimate-status-awaiting',
  approved: 'estimate-status-approved',
  rejected: 'estimate-status-rejected',
  expired: 'estimate-status-rejected',
  archived: 'estimate-status-draft',
  converted: 'estimate-status-converted',
};

function matchesPipeline(estimate: Estimate, filter: PipelineFilter) {
  if (filter === 'all') return true;
  if (filter === 'awaiting') return awaitingStatuses.has(estimate.status);
  return estimate.status === filter;
}

function statusLabel(status: EstimateStatus) {
  return ESTIMATE_STATUSES.find(item => item.value === status)?.label || status.replace('_', ' ');
}

export function EstimatesList() {
  const { estimates, customers, addEstimate, updateEstimate, deleteEstimate, duplicateEstimate, archiveEstimate, convertEstimateToJob, getEstimateCustomer } = useApp();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | ''>('');
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>('all');
  const [typeFilter, setTypeFilter] = useState<JobType | ''>('');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'updatedAt' | 'total'>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newEstimate, setNewEstimate] = useState({ name: '', customerId: '', type: 'remodel' as JobType });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [convertOptions, setConvertOptions] = useState({ startDate: '', dueDate: '', copyLineItems: true, copyPricing: true, copyNotes: true });

  const sortedEstimates = useMemo(() => {
    const estList = estimates || [];
    return [...estList].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [estimates]);

  const filteredEstimates = useMemo(() => {
    const estList = estimates || [];
    let result = [...estList];

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e => {
        const customer = getEstimateCustomer(e.id);
        return (
          e.name.toLowerCase().includes(s) ||
          e.estimateNumber.toLowerCase().includes(s) ||
          e.address.toLowerCase().includes(s) ||
          customer?.name.toLowerCase().includes(s) ||
          customer?.company?.toLowerCase().includes(s)
        );
      });
    }

    if (statusFilter) result = result.filter(e => e.status === statusFilter);
    if (pipelineFilter !== 'all') result = result.filter(e => matchesPipeline(e, pipelineFilter));
    if (typeFilter) result = result.filter(e => e.type === typeFilter);

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortBy === 'updatedAt') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      else if (sortBy === 'total') cmp = a.total - b.total;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [estimates, search, statusFilter, pipelineFilter, typeFilter, sortBy, sortDir, getEstimateCustomer]);

  const kpis = useMemo(() => {
    const estList = estimates || [];
    const drafts = estList.filter(e => e.status === 'draft').length;
    const awaiting = estList.filter(e => awaitingStatuses.has(e.status)).length;
    const approved = estList.filter(e => e.status === 'approved').length;
    const pipelineValue = estList
      .filter(e => !['rejected', 'expired', 'archived'].includes(e.status))
      .reduce((sum, e) => sum + e.total, 0);

    return [
      { label: 'Total Estimates', value: estList.length.toString(), sub: `${filteredEstimates.length} in current view`, icon: ClipboardList },
      { label: 'Draft', value: drafts.toString(), sub: 'Needs pricing or review', icon: PenLine },
      { label: 'Awaiting Response', value: awaiting.toString(), sub: 'Sent, viewed, or in review', icon: Mail },
      { label: 'Approved', value: approved.toString(), sub: 'Ready for job conversion', icon: CheckCircle2 },
      { label: 'Total Pipeline Value', value: formatCurrency(pipelineValue), sub: 'Open estimate value', icon: BadgeDollarSign },
    ];
  }, [estimates, filteredEstimates.length]);

  const smartAction = useMemo(() => {
    const estList = estimates || [];
    const awaiting = estList.filter(e => awaitingStatuses.has(e.status));
    const approved = estList.filter(e => e.status === 'approved' && !e.convertedToJobId);
    if (estList.length === 0) return { title: 'Start with a template to build your first estimate faster.', cta: 'Start From Template', to: '/estimates/templates', icon: Layers3 };
    if (awaiting.length > 0) return { title: 'Follow up on estimates awaiting response.', cta: 'Review Awaiting', filter: 'awaiting' as PipelineFilter, icon: Mail };
    if (approved.length > 0) return { title: 'Convert approved estimates into jobs.', cta: 'Show Approved', filter: 'approved' as PipelineFilter, icon: BriefcaseBusiness };
    return { title: 'Keep your pipeline fresh by creating the next estimate.', cta: 'Create Estimate', create: true, icon: Sparkles };
  }, [estimates]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const handleCreate = () => {
    if (!newEstimate.name || !newEstimate.customerId) {
      showToast('Name and customer are required', 'error');
      return;
    }

    const allEstimates = estimates || [];
    const id = addEstimate({
      estimateNumber: `EST-${new Date().getFullYear()}-${String(allEstimates.length + 1).padStart(3, '0')}`,
      customerId: newEstimate.customerId,
      name: newEstimate.name,
      address: '',
      type: newEstimate.type,
      status: 'draft',
      sections: [],
      markupPercent: 20,
      taxable: 'none',
    });

    showToast('Estimate created');
    setShowNewModal(false);
    setNewEstimate({ name: '', customerId: '', type: 'remodel' });
    navigate(`/estimates/${id}`);
  };

  const handleDuplicate = (id: string) => {
    const newId = duplicateEstimate(id);
    if (newId) showToast('Estimate duplicated');
    setShowActions(null);
  };

  const handleArchive = (id: string) => {
    archiveEstimate(id);
    showToast('Estimate archived');
    setShowActions(null);
  };

  const handleSend = (estimate: Estimate) => {
    updateEstimate(estimate.id, { status: 'sent' });
    showToast('Estimate marked as sent');
    setShowActions(null);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteEstimate(deleteId);
      showToast('Estimate deleted');
      setDeleteId(null);
      setShowActions(null);
    }
  };

  const handleConvertNow = (estimateId: string) => {
    const jobId = convertEstimateToJob(estimateId, { startDate: new Date().toISOString().split('T')[0] });
    showToast('Converted to job');
    navigate(`/jobs/${jobId}`);
  };

  const SmartIcon = smartAction.icon;

  return (
    <div className="estimates-premium-page">
      <div className="estimates-premium-shell">
        <header className="estimates-premium-header">
          <div>
            <div className="estimates-premium-eyebrow">Estimate Pipeline</div>
            <h1>Estimates</h1>
            <p>Track, filter, follow up, and convert estimates into active jobs.</p>
          </div>
          <div className="estimates-premium-actions">
            <div className="estimates-premium-search">
              <Search size={18} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search estimates..." />
            </div>
            <div className="estimates-premium-select">
              <Filter size={16} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as EstimateStatus | '')}>
                <option value="">All Statuses</option>
                {ESTIMATE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="estimates-premium-select">
              <Layers3 size={16} />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as JobType | '')}>
                <option value="">All Project Types</option>
                {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <button className="estimates-primary-btn" onClick={() => setShowNewModal(true)}>
              <Plus size={18} /> New Estimate
            </button>
          </div>
        </header>

        <section className="estimates-kpis">
          {kpis.map(({ label, value, sub, icon: Icon }) => (
            <div className="estimates-kpi-card" key={label}>
              <div className="estimates-kpi-icon"><Icon size={20} /></div>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{sub}</small>
              </div>
            </div>
          ))}
        </section>

        <section className="estimates-smart-card">
          <div className="estimates-smart-icon"><SmartIcon size={22} /></div>
          <div>
            <span>Smart next action</span>
            <strong>{smartAction.title}</strong>
          </div>
          {'to' in smartAction ? (
            <Link className="estimates-secondary-btn" to={smartAction.to}>{smartAction.cta}</Link>
          ) : smartAction.create ? (
            <button className="estimates-secondary-btn" onClick={() => setShowNewModal(true)}>{smartAction.cta}</button>
          ) : (
            <button className="estimates-secondary-btn" onClick={() => setPipelineFilter(smartAction.filter)}>{smartAction.cta}</button>
          )}
        </section>

        <nav className="estimates-pipeline-tabs">
          {pipelineChips.map(chip => (
            <button key={chip.key} className={pipelineFilter === chip.key ? 'active' : ''} onClick={() => setPipelineFilter(chip.key)}>
              {chip.label}
            </button>
          ))}
        </nav>

        {!estimates || estimates.length === 0 ? (
          <section className="estimates-onboarding-card">
            <div className="estimates-onboarding-icon"><FileText size={34} /></div>
            <h2>Create your first professional estimate</h2>
            <p>Use templates, assemblies, and your price book to build estimates faster.</p>
            <div className="estimates-onboarding-actions">
              <button className="estimates-primary-btn" onClick={() => setShowNewModal(true)}><Plus size={18} /> Create Estimate</button>
              <Link className="estimates-secondary-btn" to="/estimates/templates"><Layers3 size={18} /> Start From Template</Link>
            </div>
          </section>
        ) : (
          <section className="estimates-list-card">
            <div className="estimates-list-toolbar">
              <div>
                <span>Command Center</span>
                <strong>{filteredEstimates.length} estimate{filteredEstimates.length === 1 ? '' : 's'}</strong>
              </div>
              <div className="estimates-sort-actions">
                <button onClick={() => handleSort('updatedAt')}>Last Activity</button>
                <button onClick={() => handleSort('total')}>Total</button>
              </div>
            </div>

            {filteredEstimates.length === 0 ? (
              <div className="estimates-no-results">
                <Search size={28} />
                <h3>No estimates match these filters</h3>
                <p>Adjust your search, status, or project type filter.</p>
              </div>
            ) : (
              <div className="estimates-records">
                {filteredEstimates.map(estimate => {
                  const customer = getEstimateCustomer(estimate.id);
                  const typeLabel = JOB_TYPES.find(t => t.value === estimate.type)?.label || estimate.type || 'Project';
                  return (
                    <article className="estimate-record" key={estimate.id}>
                      <div className="estimate-record-main">
                        <div className="estimate-record-icon"><FileText size={19} /></div>
                        <div>
                          <Link to={`/estimates/${estimate.id}`} className="estimate-record-title">{estimate.name}</Link>
                          <span>{estimate.estimateNumber} · {customer?.name || 'No customer selected'}</span>
                        </div>
                      </div>
                      <div className="estimate-record-meta">
                        <span>{typeLabel}</span>
                        <span>Created {formatDate(estimate.createdAt)}</span>
                        <span>Updated {formatDate(estimate.updatedAt)}</span>
                      </div>
                      <span className={`estimate-status ${statusTone[estimate.status]}`}>{statusLabel(estimate.status)}</span>
                      <strong className="estimate-record-total">{formatCurrency(estimate.total)}</strong>
                      <div className="estimate-record-actions">
                        <Link className="estimate-icon-btn" to={`/estimates/${estimate.id}`} title="View"><ArrowUpRight size={16} /></Link>
                        <Link className="estimate-icon-btn" to={`/estimates/${estimate.id}`} title="Edit"><PenLine size={16} /></Link>
                        <button className="estimate-icon-btn" onClick={() => handleSend(estimate)} title="Send"><Send size={16} /></button>
                        {estimate.status === 'approved' && !estimate.convertedToJobId && (
                          <button className="estimate-convert-btn" onClick={() => handleConvertNow(estimate.id)}>Convert to Job</button>
                        )}
                        <button className="estimate-icon-btn" onClick={() => setShowActions(showActions === estimate.id ? null : estimate.id)} title="More"><MoreVertical size={16} /></button>
                        {showActions === estimate.id && (
                          <div className="estimate-actions-menu">
                            <button onClick={() => handleDuplicate(estimate.id)}><Copy size={14} /> Duplicate</button>
                            {estimate.status === 'approved' && !estimate.convertedToJobId && (
                              <button onClick={() => {
                                setConvertId(estimate.id);
                                setConvertOptions({ startDate: new Date().toISOString().split('T')[0], dueDate: '', copyLineItems: true, copyPricing: true, copyNotes: true });
                                setShowActions(null);
                              }}><BriefcaseBusiness size={14} /> Convert with options</button>
                            )}
                            {estimate.status !== 'archived' && <button onClick={() => handleArchive(estimate.id)}><XCircle size={14} /> Archive</button>}
                            <button className="danger" onClick={() => { setDeleteId(estimate.id); setShowActions(null); }}><Trash2 size={14} /> Delete</button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {sortedEstimates.length > 0 && (
          <div className="estimates-recent-strip">
            <span>Recent activity</span>
            {sortedEstimates.slice(0, 3).map(estimate => (
              <Link key={estimate.id} to={`/estimates/${estimate.id}`}>{estimate.name}</Link>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="New Estimate" size="md">
        <div className="form-group">
          <label className="form-label">Estimate Name *</label>
          <input className="form-input" value={newEstimate.name} onChange={e => setNewEstimate({ ...newEstimate, name: e.target.value })} placeholder="e.g., Smith Kitchen Remodel" />
        </div>
        <div className="form-group">
          <label className="form-label">Customer *</label>
          <select className="form-select" value={newEstimate.customerId} onChange={e => setNewEstimate({ ...newEstimate, customerId: e.target.value })}>
            <option value="">Select customer...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Project Type</label>
          <select className="form-select" value={newEstimate.type} onChange={e => setNewEstimate({ ...newEstimate, type: e.target.value as JobType })}>
            {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: '16px' }}>
          <button className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate}>Create Estimate</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Estimate?"
        message="This action cannot be undone. All estimate data will be lost."
        confirmLabel="Delete"
        danger
      />

      <Modal isOpen={!!convertId} onClose={() => setConvertId(null)} title="Convert to Job" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted">Configure job settings before converting this estimate.</p>
          <div className="grid-2 gap-4">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={convertOptions.startDate} onChange={e => setConvertOptions({ ...convertOptions, startDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Due Date (Optional)</label>
              <input className="form-input" type="date" value={convertOptions.dueDate} onChange={e => setConvertOptions({ ...convertOptions, dueDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={convertOptions.copyPricing} onChange={e => setConvertOptions({ ...convertOptions, copyPricing: e.target.checked })} />
              <span>Copy pricing (Contract Amount)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={convertOptions.copyLineItems} onChange={e => setConvertOptions({ ...convertOptions, copyLineItems: e.target.checked })} />
              <span>Copy line items</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={convertOptions.copyNotes} onChange={e => setConvertOptions({ ...convertOptions, copyNotes: e.target.checked })} />
              <span>Copy notes</span>
            </label>
          </div>
        </div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: '16px' }}>
          <button className="btn btn-secondary" onClick={() => setConvertId(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (convertId) {
              const jobId = convertEstimateToJob(convertId, {
                startDate: convertOptions.startDate || undefined,
                dueDate: convertOptions.dueDate || undefined,
                copyLineItems: convertOptions.copyLineItems,
                copyPricing: convertOptions.copyPricing,
                copyNotes: convertOptions.copyNotes,
              });
              showToast('Converted to job');
              setConvertId(null);
              navigate(`/jobs/${jobId}`);
            }
          }}>Convert</button>
        </div>
      </Modal>
    </div>
  );
}
