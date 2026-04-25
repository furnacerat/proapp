import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { EXPENSE_CATEGORIES } from '../data/types';
import type { ExpenseCategory, PaymentSource } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { Plus, Search, Trash2 } from 'lucide-react';

export function Expenses() {
  const { jobs, expenses, addExpense, deleteExpense } = useApp();
  const { showToast } = useToast();
  
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    jobId: '', date: new Date().toISOString().split('T')[0], vendor: '', amount: '', category: 'materials', paymentSource: 'company_card', notes: ''
  });

  const filteredExpenses = useMemo(() => {
    let result = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e => {
        const job = jobs.find(j => j.id === e.jobId);
        return job?.name.toLowerCase().includes(s) || e.vendor.toLowerCase().includes(s) || e.category.includes(s);
      });
    }
    
    if (jobFilter) result = result.filter(e => e.jobId === jobFilter);
    if (categoryFilter) result = result.filter(e => e.category === categoryFilter);
    
    return result;
  }, [expenses, jobs, search, jobFilter, categoryFilter]);

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleSave = () => {
    if (!formData.jobId || !formData.vendor || !formData.amount) {
      showToast('Fill required fields', 'error');
      return;
    }
    addExpense({
      jobId: formData.jobId,
      date: formData.date,
      vendor: formData.vendor,
      amount: parseFloat(formData.amount),
      category: formData.category as any,
      paymentSource: formData.paymentSource as any,
      notes: formData.notes,
    });
    showToast('Expense added');
    setShowModal(false);
    setFormData({ jobId: '', date: new Date().toISOString().split('T')[0], vendor: '', amount: '', category: 'materials', paymentSource: 'company_card', notes: '' });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteExpense(deleteId);
      showToast('Expense deleted');
      setDeleteId(null);
    }
  };

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
    return totals;
  }, [expenses]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Finance</div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Track job costs, vendor invoices, and material purchases across all active projects.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Expense
        </button>
      </div>

      <div className="page-content">
        <div className="kpi-grid mb-6">
          <div className="kpi-card">
            <div className="kpi-label">Total Expenses</div>
            <div className="kpi-value">{formatCurrency(totalAmount)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Expenses</div>
            <div className="kpi-value">{filteredExpenses.length}</div>
          </div>
        </div>
        
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title">By Category</h3>
          </div>
          <div className="card-body">
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryTotals).map(([cat, amt]) => (
                <div key={cat} className="badge badge-gray" style={{fontSize: '0.85rem', padding: '8px 12px'}}>
                  {cat}: {formatCurrency(amt)}
                </div>
              ))}
            </div>
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
          <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{width: '150px'}}>
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        
        <div className="card">
          <div className="table-container">
            <table className="table table-responsive">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Job</th>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-muted">No expenses</td></tr>
                ) : filteredExpenses.map(exp => {
                  const job = jobs.find(j => j.id === exp.jobId);
                  return (
                    <tr key={exp.id}>
                      <td data-label="Date">{formatDate(exp.date)}</td>
                      <td data-label="Job"><Link to={`/jobs/${exp.jobId}`}>{job?.name}</Link></td>
                      <td data-label="Vendor">{exp.vendor}</td>
                      <td data-label="Category"><span className="badge badge-gray">{exp.category}</span></td>
                      <td data-label="Amount" className="font-medium">{formatCurrency(exp.amount)}</td>
                      <td data-label="Notes" className="truncate" style={{maxWidth: '150px'}}>{exp.notes}</td>
                      <td data-label="Actions">
                        <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteId(exp.id)}>
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
      
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Expense">
        <div className="form-group">
          <label className="form-label">Job *</label>
          <select className="form-select" value={formData.jobId} onChange={e => setFormData({...formData, jobId: e.target.value})}>
            <option value="">Select job</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Vendor *</label>
            <input className="form-input" value={formData.vendor} onChange={e => setFormData({...formData, vendor: e.target.value})} placeholder="Vendor name" />
          </div>
          <div className="form-group">
            <label className="form-label">Amount *</label>
            <input className="form-input" type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0" />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ExpenseCategory})}>
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Payment Source</label>
          <select className="form-select" value={formData.paymentSource} onChange={e => setFormData({...formData, paymentSource: e.target.value as PaymentSource})}>
            <option value="company_card">Company Card</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="finance">Finance</option>
            <option value="credit">Credit</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Add Expense</button>
        </div>
      </Modal>
      
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Expense" message="Delete this expense?" confirmLabel="Delete" danger />
    </div>
  );
}