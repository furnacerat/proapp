import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ESTIMATE_STATUSES, JOB_TYPES } from '../../data/types';
import type { Estimate, EstimateStatus, JobType } from '../../data/types';
import { useToast } from '../../components/common/Toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Modal } from '../../components/common/Modal';
import { Plus, Search, ChevronDown, ChevronUp, Trash2, Copy, Archive, Send, FileText, MoreVertical, Eye, X } from 'lucide-react';

export function EstimatesList() {
  const { estimates, customers, addEstimate, deleteEstimate, duplicateEstimate, archiveEstimate, convertEstimateToJob, getEstimateCustomer } = useApp();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<JobType | ''>('');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'updatedAt' | 'total'>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newEstimate, setNewEstimate] = useState({ name: '', customerId: '', type: 'remodel' as JobType });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [convertOptions, setConvertOptions] = useState({ startDate: '', dueDate: '', copyLineItems: true, copyPricing: true, copyNotes: true });

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
          customer?.name.toLowerCase().includes(s)
        );
      });
    }
    
    if (statusFilter) {
      result = result.filter(e => e.status === statusFilter);
    }
    
    if (typeFilter) {
      result = result.filter(e => e.type === typeFilter);
    }
    
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortBy === 'updatedAt') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      else if (sortBy === 'total') cmp = a.total - b.total;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    
    return result;
  }, [estimates, search, statusFilter, typeFilter, sortBy, sortDir, getEstimateCustomer]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
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
    if (newId) {
      showToast('Estimate duplicated');
    }
    setShowActions(null);
  };

  const handleArchive = (id: string) => {
    archiveEstimate(id);
    showToast('Estimate archived');
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

  const getStatusBadge = (status: EstimateStatus) => {
    const colors: Record<EstimateStatus, string> = {
      draft: 'bg-gray-100 text-gray-700',
      in_review: 'bg-yellow-100 text-yellow-700',
      sent: 'bg-blue-100 text-blue-700',
      viewed: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      expired: 'bg-yellow-100 text-yellow-700',
      archived: 'bg-gray-100 text-gray-500',
      converted: 'bg-green-100 text-green-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return <ChevronDown size={14} className="opacity-50" />;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Estimates</h1>
          <span className="badge badge-primary">{filteredEstimates.length}</span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
          <Plus size={18} /> New Estimate
        </button>
      </div>

      <div className="page-content">
        <div className="filters-bar mb-4">
          <div className="search-input flex-1">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search estimates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as EstimateStatus | '')}
          >
            <option value="">All Statuses</option>
            {ESTIMATE_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            className="form-select"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as JobType | '')}
          >
            <option value="">All Types</option>
            {JOB_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {!estimates || estimates.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <h3>No estimates yet</h3>
            <p>Create your first estimate to get started</p>
            <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
              <Plus size={18} /> Create Estimate
            </button>
          </div>
        ) : (
          <div className="card">
            <div className="table-container">
              <table className="table table-responsive">
                <thead>
                  <tr>
                    <th>Estimate</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('total')}>
                      <div className="flex items-center gap-1">Total <SortIcon field="total" /></div>
                    </th>
                    <th className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('updatedAt')}>
                      <div className="flex items-center gap-1">Updated <SortIcon field="updatedAt" /></div>
                    </th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEstimates.map(estimate => {
                    const customer = getEstimateCustomer(estimate.id);
                    return (
                      <tr key={estimate.id} className="hover:bg-gray-50">
                        <td data-label="Estimate">
                          <Link to={`/estimates/${estimate.id}`} className="font-medium">
                            {estimate.name}
                          </Link>
                          <div className="text-xs text-muted mt-1">{estimate.estimateNumber}</div>
                        </td>
                        <td data-label="Customer">{customer?.name || '—'}</td>
                        <td data-label="Type">{JOB_TYPES.find(t => t.value === estimate.type)?.label}</td>
                        <td data-label="Status">
                          <span className={`badge ${getStatusBadge(estimate.status)}`}>
                            {ESTIMATE_STATUSES.find(s => s.value === estimate.status)?.label}
                          </span>
                        </td>
                        <td data-label="Total" className="font-medium">{formatCurrency(estimate.total)}</td>
                        <td data-label="Updated" className="text-muted text-sm">{formatDate(estimate.updatedAt)}</td>
                        <td data-label="Actions">
                          <div className="relative inline-block">
                            <button
                              className="btn btn-sm btn-icon"
                              onClick={() => setShowActions(showActions === estimate.id ? null : estimate.id)}
                            >
                              <MoreVertical size={14} />
                            </button>
                            {showActions === estimate.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 w-48 text-left">
                                <Link
                                  to={`/estimates/${estimate.id}`}
                                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm border-b"
                                  onClick={() => setShowActions(null)}
                                >
                                  <Eye size={14} /> View/Edit
                                </Link>
                                <button
                                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm w-full text-left"
                                  onClick={() => handleDuplicate(estimate.id)}
                                >
                                  <Copy size={14} /> Duplicate
                                </button>
                                {estimate.status === 'approved' && !estimate.convertedToJobId && (
                                  <button
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm w-full text-left font-medium text-green-700"
                                    onClick={() => {
                                      setConvertId(estimate.id);
                                      setConvertOptions({ startDate: new Date().toISOString().split('T')[0], dueDate: '', copyLineItems: true, copyPricing: true, copyNotes: true });
                                    }}
                                  >
                                    <FileText size={14} /> Convert to Job
                                  </button>
                                )}
                                {estimate.status !== 'archived' && (
                                  <button
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm w-full text-left border-t"
                                    onClick={() => handleArchive(estimate.id)}
                                  >
                                    <Archive size={14} /> Archive
                                  </button>
                                )}
                                <button
                                  className="flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-sm w-full text-left text-red-600"
                                  onClick={() => {
                                    setDeleteId(estimate.id);
                                    setShowActions(null);
                                  }}
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="New Estimate" size="md">
        <div className="form-group">
          <label className="form-label">Estimate Name *</label>
          <input
            className="form-input"
            value={newEstimate.name}
            onChange={e => setNewEstimate({...newEstimate, name: e.target.value})}
            placeholder="e.g., Smith Kitchen Remodel"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Customer *</label>
          <select
            className="form-select"
            value={newEstimate.customerId}
            onChange={e => setNewEstimate({...newEstimate, customerId: e.target.value})}
          >
            <option value="">Select customer...</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Project Type</label>
          <select
            className="form-select"
            value={newEstimate.type}
            onChange={e => setNewEstimate({...newEstimate, type: e.target.value as JobType})}
          >
            {JOB_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
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
              <input className="form-input" type="date" value={convertOptions.startDate} onChange={e => setConvertOptions({...convertOptions, startDate: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Due Date (Optional)</label>
              <input className="form-input" type="date" value={convertOptions.dueDate} onChange={e => setConvertOptions({...convertOptions, dueDate: e.target.value})} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={convertOptions.copyPricing} onChange={e => setConvertOptions({...convertOptions, copyPricing: e.target.checked})} />
              <span>Copy pricing (Contract Amount)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={convertOptions.copyLineItems} onChange={e => setConvertOptions({...convertOptions, copyLineItems: e.target.checked})} />
              <span>Copy line items</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={convertOptions.copyNotes} onChange={e => setConvertOptions({...convertOptions, copyNotes: e.target.checked})} />
              <span>Copy notes</span>
            </label>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setConvertId(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (convertId) {
              convertEstimateToJob(convertId, {
                startDate: convertOptions.startDate || undefined,
                dueDate: convertOptions.dueDate || undefined,
                copyLineItems: convertOptions.copyLineItems,
                copyPricing: convertOptions.copyPricing,
                copyNotes: convertOptions.copyNotes,
              });
              showToast('Converted to job');
              setConvertId(null);
            }
          }}>Convert</button>
        </div>
      </Modal>
    </div>
  );
}