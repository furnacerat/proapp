import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/formatters';
import { TASK_STATUSES, PRIORITIES } from '../data/types';
import type { TaskStatus, Priority } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { Plus, Search, Trash2 } from 'lucide-react';

export function Tasks() {
  const { jobs, tasks, addTask, updateTask, deleteTask } = useApp();
  const { showToast } = useToast();
  
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '', description: '', dueDate: '', jobId: '', priority: 'medium' as Priority, status: 'open' as TaskStatus
  });

  const filteredTasks = useMemo(() => {
    let result = [...tasks].sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(s) || t.description?.toLowerCase().includes(s));
    }
    
    if (jobFilter) result = result.filter(t => t.jobId === jobFilter);
    if (statusFilter) result = result.filter(t => t.status === statusFilter);
    if (priorityFilter) result = result.filter(t => t.priority === priorityFilter);
    if (myTasksOnly) result = result.filter(t => t.status !== 'done');
    
    return result;
  }, [tasks, search, jobFilter, statusFilter, priorityFilter, myTasksOnly]);

  const handleSave = () => {
    if (!formData.title) { showToast('Title required', 'error'); return; }
    addTask({
      ...formData,
      jobId: formData.jobId || undefined,
      dueDate: formData.dueDate || undefined,
    });
    showToast('Task added');
    setShowModal(false);
    setFormData({ title: '', description: '', dueDate: '', jobId: '', priority: 'medium', status: 'open' });
  };

  const handleDelete = () => {
    if (deleteId) { deleteTask(deleteId); showToast('Task deleted'); setDeleteId(null); }
  };

  const getStatusBadgeClass = (status: string) => {
    const map: Record<string, string> = {
      open: 'badge-blue', in_progress: 'badge-yellow', blocked: 'badge-red', done: 'badge-green'
    };
    return map[status] || 'badge-gray';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Planning</div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Assign, track, and complete tasks across all active jobs and crew members.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Task
        </button>
      </div>

      <div className="page-content">
        <div className="kpi-grid mb-6">
          <div className="kpi-card">
            <div className="kpi-label">Open Tasks</div>
            <div className="kpi-value kpi-primary">{tasks.filter(t => t.status === 'open').length}</div>
            <div className="kpi-sub">{tasks.filter(t => t.status === 'in_progress').length} in progress</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Overdue</div>
            <div className="kpi-value kpi-danger">{tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length}</div>
            <div className="kpi-sub">past due date</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Completed</div>
            <div className="kpi-value kpi-success">{tasks.filter(t => t.status === 'done').length}</div>
            <div className="kpi-sub">done</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">High Priority</div>
            <div className="kpi-value">{tasks.filter(t => t.priority === 'high').length}</div>
            <div className="kpi-sub">urgent tasks</div>
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
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{width: '130px'}}>
            <option value="">All Status</option>
            {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="form-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{width: '120px'}}>
            <option value="">All Priority</option>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={myTasksOnly} onChange={e => setMyTasksOnly(e.target.checked)} />
            <span className="text-sm">Open only</span>
          </label>
        </div>
        
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Job</th>
                  <th>Due</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-muted">No tasks</td></tr>
                ) : filteredTasks.map(task => {
                  const job = jobs.find(j => j.id === task.jobId);
                  return (
                    <tr key={task.id} className={task.status === 'done' ? 'opacity-50' : ''}>
                      <td className="font-medium">{task.title}</td>
                      <td>{job ? <Link to={`/jobs/${job.id}`}>{job.name}</Link> : <span className="text-muted">Company</span>}</td>
                      <td>{task.dueDate ? formatDate(task.dueDate) : '-'}</td>
                      <td><span className={`badge ${task.priority === 'urgent' ? 'badge-red' : task.priority === 'high' ? 'badge-yellow' : 'badge-gray'}`}>{task.priority}</span></td>
                      <td>
                        <select className="form-select" value={task.status} onChange={e => updateTask(task.id, { status: e.target.value as any })} style={{width: '120px', padding: '6px 8px'}}>
                          {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteId(task.id)}>
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
      
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Task" size="lg">
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Task title" />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Details" />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Job</label>
            <select className="form-select" value={formData.jobId} onChange={e => setFormData({...formData, jobId: e.target.value})}>
              <option value="">Company-wide</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
              {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Add Task</button>
        </div>
      </Modal>
      
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Task" message="Delete this task?" confirmLabel="Delete" danger />
    </div>
  );
}