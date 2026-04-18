import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { Plus, Search, Trash2 } from 'lucide-react';

export function TimeEntries() {
  const { jobs, workers, timeEntries, addTimeEntry, deleteTimeEntry } = useApp();
  const { showToast } = useToast();
  
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    jobId: '', workerId: '', date: new Date().toISOString().split('T')[0], startTime: '07:00', endTime: '16:00', notes: ''
  });

  const filteredEntries = useMemo(() => {
    let result = [...timeEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e => {
        const job = jobs.find(j => j.id === e.jobId);
        const worker = workers.find(w => w.id === e.workerId);
        return job?.name.toLowerCase().includes(s) || worker?.name.toLowerCase().includes(s) || e.notes?.toLowerCase().includes(s);
      });
    }
    
    if (jobFilter) result = result.filter(e => e.jobId === jobFilter);
    if (workerFilter) result = result.filter(e => e.workerId === workerFilter);
    if (dateFilter) result = result.filter(e => e.date === dateFilter);
    
    return result;
  }, [timeEntries, jobs, workers, search, jobFilter, workerFilter, dateFilter]);

  const totalHours = filteredEntries.reduce((sum, e) => sum + e.totalHours, 0);
  const totalCost = filteredEntries.reduce((sum, e) => sum + e.laborCost, 0);

  const handleSave = () => {
    if (!formData.jobId || !formData.workerId) {
      showToast('Select job and worker', 'error');
      return;
    }
    const [startH, startM] = formData.startTime.split(':').map(Number);
    const [endH, endM] = formData.endTime.split(':').map(Number);
    const hours = (endH + endM / 60) - (startH + startM / 60);
    if (hours <= 0) {
      showToast('End time must be after start time', 'error');
      return;
    }
    
    addTimeEntry({
      jobId: formData.jobId,
      workerId: formData.workerId,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      totalHours: hours,
      overtime: hours > 8,
      notes: formData.notes,
    });
    showToast('Time entry added');
    setShowModal(false);
    setFormData({ jobId: '', workerId: '', date: new Date().toISOString().split('T')[0], startTime: '07:00', endTime: '16:00', notes: '' });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteTimeEntry(deleteId);
      showToast('Entry deleted');
      setDeleteId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Time Entries</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Entry
        </button>
      </div>
      
      <div className="page-content">
        <div className="kpi-grid mb-4">
          <div className="kpi-card">
            <div className="kpi-label">Total Hours</div>
            <div className="kpi-value">{totalHours.toFixed(1)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Total Cost</div>
            <div className="kpi-value">{formatCurrency(totalCost)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Entries</div>
            <div className="kpi-value">{filteredEntries.length}</div>
          </div>
        </div>
        
        <div className="filters">
          <div className="search-bar">
            <Search />
            <input className="form-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{paddingLeft: '40px'}} />
          </div>
          <select className="form-select" value={jobFilter} onChange={e => setJobFilter(e.target.value)} style={{width: '180px'}}>
            <option value="">All Jobs</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <select className="form-select" value={workerFilter} onChange={e => setWorkerFilter(e.target.value)} style={{width: '150px'}}>
            <option value="">All Workers</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <input className="form-input" type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{width: '150px'}} />
        </div>
        
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Job</th>
                  <th>Worker</th>
                  <th>Time</th>
                  <th>Hours</th>
                  <th>Cost</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-muted">No entries</td></tr>
                ) : filteredEntries.map(entry => {
                  const job = jobs.find(j => j.id === entry.jobId);
                  const worker = workers.find(w => w.id === entry.workerId);
                  return (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.date)}</td>
                      <td><Link to={`/jobs/${entry.jobId}`}>{job?.name}</Link></td>
                      <td>{worker?.name}</td>
                      <td>{formatTime(entry.startTime)} - {entry.endTime ? formatTime(entry.endTime) : 'Active'}</td>
                      <td>{entry.totalHours.toFixed(1)}h {entry.overtime && <span className="badge badge-red">OT</span>}</td>
                      <td>{formatCurrency(entry.laborCost)}</td>
                      <td className="truncate" style={{maxWidth: '150px'}}>{entry.notes}</td>
                      <td>
                        <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteId(entry.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Time Entry">
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Job *</label>
            <select className="form-select" value={formData.jobId} onChange={e => setFormData({...formData, jobId: e.target.value})}>
              <option value="">Select job</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Worker *</label>
            <select className="form-select" value={formData.workerId} onChange={e => setFormData({...formData, workerId: e.target.value})}>
              <option value="">Select worker</option>
              {workers.filter(w => w.status === 'active').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Start Time</label>
            <input className="form-input" type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">End Time</label>
            <input className="form-input" type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Add Entry</button>
        </div>
      </Modal>
      
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Entry" message="Delete this time entry?" confirmLabel="Delete" danger />
    </div>
  );
}