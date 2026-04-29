import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Edit,
  Plus,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { CompanyExpense, CompanyExpenseCategory, CompanyExpenseStatus } from '../data/types';

const categories: { value: CompanyExpenseCategory; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'truck_payment', label: 'Truck Payment' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'software', label: 'Software' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'loan', label: 'Loan' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'other', label: 'Other' },
];

const frequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
] as const;

const todayKey = () => new Date().toISOString().split('T')[0];

const emptyForm = {
  name: '',
  vendor: '',
  category: 'credit_card' as CompanyExpenseCategory,
  amount: '',
  dueDate: todayKey(),
  paidDate: '',
  status: 'upcoming' as CompanyExpenseStatus,
  recurring: true,
  frequency: 'monthly' as CompanyExpense['frequency'],
  paymentMethod: '',
  accountLast4: '',
  notes: '',
};

function effectiveStatus(expense: CompanyExpense): CompanyExpenseStatus {
  if (expense.status === 'paid') return 'paid';
  return expense.dueDate < todayKey() ? 'overdue' : 'upcoming';
}

function categoryLabel(category: CompanyExpenseCategory) {
  return categories.find(item => item.value === category)?.label || 'Other';
}

export function CompanyExpenses() {
  const { companyExpenses, addCompanyExpense, updateCompanyExpense, deleteCompanyExpense } = useApp();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<CompanyExpense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const sortedExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...companyExpenses]
      .filter(expense => {
        const status = effectiveStatus(expense);
        const haystack = `${expense.name} ${expense.vendor} ${expense.notes || ''} ${expense.paymentMethod || ''}`.toLowerCase();
        if (query && !haystack.includes(query)) return false;
        if (categoryFilter && expense.category !== categoryFilter) return false;
        if (statusFilter && status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [categoryFilter, companyExpenses, search, statusFilter]);

  const totals = useMemo(() => {
    return companyExpenses.reduce((acc, expense) => {
      const status = effectiveStatus(expense);
      if (status === 'paid') acc.paid += expense.amount;
      if (status === 'upcoming') acc.upcoming += expense.amount;
      if (status === 'overdue') acc.overdue += expense.amount;
      if (expense.recurring) acc.recurring += expense.amount;
      return acc;
    }, { paid: 0, upcoming: 0, overdue: 0, recurring: 0 });
  }, [companyExpenses]);

  const nextDue = companyExpenses
    .filter(expense => effectiveStatus(expense) !== 'paid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  const resetForm = () => {
    setForm(emptyForm);
    setEditingExpense(null);
  };

  const openModal = (expense?: CompanyExpense) => {
    if (expense) {
      setEditingExpense(expense);
      setForm({
        name: expense.name,
        vendor: expense.vendor,
        category: expense.category,
        amount: String(expense.amount),
        dueDate: expense.dueDate,
        paidDate: expense.paidDate || '',
        status: effectiveStatus(expense),
        recurring: expense.recurring,
        frequency: expense.frequency || 'monthly',
        paymentMethod: expense.paymentMethod || '',
        accountLast4: expense.accountLast4 || '',
        notes: expense.notes || '',
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.vendor.trim()) {
      showToast('Name and vendor are required', 'error');
      return;
    }
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Amount must be greater than zero', 'error');
      return;
    }

    const payload = {
      name: form.name.trim(),
      vendor: form.vendor.trim(),
      category: form.category,
      amount,
      dueDate: form.dueDate,
      paidDate: form.status === 'paid' ? form.paidDate || todayKey() : undefined,
      status: form.status,
      recurring: form.recurring,
      frequency: form.recurring ? form.frequency : undefined,
      paymentMethod: form.paymentMethod.trim(),
      accountLast4: form.accountLast4.trim(),
      notes: form.notes.trim(),
    };

    if (editingExpense) {
      updateCompanyExpense(editingExpense.id, payload);
      showToast('Company expense updated');
    } else {
      addCompanyExpense(payload);
      showToast('Company expense added');
    }
    setShowModal(false);
    resetForm();
  };

  const markPaid = (expense: CompanyExpense) => {
    updateCompanyExpense(expense.id, { status: 'paid', paidDate: todayKey() });
    showToast('Marked paid');
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteCompanyExpense(deleteId);
    setDeleteId(null);
    showToast('Company expense deleted');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Business Finance</div>
          <h1 className="page-title">Company Expenses</h1>
          <p className="page-subtitle">Track non-job business bills, due dates, and payments.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add Expense
        </button>
      </div>

      <div className="page-content">
        <div className="kpi-grid mb-6">
          <div className="kpi-card">
            <div className="kpi-label">Upcoming</div>
            <div className="kpi-value">{formatCurrency(totals.upcoming)}</div>
            <div className="kpi-sub">{nextDue ? `Next due ${formatDate(nextDue.dueDate)}` : 'No open bills'}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Overdue</div>
            <div className="kpi-value kpi-danger">{formatCurrency(totals.overdue)}</div>
            <div className="kpi-sub">Past due unpaid bills</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Paid</div>
            <div className="kpi-value kpi-success">{formatCurrency(totals.paid)}</div>
            <div className="kpi-sub">Paid business expenses</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Recurring</div>
            <div className="kpi-value kpi-primary">{formatCurrency(totals.recurring)}</div>
            <div className="kpi-sub">Expected recurring obligations</div>
          </div>
        </div>

        <div className="filters">
          <div className="search-bar">
            <Search />
            <input className="form-input" placeholder="Search vendor, account, notes..." value={search} onChange={event => setSearch(event.target.value)} style={{ paddingLeft: '40px' }} />
          </div>
          <select className="form-select" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
            <option value="">All Categories</option>
            {categories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          <select className="form-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="">All Statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div className="card">
          <div className="card-body">
            {sortedExpenses.length === 0 ? (
              <div className="empty-state">
                <CreditCard size={38} />
                <h3>No company expenses yet</h3>
                <p>Add credit cards, truck payments, insurance, software, and other business bills here.</p>
                <button className="btn btn-primary" onClick={() => openModal()}><Plus size={18} /> Add First Expense</button>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Expense</th>
                      <th>Category</th>
                      <th>Due</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExpenses.map(expense => {
                      const status = effectiveStatus(expense);
                      return (
                        <tr key={expense.id}>
                          <td>
                            <div className="font-medium">{expense.name}</div>
                            <div className="text-sm text-muted">{expense.vendor}{expense.accountLast4 ? ` ending ${expense.accountLast4}` : ''}</div>
                          </td>
                          <td>
                            <span className="badge badge-gray">
                              {expense.category === 'truck_payment' ? <Truck size={13} /> : <CreditCard size={13} />}
                              {categoryLabel(expense.category)}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2"><CalendarDays size={14} /> {formatDate(expense.dueDate)}</div>
                            {expense.recurring && <div className="text-sm text-muted">{expense.frequency || 'monthly'}</div>}
                          </td>
                          <td>
                            <span className={`badge ${status === 'paid' ? 'badge-green' : status === 'overdue' ? 'badge-red' : 'badge-yellow'}`}>
                              {status === 'paid' ? <CheckCircle2 size={13} /> : status === 'overdue' ? <AlertTriangle size={13} /> : <CalendarDays size={13} />}
                              {status}
                            </span>
                          </td>
                          <td className="font-medium">{formatCurrency(expense.amount)}</td>
                          <td>
                            <div>{expense.paymentMethod || 'Not set'}</div>
                            {expense.paidDate && <div className="text-sm text-muted">Paid {formatDate(expense.paidDate)}</div>}
                          </td>
                          <td>
                            <div className="flex gap-2 justify-end">
                              {status !== 'paid' && <button className="btn btn-sm btn-secondary" onClick={() => markPaid(expense)}>Paid</button>}
                              <button className="btn btn-sm btn-secondary btn-icon" onClick={() => openModal(expense)}><Edit size={15} /></button>
                              <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteId(expense.id)}><Trash2 size={15} /></button>
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
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingExpense ? 'Edit Company Expense' : 'Add Company Expense'} size="lg">
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Expense Name *</label>
            <input className="form-input" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Credit card, truck payment, insurance" />
          </div>
          <div className="form-group">
            <label className="form-label">Vendor *</label>
            <input className="form-input" value={form.vendor} onChange={event => setForm({ ...form, vendor: event.target.value })} placeholder="Bank, lender, carrier, vendor" />
          </div>
        </div>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category} onChange={event => setForm({ ...form, category: event.target.value as CompanyExpenseCategory })}>
              {categories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount *</label>
            <input className="form-input" type="number" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })} />
          </div>
        </div>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={event => setForm({ ...form, status: event.target.value as CompanyExpenseStatus })}>
              <option value="upcoming">Upcoming</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Paid Date</label>
            <input className="form-input" type="date" value={form.paidDate} onChange={event => setForm({ ...form, paidDate: event.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <input className="form-input" value={form.paymentMethod} onChange={event => setForm({ ...form, paymentMethod: event.target.value })} placeholder="ACH, check, card" />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Recurring</label>
            <select className="form-select" value={form.recurring ? 'yes' : 'no'} onChange={event => setForm({ ...form, recurring: event.target.value === 'yes' })}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Frequency</label>
            <select className="form-select" value={form.frequency} disabled={!form.recurring} onChange={event => setForm({ ...form, frequency: event.target.value as CompanyExpense['frequency'] })}>
              {frequencies.map(frequency => <option key={frequency.value} value={frequency.value}>{frequency.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Account Last 4</label>
          <input className="form-input" value={form.accountLast4} maxLength={4} onChange={event => setForm({ ...form, accountLast4: event.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" rows={3} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} />
        </div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editingExpense ? 'Save Changes' : 'Add Expense'}</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Company Expense"
        message="Delete this company expense?"
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
