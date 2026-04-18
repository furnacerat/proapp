import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ESTIMATE_STATUSES, JOB_TYPES } from '../data/types';
import type { Estimate, EstimateStatus, JobType } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { Plus, Search, ChevronDown, ChevronUp, Trash2, Edit, Eye, FileText, Send, CheckCircle } from 'lucide-react';

export function Estimates() {
  const { estimates, customers, addEstimate, updateEstimate, deleteEstimate, convertEstimateToJob, getEstimateCustomer } = useApp();
  const { showToast } = useToast();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<JobType | ''>('');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'total'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showModal, setShowModal] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [deleteEstimateId, setDeleteEstimateId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '', customerId: '', address: '',
    type: 'remodel' as JobType, status: 'draft' as EstimateStatus,
    markupPercent: '20', notes: '', validUntil: ''
  });

  const filteredEstimates = useMemo(() => {
    let result = [...estimates];
    
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

  const openModal = (estimate?: Estimate) => {
    if (estimate) {
      setEditingEstimate(estimate);
      setFormData({
        name: estimate.name,
        customerId: estimate.customerId,
        address: estimate.address,
        type: estimate.type,
        status: estimate.status,
        markupPercent: estimate.markupPercent.toString(),
        notes: estimate.notes || '',
        validUntil: estimate.validUntil || ''
      });
    } else {
      setEditingEstimate(null);
      setFormData({
        name: '', customerId: '', address: '',
        type: 'remodel', status: 'draft',
        markupPercent: '20', notes: '', validUntil: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEstimate(null);
  };

  const handleSave = () => {
    if (!formData.name || !formData.customerId) {
      showToast('Name and customer are required', 'error');
      return;
    }

    const estimateData = {
      estimateNumber: editingEstimate?.estimateNumber || `EST-${new Date().getFullYear()}-${String(estimates.length + 1).padStart(3, '0')}`,
      customerId: formData.customerId,
      name: formData.name,
      address: formData.address,
      type: formData.type,
      status: formData.status,
      lineItems: editingEstimate?.lineItems || [],
      markupPercent: parseFloat(formData.markupPercent) || 20,
      notes: formData.notes,
      validUntil: formData.validUntil,
    };

    if (editingEstimate) {
      updateEstimate(editingEstimate.id, estimateData);
      showToast('Estimate updated');
    } else {
      addEstimate(estimateData);
      showToast('Estimate created');
    }
    closeModal();
  };

  const handleDelete = () => {
    if (deleteEstimateId) {
      deleteEstimate(deleteEstimateId);
      showToast('Estimate deleted');
      setDeleteEstimateId(null);
    }
  };

  const handleConvertToJob = (estimateId: string) => {
    const jobId = convertEstimateToJob(estimateId);
    if (jobId) {
      showToast('Estimate converted to job!', 'success');
    }
  };

  const getStatusBadge = (status: EstimateStatus) => {
    const colors: Record<EstimateStatus, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      expired: 'bg-yellow-100 text-yellow-700',
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
        <button className="btn btn-primary" onClick={() => openModal()}>
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

        {!estimates.length ? (
          <div className="empty-state">
            <FileText size={48} />
            <h3>No estimates yet</h3>
            <p>Create your first estimate to get started</p>
            <button className="btn btn-primary" onClick={() => openModal()}>
              <Plus size={18} /> Create Estimate
            </button>
          </div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Name <SortIcon field="name" /></div>
                  </th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('total')}>
                    <div className="flex items-center gap-1">Total <SortIcon field="total" /></div>
                  </th>
                  <th className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('createdAt')}>
                    <div className="flex items-center gap-1">Date <SortIcon field="createdAt" /></div>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEstimates.map(estimate => {
                  const customer = getEstimateCustomer(estimate.id);
                  return (
                    <tr key={estimate.id}>
                      <td>
                        <Link to={`/estimates/${estimate.id}`} className="font-medium">
                          {estimate.name}
                        </Link>
                        <div className="text-xs text-muted">{estimate.estimateNumber}</div>
                      </td>
                      <td>{customer?.name || '—'}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(estimate.status)}`}>
                          {ESTIMATE_STATUSES.find(s => s.value === estimate.status)?.label}
                        </span>
                      </td>
                      <td>{JOB_TYPES.find(t => t.value === estimate.type)?.label}</td>
                      <td className="font-medium">{formatCurrency(estimate.total)}</td>
                      <td className="text-muted">{formatDate(estimate.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link to={`/estimates/${estimate.id}`} className="btn btn-sm btn-icon" title="View">
                            <Eye size={14} />
                          </Link>
                          {!estimate.convertedToJobId && estimate.status === 'approved' && (
                            <button
                              className="btn btn-sm btn-success"
                              title="Convert to Job"
                              onClick={() => handleConvertToJob(estimate.id)}
                            >
                              <CheckCircle size={14} />
                            </button>
                          )}
                          {estimate.convertedToJobId && (
                            <Link to={`/jobs/${estimate.convertedToJobId}`} className="btn btn-sm btn-secondary" title="View Job">
                              <FileText size={14} />
                            </Link>
                          )}
                          <button
                            className="btn btn-sm btn-icon"
                            title="Edit"
                            onClick={() => openModal(estimate)}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="btn btn-sm btn-icon btn-danger"
                            title="Delete"
                            onClick={() => setDeleteEstimateId(estimate.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editingEstimate ? 'Edit Estimate' : 'New Estimate'} size="lg">
        <div className="grid-2 gap-4">
          <div className="form-group">
            <label className="form-label">Estimate Name *</label>
            <input
              className="form-input"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Smith Kitchen Remodel"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Customer *</label>
            <select
              className="form-select"
              value={formData.customerId}
              onChange={e => setFormData({...formData, customerId: e.target.value})}
            >
              <option value="">Select customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <input
            className="form-input"
            value={formData.address}
            onChange={e => setFormData({...formData, address: e.target.value})}
            placeholder="Project address"
          />
        </div>
        <div className="grid-2 gap-4">
          <div className="form-group">
            <label className="form-label">Type</label>
            <select
              className="form-select"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value as JobType})}
            >
              {JOB_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value as EstimateStatus})}
            >
              {ESTIMATE_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid-2 gap-4">
          <div className="form-group">
            <label className="form-label">Markup %</label>
            <input
              className="form-input"
              type="number"
              value={formData.markupPercent}
              onChange={e => setFormData({...formData, markupPercent: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Valid Until</label>
            <input
              className="form-input"
              type="date"
              value={formData.validUntil}
              onChange={e => setFormData({...formData, validUntil: e.target.value})}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input"
            rows={3}
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
          />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {editingEstimate ? 'Update' : 'Create'} Estimate
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteEstimateId}
        onClose={() => setDeleteEstimateId(null)}
        onConfirm={handleDelete}
        title="Delete Estimate?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}