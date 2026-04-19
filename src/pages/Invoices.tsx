import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';
import { INVOICE_TYPES, INVOICE_STATUSES } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { Plus, Search, Trash2 } from 'lucide-react';
import { openPrintWindow } from '../utils/printWindow';

export function Invoices() {
  const { jobs, invoices, payments, addInvoice, addPayment, deleteInvoice, branding } = useApp();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [paymentModalId, setPaymentModalId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    jobId: '', invoiceNumber: '', amount: '', type: 'deposit', dueDate: '', status: 'draft', notes: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '', date: new Date().toISOString().split('T')[0], method: 'check', checkNumber: '', notes: ''
  });

  const filteredInvoices = useMemo(() => {
    let result = [...invoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(i => {
        const job = jobs.find(j => j.id === i.jobId);
        return i.invoiceNumber.toLowerCase().includes(s) || job?.name.toLowerCase().includes(s);
      });
    }
    if (jobFilter) result = result.filter(i => i.jobId === jobFilter);
    if (statusFilter) result = result.filter(i => i.status === statusFilter);
    return result;
  }, [invoices, jobs, search, jobFilter, statusFilter]);

  const getInvoicePayments = (invoiceId: string) => payments.filter(p => p.invoiceId === invoiceId);

  const handleSave = () => {
    if (!formData.jobId || !formData.amount) { showToast('Fill required fields', 'error'); return; }
    const invNum = formData.invoiceNumber || `INV-${String(invoices.length + 1).padStart(3, '0')}`;
    addInvoice({ jobId: formData.jobId, invoiceNumber: invNum, amount: parseFloat(formData.amount), type: formData.type as any, dueDate: formData.dueDate, status: formData.status as any, notes: formData.notes });
    showToast('Invoice created');
    setShowModal(false);
    setFormData({ jobId: '', invoiceNumber: '', amount: '', type: 'deposit', dueDate: '', status: 'draft', notes: '' });
  };

  const handleAddPayment = () => {
    if (!paymentForm.amount || !paymentModalId) { showToast('Enter amount', 'error'); return; }
    addPayment({ invoiceId: paymentModalId, amount: parseFloat(paymentForm.amount), date: paymentForm.date, method: paymentForm.method as any, checkNumber: paymentForm.checkNumber, notes: paymentForm.notes });
    showToast('Payment recorded');
    setPaymentModalId(null);
    setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], method: 'check', checkNumber: '', notes: '' });
  };

  const handleDelete = () => { if (deleteId) { deleteInvoice(deleteId); showToast('Invoice deleted'); setDeleteId(null); } };

  const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaidInv = payments.reduce((sum, p) => sum + p.amount, 0);

  const handlePrintInvoice = (inv: any) => {
    console.log('handlePrintInvoice called')
    // Simple test content
    const content = '<div style="padding:40px;font-family:Arial;text-align:center;"><h1>TEST PRINT</h1><p>If you see this, the print window works.</p></div>'
    openPrintWindow(`Test Invoice`, content, branding)
  }

  return (
    <div className="print-area">
      <div className="page-header no-print">
        <h1 className="page-title">Invoices & Payments</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Create Invoice</button>
      </div>
      <div className="page-content">
        <div className="kpi-grid mb-4">
          <div className="kpi-card"><div className="kpi-label">Total Invoiced</div><div className="kpi-value kpi-primary">{formatCurrency(totalInvoiced)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Total Paid</div><div className="kpi-value kpi-success">{formatCurrency(totalPaidInv)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Outstanding</div><div className="kpi-value kpi-accent">{formatCurrency(totalInvoiced - totalPaidInv)}</div></div>
        </div>
        <div className="filters">
          <div className="search-bar"><Search /><input className="form-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{paddingLeft: '40px'}} /></div>
          <select className="form-select" value={jobFilter} onChange={e => setJobFilter(e.target.value)} style={{width: '180px'}}><option value="">All Jobs</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}</select>
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{width: '130px'}}><option value="">All Status</option>{INVOICE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        </div>
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Invoice</th><th>Job</th><th>Type</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredInvoices.length === 0 ? <tr><td colSpan={8} className="text-center text-muted">No invoices</td></tr> : filteredInvoices.map(inv => {
                  const job = jobs.find(j => j.id === inv.jobId);
                  const invPayments = getInvoicePayments(inv.id);
                  const paid = invPayments.reduce((s, p) => s + p.amount, 0);
                  return (
                    <tr key={inv.id}>
                      <td className="font-medium">{inv.invoiceNumber}</td>
                      <td><Link to={`/jobs/${inv.jobId}`}>{job?.name}</Link></td>
                      <td><span className="badge badge-gray">{inv.type}</span></td>
                      <td>{formatCurrency(inv.amount)}</td>
                      <td className="text-success">{formatCurrency(paid)}</td>
                      <td className="font-medium">{formatCurrency(inv.amount - paid)}</td>
                      <td><span className={`badge ${inv.status === 'paid' ? 'badge-green' : inv.status === 'partial' ? 'badge-yellow' : 'badge-blue'}`}>{inv.status}</span></td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-sm btn-secondary" onClick={() => setPaymentModalId(inv.id)}>Pay</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => { alert('Button clicked directly!'); handlePrintInvoice(inv); }} style={{ marginLeft: 6 }}>Print</button>
                          <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteId(inv.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Invoice">
        <div className="form-group"><label className="form-label">Job *</label><select className="form-select" value={formData.jobId} onChange={e => setFormData({...formData, jobId: e.target.value})}><option value="">Select job</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}</select></div>
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label">Invoice #</label><input className="form-input" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} placeholder="Auto" /></div>
          <div className="form-group"><label className="form-label">Amount *</label><input className="form-input" type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>{INVOICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Due Date</label><input className="form-input" type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} /></div>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Create Invoice</button></div>
      </Modal>
      <Modal isOpen={!!paymentModalId} onClose={() => setPaymentModalId(null)} title="Record Payment">
        <div className="form-group"><label className="form-label">Amount *</label><input className="form-input" type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} /></div>
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Method</label><select className="form-select" value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}><option value="check">Check</option><option value="cash">Cash</option><option value="ach">ACH</option><option value="card">Card</option></select></div>
        </div>
        <div className="form-group"><label className="form-label">Check #</label><input className="form-input" value={paymentForm.checkNumber} onChange={e => setPaymentForm({...paymentForm, checkNumber: e.target.value})} /></div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}><button className="btn btn-secondary" onClick={() => setPaymentModalId(null)}>Cancel</button><button className="btn btn-primary" onClick={handleAddPayment}>Record Payment</button></div>
      </Modal>
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Invoice" message="Delete this invoice and all payments?" confirmLabel="Delete" danger />
    </div>
  );
}
