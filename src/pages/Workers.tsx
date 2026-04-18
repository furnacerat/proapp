import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';
import { getWorkerHours, getWorkerOwed } from '../utils/calculations';
import { TRADES } from '../data/types';
import type { Worker, WorkerType, WorkerStatus, PayType } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { Plus, Search, Trash2, Phone, Mail } from 'lucide-react';

export function Workers() {
  const { workers, addWorker, updateWorker, deleteWorker, timeEntries } = useApp();
  const { showToast } = useToast();
  
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<WorkerType | ''>('');
  const [statusFilter, setStatusFilter] = useState<WorkerStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '', type: 'employee' as WorkerType, trade: '', phone: '', email: '', address: '',
    payType: 'hourly' as PayType, hourlyRate: '', flatRate: '', status: 'active' as WorkerStatus, notes: ''
  });

  const filteredWorkers = useMemo(() => {
    let result = [...workers];
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(w => w.name.toLowerCase().includes(s) || w.trade?.toLowerCase().includes(s));
    }
    
    if (typeFilter) result = result.filter(w => w.type === typeFilter);
    if (statusFilter) result = result.filter(w => w.status === statusFilter);
    
    return result;
  }, [workers, search, typeFilter, statusFilter]);

  const openModal = (worker?: Worker) => {
    if (worker) {
      setEditingWorker(worker);
      setFormData({
        name: worker.name, type: worker.type, trade: worker.trade || '', phone: worker.phone || '',
        email: worker.email || '', address: worker.address || '', payType: worker.payType,
        hourlyRate: worker.hourlyRate?.toString() || '', flatRate: worker.flatRate?.toString() || '',
        status: worker.status, notes: worker.notes || ''
      });
    } else {
      setEditingWorker(null);
      setFormData({ name: '', type: 'employee', trade: '', phone: '', email: '', address: '',
        payType: 'hourly', hourlyRate: '', flatRate: '', status: 'active', notes: '' });
    }
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.name) { showToast('Name is required', 'error'); return; }
    
    const data = {
      ...formData,
      hourlyRate: formData.payType === 'hourly' ? parseFloat(formData.hourlyRate) || 0 : undefined,
      flatRate: formData.payType === 'flat' ? parseFloat(formData.flatRate) || 0 : undefined,
    };
    
    if (editingWorker) {
      updateWorker(editingWorker.id, data);
      showToast('Worker updated');
    } else {
      addWorker(data);
      showToast('Worker added');
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteWorker(deleteId);
      showToast('Worker deleted');
      setDeleteId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Workers & Contractors</h1>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add Worker
        </button>
      </div>
      
      <div className="page-content">
        <div className="filters">
          <div className="search-bar">
            <Search />
            <input className="form-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{paddingLeft: '40px'}} />
          </div>
          <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value as WorkerType)} style={{width: '150px'}}>
            <option value="">All Types</option>
            <option value="employee">Employee</option>
            <option value="subcontractor">Subcontractor</option>
          </select>
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as WorkerStatus)} style={{width: '120px'}}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        
        <div className="grid-3">
          {filteredWorkers.map(worker => {
            const hours = getWorkerHours(worker.id, timeEntries);
            const owed = getWorkerOwed(worker.id, workers, timeEntries);
            
            return (
              <div key={worker.id} className="card">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">{worker.name}</h3>
                    <span className={`badge ${worker.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{worker.status}</span>
                  </div>
                  <p className="text-sm text-secondary mb-2">{worker.type === 'employee' ? 'Employee' : 'Subcontractor'} • {worker.trade}</p>
                  {worker.phone && <div className="text-sm flex items-center gap-2 mb-2"><Phone size={14} /> {worker.phone}</div>}
                  {worker.email && <div className="text-sm flex items-center gap-2 mb-2"><Mail size={14} /> {worker.email}</div>}
                  <div className="flex justify-between mt-4 pt-2 border-t">
                    <div className="text-sm">
                      <span className="text-muted">Hours:</span> {hours.toFixed(1)}
                    </div>
                    <div className="text-sm font-medium">
                      {worker.payType === 'hourly' ? `${formatCurrency(worker.hourlyRate || 0)}/hr` : `${formatCurrency(worker.flatRate || 0)} flat`}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button className="btn btn-sm btn-secondary flex-1" onClick={() => openModal(worker)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setDeleteId(worker.id)}><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingWorker ? 'Edit Worker' : 'New Worker'} size="lg">
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as WorkerType})}>
              <option value="employee">Employee</option>
              <option value="subcontractor">Subcontractor</option>
            </select>
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Trade</label>
            <select className="form-select" value={formData.trade} onChange={e => setFormData({...formData, trade: e.target.value})}>
              <option value="">Select...</option>
              {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as WorkerStatus})}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <input className="form-input" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Pay Type</label>
            <select className="form-select" value={formData.payType} onChange={e => setFormData({...formData, payType: e.target.value as PayType})}>
              <option value="hourly">Hourly</option>
              <option value="flat">Flat Rate</option>
            </select>
          </div>
          {formData.payType === 'hourly' ? (
            <div className="form-group">
              <label className="form-label">Hourly Rate</label>
              <input className="form-input" type="number" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: e.target.value})} />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Flat Rate</label>
              <input className="form-input" type="number" value={formData.flatRate} onChange={e => setFormData({...formData, flatRate: e.target.value})} />
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editingWorker ? 'Update' : 'Add'} Worker</button>
        </div>
      </Modal>
      
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Worker" message="Delete this worker? Their time entries will remain." confirmLabel="Delete" danger />
    </div>
  );
}