import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { JOB_STATUSES, JOB_TYPES } from '../data/types';
import type { Job, JobStatus, JobType } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { Plus, Search, ChevronDown, ChevronUp, Trash2, Edit, Eye } from 'lucide-react';

export function Jobs() {
  const { jobs, addJob, updateJob, deleteJob } = useApp();
  const { showToast } = useToast();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<JobType | ''>('');
  const [sortBy, setSortBy] = useState<'name' | 'dueDate' | 'contractAmount'>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '', customer: '', customerPhone: '', customerEmail: '', address: '',
    type: 'remodel', contractAmount: '', estimatedCost: '',
    startDate: '', dueDate: '', status: 'lead', notes: ''
  });

  const filteredJobs = useMemo(() => {
    let result = [...jobs];
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(j => 
        j.name.toLowerCase().includes(s) ||
        j.customer.toLowerCase().includes(s) ||
        j.address.toLowerCase().includes(s)
      );
    }
    
    if (statusFilter) {
      result = result.filter(j => j.status === statusFilter);
    }
    
    if (typeFilter) {
      result = result.filter(j => j.type === typeFilter);
    }
    
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'dueDate') cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      else if (sortBy === 'contractAmount') cmp = a.contractAmount - b.contractAmount;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    
    return result;
  }, [jobs, search, statusFilter, typeFilter, sortBy, sortDir]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const openModal = (job?: Job) => {
    if (job) {
      setEditingJob(job);
      setFormData({
        name: job.name,
        customer: job.customer,
        customerPhone: job.customerPhone || '',
        customerEmail: job.customerEmail || '',
        address: job.address,
        type: job.type,
        contractAmount: job.contractAmount.toString(),
        estimatedCost: job.estimatedCost.toString(),
        startDate: job.startDate,
        dueDate: job.dueDate,
        status: job.status,
        notes: job.notes || ''
      });
    } else {
      setEditingJob(null);
      setFormData({
        name: '', customer: '', customerPhone: '', customerEmail: '', address: '',
        type: 'remodel', contractAmount: '', estimatedCost: '',
        startDate: '', dueDate: '', status: 'lead', notes: ''
      });
    }
    setShowModal(true);
  };

const handleSave = () => {
    if (!formData.name || !formData.customer || !formData.address) {
      showToast('Please fill required fields', 'error');
      return;
    }
    
    const jobData = {
      ...formData,
      contractAmount: parseFloat(formData.contractAmount) || 0,
      estimatedCost: parseFloat(formData.estimatedCost) || 0,
    };
    
    if (editingJob) {
      updateJob(editingJob.id, jobData as any);
      showToast('Job updated');
    } else {
      addJob(jobData as any);
      showToast('Job created');
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (deleteJobId) {
      deleteJob(deleteJobId);
      showToast('Job deleted');
      setDeleteJobId(null);
    }
  };

  const getStatusBadgeClass = (status: JobStatus) => {
    const map: Record<JobStatus, string> = {
      lead: 'badge-gray',
      estimate_sent: 'badge-blue',
      approved: 'badge-purple',
      scheduled: 'badge-indigo',
      active: 'badge-green',
      awaiting_materials: 'badge-yellow',
      awaiting_payment: 'badge-orange',
      completed: 'badge-emerald',
      closed: 'badge-slate'
    };
    return map[status] || 'badge-gray';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Operations</div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-subtitle">Manage active projects, track progress, and monitor profitability across all job sites.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => openModal()}>
            <Plus size={18} /> New Job
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="kpi-grid mb-6">
          <div className="kpi-card">
            <div className="kpi-label">Active Jobs</div>
            <div className="kpi-value kpi-primary">{jobs.filter(j => j.status === 'active').length}</div>
            <div className="kpi-sub">{formatCurrency(jobs.filter(j => j.status === 'active').reduce((s, j) => s + j.contractAmount, 0))} contracted</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Scheduled</div>
            <div className="kpi-value">{jobs.filter(j => j.status === 'scheduled').length}</div>
            <div className="kpi-sub">{formatCurrency(jobs.filter(j => j.status === 'scheduled').reduce((s, j) => s + j.contractAmount, 0))} value</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Completed</div>
            <div className="kpi-value">{jobs.filter(j => j.status === 'completed' || j.status === 'closed').length}</div>
            <div className="kpi-sub">{formatCurrency(jobs.filter(j => j.status === 'completed' || j.status === 'closed').reduce((s, j) => s + j.contractAmount, 0))} closed</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Total Revenue</div>
            <div className="kpi-value">{formatCurrency(jobs.reduce((s, j) => s + j.contractAmount, 0))}</div>
            <div className="kpi-sub">{jobs.length} total jobs</div>
          </div>
        </div>
        <div className="filters">
          <div className="search-bar">
            <Search />
            <input 
              className="form-input" 
              placeholder="Search jobs..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{paddingLeft: '40px'}}
            />
          </div>
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as JobStatus)} style={{width: '180px'}}>
            <option value="">All Statuses</option>
            {JOB_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value as JobType)} style={{width: '150px'}}>
            <option value="">All Types</option>
            {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        
        <div className="card">
          <div className="table-container">
            <table className="table table-sortable table-responsive">
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')}>
                    Job {sortBy === 'name' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Type</th>
                  <th onClick={() => handleSort('dueDate')}>
                    Due {sortBy === 'dueDate' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </th>
                  <th onClick={() => handleSort('contractAmount')}>
                    Amount {sortBy === 'contractAmount' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted">No jobs found</td>
                  </tr>
                ) : (
                  filteredJobs.map(job => (
                    <tr key={job.id}>
                      <td data-label="Job"><Link to={`/jobs/${job.id}`} className="font-medium">{job.name}</Link></td>
                      <td data-label="Customer">{job.customer}</td>
                      <td data-label="Address" className="truncate" style={{maxWidth: '200px'}}>{job.address}</td>
                      <td data-label="Type" className="text-sm text-secondary">{job.type.replace('_', ' ')}</td>
                      <td data-label="Due">{formatDate(job.dueDate)}</td>
                      <td data-label="Amount">{formatCurrency(job.contractAmount)}</td>
                      <td data-label="Status"><span className={`badge ${getStatusBadgeClass(job.status)}`}>{job.status.replace('_', ' ')}</span></td>
                      <td data-label="Actions">
                        <div className="flex gap-2 justify-end">
                          <Link to={`/jobs/${job.id}`} className="btn btn-sm btn-secondary btn-icon">
                            <Eye size={16} />
                          </Link>
                          <button className="btn btn-sm btn-secondary btn-icon" onClick={() => openModal(job)}>
                            <Edit size={16} />
                          </button>
                          <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteJobId(job.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingJob ? 'Edit Job' : 'New Job'} size="lg">
        <div className="form-group">
          <label className="form-label">Job Name *</label>
          <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Job name" />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Customer *</label>
            <input className="form-input" value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})} placeholder="Customer name" />
          </div>
          <div className="form-group">
            <label className="form-label">Job Type</label>
            <select className="form-select" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as JobType})}>
              {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address *</label>
          <input className="form-input" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Job address" />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} placeholder="Phone" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={formData.customerEmail} onChange={e => setFormData({...formData, customerEmail: e.target.value})} placeholder="Email" />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Contract Amount</label>
            <input className="form-input" type="number" value={formData.contractAmount} onChange={e => setFormData({...formData, contractAmount: e.target.value})} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Estimated Cost</label>
            <input className="form-input" type="number" value={formData.estimatedCost} onChange={e => setFormData({...formData, estimatedCost: e.target.value})} placeholder="0" />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input className="form-input" type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as JobStatus})}>
            {JOB_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Notes" />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editingJob ? 'Update' : 'Create'} Job</button>
        </div>
      </Modal>
      
      <ConfirmDialog
        isOpen={!!deleteJobId}
        onClose={() => setDeleteJobId(null)}
        onConfirm={handleDelete}
        title="Delete Job"
        message="Are you sure you want to delete this job? This will also delete all associated time entries, expenses, and invoices."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}