import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  CreditCard,
  DollarSign,
  Layers3,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { EXPENSE_CATEGORIES } from '../data/types';
import type { Expense, ExpenseCategory, ExpenseCostTreatment, ExpenseSource, ExpenseType, PaymentSource } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';

type GroupMode = 'none' | 'job' | 'category' | 'vendor';

interface EnrichedExpense extends Expense {
  jobName: string;
  jobRevenue: number;
  jobEstimatedCost: number;
  inferredSource: ExpenseSource;
  inferredType: ExpenseType;
  inferredTreatment: ExpenseCostTreatment;
}

const expenseSources: { value: ExpenseSource | ''; label: string }[] = [
  { value: '', label: 'All Sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'shopping_list', label: 'Shopping List' },
  { value: 'order', label: 'Orders' },
  { value: 'time_entry', label: 'Time Entries' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'receipt', label: 'Receipt' },
];

const expenseTypes: { value: ExpenseType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'material', label: 'Material' },
  { value: 'labor', label: 'Labor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'permit', label: 'Permit' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'rental', label: 'Rental' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'allowance', label: 'Allowance' },
];

const costTreatments: { value: ExpenseCostTreatment; label: string }[] = [
  { value: 'contractor_cost', label: 'Contractor Cost' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'reimbursable', label: 'Reimbursable' },
];

const paymentSources: PaymentSource[] = ['company_card', 'cash', 'check', 'finance', 'credit', 'other'];

const defaultForm = {
  jobId: '',
  date: new Date().toISOString().split('T')[0],
  vendor: '',
  amount: '',
  category: 'materials' as ExpenseCategory,
  source: 'manual' as ExpenseSource,
  expenseType: 'material' as ExpenseType,
  costTreatment: 'contractor_cost' as ExpenseCostTreatment,
  paymentSource: 'company_card' as PaymentSource,
  notes: '',
  hasReceipt: false,
};

export function Expenses() {
  const { jobs, expenses, timeEntries, materialOrders, shoppingLists, allowances, addExpense, deleteExpense, getJobActualCost } = useApp();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<ExpenseSource | ''>('');
  const [typeFilter, setTypeFilter] = useState<ExpenseType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultForm);

  const inferSource = (expense: Expense): ExpenseSource => {
    if (expense.source) return expense.source;
    const notes = (expense.notes || '').toLowerCase();
    if (notes.includes('shopping_list') || notes.includes('shopping list')) return 'shopping_list';
    if (notes.includes('material order') || notes.includes('po-')) return 'order';
    if (notes.includes('time entry') || expense.category === 'subcontractor') return 'time_entry';
    if (notes.includes('allowance')) return 'allowance';
    if (expense.receipt) return 'receipt';
    return 'manual';
  };

  const inferType = (expense: Expense): ExpenseType => {
    if (expense.expenseType) return expense.expenseType;
    if (expense.category === 'materials') return 'material';
    if (expense.category === 'permits') return 'permit';
    if (expense.category === 'fuel') return 'fuel';
    if (expense.category === 'rental') return 'rental';
    if (expense.category === 'equipment') return 'equipment';
    if (expense.category === 'subcontractor') return 'subcontractor';
    if ((expense.notes || '').toLowerCase().includes('allowance')) return 'allowance';
    return 'material';
  };

  const enrichedExpenses = useMemo<EnrichedExpense[]>(() => {
    return expenses.map(expense => {
      const job = jobs.find(item => item.id === expense.jobId);
      return {
        ...expense,
        jobName: job?.name || 'Unknown Job',
        jobRevenue: job?.contractAmount || 0,
        jobEstimatedCost: job?.estimatedCost || 0,
        inferredSource: inferSource(expense),
        inferredType: inferType(expense),
        inferredTreatment: expense.costTreatment || ((expense.notes || '').toLowerCase().includes('reimbursable') ? 'reimbursable' : (expense.notes || '').toLowerCase().includes('allowance') ? 'allowance' : 'contractor_cost'),
      };
    });
  }, [expenses, jobs]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return enrichedExpenses
      .filter(expense => {
        if (query && ![expense.jobName, expense.vendor, expense.category, expense.notes || '', expense.inferredSource, expense.inferredType].some(value => value.toLowerCase().includes(query))) return false;
        if (jobFilter && expense.jobId !== jobFilter) return false;
        if (categoryFilter && expense.category !== categoryFilter) return false;
        if (sourceFilter && expense.inferredSource !== sourceFilter) return false;
        if (typeFilter && expense.inferredType !== typeFilter) return false;
        if (dateFrom && expense.date < dateFrom) return false;
        if (dateTo && expense.date > dateTo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [enrichedExpenses, search, jobFilter, categoryFilter, sourceFilter, typeFilter, dateFrom, dateTo]);

  const visibleJobIds = new Set(filteredExpenses.map(expense => expense.jobId));
  const visibleJobs = jobs.filter(job => visibleJobIds.size === 0 ? true : visibleJobIds.has(job.id));
  const totalSpent = visibleJobs.reduce((sum, job) => sum + getJobActualCost(job.id), 0);
  const totalRevenue = visibleJobs.reduce((sum, job) => sum + job.contractAmount, 0);
  const estimatedProfit = visibleJobs.reduce((sum, job) => sum + (job.contractAmount - job.estimatedCost), 0);
  const actualProfit = totalRevenue - totalSpent;
  const profitDelta = actualProfit - estimatedProfit;
  const filteredExpenseTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const jobSnapshots = useMemo(() => {
    return jobs.map(job => {
      const jobExpenses = enrichedExpenses.filter(expense => expense.jobId === job.id);
      const expenseTotal = jobExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const laborTotal = timeEntries.filter(entry => entry.jobId === job.id).reduce((sum, entry) => sum + entry.laborCost, 0);
      const totalSpentForJob = getJobActualCost(job.id);
      return {
        job,
        expenseTotal,
        laborTotal,
        totalSpent: totalSpentForJob,
        profitRemaining: job.contractAmount - totalSpentForJob,
        estimatedProfit: job.contractAmount - job.estimatedCost,
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [jobs, enrichedExpenses, timeEntries, getJobActualCost]);

  const groupedExpenses = useMemo(() => {
    const groups = new Map<string, { label: string; expenses: EnrichedExpense[] }>();
    filteredExpenses.forEach(expense => {
      const key = groupMode === 'job' ? expense.jobId : groupMode === 'category' ? expense.category : groupMode === 'vendor' ? expense.vendor : 'all';
      const label = groupMode === 'job' ? expense.jobName : groupMode === 'category' ? expense.category.replace('_', ' ') : groupMode === 'vendor' ? expense.vendor : 'Expenses';
      const group = groups.get(key) || { label, expenses: [] };
      group.expenses.push(expense);
      groups.set(key, group);
    });
    return [...groups.entries()].map(([key, value]) => ({ key, ...value }));
  }, [filteredExpenses, groupMode]);

  const alerts = useMemo(() => {
    const overBudget = jobSnapshots.filter(snapshot => snapshot.totalSpent > snapshot.job.estimatedCost && snapshot.job.estimatedCost > 0);
    const notInEstimate = enrichedExpenses.filter(expense => !expense.notes?.toLowerCase().includes('estimate') && expense.inferredSource === 'manual');
    const missingReceipts = enrichedExpenses.filter(expense => !expense.receipt && expense.amount >= 250);
    return [
      ...overBudget.slice(0, 3).map(snapshot => ({ title: 'Over budget warning', detail: `${snapshot.job.name} is over estimated cost by ${formatCurrency(snapshot.totalSpent - snapshot.job.estimatedCost)}.` })),
      ...(notInEstimate.length > 0 ? [{ title: 'Expenses not in estimate', detail: `${notInEstimate.length} manual expense${notInEstimate.length === 1 ? '' : 's'} may need review against scope.` }] : []),
      ...(missingReceipts.length > 0 ? [{ title: 'Missing receipts', detail: `${missingReceipts.length} expense${missingReceipts.length === 1 ? '' : 's'} over $250 have no receipt attached.` }] : []),
    ];
  }, [jobSnapshots, enrichedExpenses]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredExpenses.forEach(expense => { totals[expense.category] = (totals[expense.category] || 0) + expense.amount; });
    return totals;
  }, [filteredExpenses]);

  const handleSave = () => {
    if (!formData.jobId || !formData.vendor || !formData.amount) {
      showToast('Fill required fields', 'error');
      return;
    }
    const amount = parseFloat(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    addExpense({
      jobId: formData.jobId,
      date: formData.date,
      vendor: formData.vendor,
      amount,
      category: formData.category,
      source: formData.source,
      expenseType: formData.expenseType,
      costTreatment: formData.costTreatment,
      paymentSource: formData.paymentSource,
      receipt: formData.hasReceipt ? 'receipt-attached' : undefined,
      notes: formData.notes,
    });
    showToast('Expense added');
    setShowModal(false);
    setFormData(defaultForm);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteExpense(deleteId);
      showToast('Expense deleted');
      setDeleteId(null);
    }
  };

  const linkedSourceCounts = {
    shopping: shoppingLists.reduce((sum, list) => sum + list.items.filter(item => item.purchased).length, 0),
    orders: materialOrders.length,
    time: timeEntries.length,
    allowances: allowances.length,
  };

  return (
    <div className="expenses-command-page">
      <div className="expenses-command-header">
        <div>
          <div className="page-eyebrow">Finance</div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Control job costs, monitor profit impact, and spot spending risk in real time.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Expense
        </button>
      </div>

      <section className="expense-financial-summary">
        <FinancialMetric icon={WalletCards} label="Total Spent" value={formatCurrency(totalSpent)} sub={`${formatCurrency(filteredExpenseTotal)} filtered expenses`} />
        <FinancialMetric icon={TrendingUp} label="Total Revenue" value={formatCurrency(totalRevenue)} sub={`${visibleJobs.length} jobs in view`} />
        <FinancialMetric icon={BarChart3} label="Estimated Profit" value={formatCurrency(estimatedProfit)} sub="Revenue minus estimated cost" />
        <FinancialMetric icon={profitDelta < 0 ? TrendingDown : DollarSign} label="Actual Profit" value={formatCurrency(actualProfit)} sub={`${profitDelta >= 0 ? '+' : ''}${formatCurrency(profitDelta)} vs estimate`} tone={profitDelta < 0 ? 'danger' : 'good'} />
      </section>

      {alerts.length > 0 && (
        <section className="expense-alert-grid">
          {alerts.map(alert => (
            <div key={`${alert.title}-${alert.detail}`} className="expense-alert-card">
              <AlertTriangle size={18} />
              <span><strong>{alert.title}</strong>{alert.detail}</span>
            </div>
          ))}
        </section>
      )}

      <section className="expense-snapshot-panel">
        <div className="expense-section-heading">
          <div>
            <h2>Job Profit Snapshot</h2>
            <p>Quick view of estimate value, spend, and remaining profit.</p>
          </div>
          <div className="expense-source-pills">
            <span><ShoppingCart size={14} /> {linkedSourceCounts.shopping} shopping items</span>
            <span><Receipt size={14} /> {linkedSourceCounts.orders} orders</span>
            <span><CreditCard size={14} /> {linkedSourceCounts.time} time entries</span>
            <span><Layers3 size={14} /> {linkedSourceCounts.allowances} allowances</span>
          </div>
        </div>
        <div className="expense-job-snapshots">
          {jobSnapshots.slice(0, 5).map(snapshot => {
            const spendPercent = snapshot.job.contractAmount > 0 ? Math.min(100, (snapshot.totalSpent / snapshot.job.contractAmount) * 100) : 0;
            const isDropping = snapshot.profitRemaining < snapshot.estimatedProfit;
            return (
              <Link key={snapshot.job.id} to={`/jobs/${snapshot.job.id}`} className="expense-job-snapshot">
                <div>
                  <strong>{snapshot.job.name}</strong>
                  <span>{formatCurrency(snapshot.job.contractAmount)} estimate value</span>
                </div>
                <div className="expense-profit-track"><span style={{ width: `${spendPercent}%` }} /></div>
                <div className="expense-snapshot-stats">
                  <span>Total spent <b>{formatCurrency(snapshot.totalSpent)}</b></span>
                  <span className={isDropping ? 'danger' : 'good'}>Profit remaining <b>{formatCurrency(snapshot.profitRemaining)}</b></span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="expense-quick-add">
        <div>
          <h2>Quick Add</h2>
          <p>Capture job spend while the receipt is still in hand.</p>
        </div>
        <div className="expense-quick-grid">
          <select value={formData.jobId} onChange={event => setFormData({ ...formData, jobId: event.target.value })}>
            <option value="">Job</option>
            {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
          </select>
          <input value={formData.vendor} onChange={event => setFormData({ ...formData, vendor: event.target.value })} placeholder="Vendor" />
          <input type="number" value={formData.amount} onChange={event => setFormData({ ...formData, amount: event.target.value })} placeholder="Amount" />
          <select value={formData.category} onChange={event => setFormData({ ...formData, category: event.target.value as ExpenseCategory })}>
            {EXPENSE_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          <input value={formData.notes} onChange={event => setFormData({ ...formData, notes: event.target.value })} placeholder="Notes" />
          <button className="btn btn-primary" onClick={handleSave}><Plus size={16} /> Save</button>
        </div>
      </section>

      <section className="expense-breakdown-card">
        <div className="expense-section-heading">
          <div>
            <h2>Cost Breakdown</h2>
            <p>Filtered expense totals by category.</p>
          </div>
        </div>
        <div className="expense-category-grid">
          {Object.entries(categoryTotals).length === 0 ? <span className="expense-empty-inline">No expenses in view.</span> : Object.entries(categoryTotals).map(([category, amount]) => (
            <div key={category} className="expense-category-pill">
              <span>{category.replace('_', ' ')}</span>
              <strong>{formatCurrency(amount)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="expense-controls">
        <div className="expense-search">
          <Search size={18} />
          <input placeholder="Search job, vendor, category, notes..." value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        <select value={jobFilter} onChange={event => setJobFilter(event.target.value)}>
          <option value="">All Jobs</option>
          {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
        </select>
        <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
        <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} />
        <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value as ExpenseSource | '')}>
          {expenseSources.map(source => <option key={source.value || 'all'} value={source.value}>{source.label}</option>)}
        </select>
        <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as ExpenseType | '')}>
          {expenseTypes.map(type => <option key={type.value || 'all'} value={type.value}>{type.label}</option>)}
        </select>
      </section>

      <div className="expense-group-toggle">
        <span>Group</span>
        {(['none', 'job', 'category', 'vendor'] as GroupMode[]).map(mode => (
          <button key={mode} className={groupMode === mode ? 'is-active' : ''} onClick={() => setGroupMode(mode)}>
            {mode === 'none' ? 'None' : mode === 'job' ? 'Job' : mode === 'category' ? 'Category' : 'Vendor'}
          </button>
        ))}
      </div>

      <section className="expense-table-card">
        {groupMode === 'none' ? (
          <ExpenseTable expenses={filteredExpenses} onDelete={setDeleteId} />
        ) : (
          <div className="expense-group-list">
            {groupedExpenses.length === 0 ? <div className="expense-empty">No expenses</div> : groupedExpenses.map(group => {
              const groupTotal = group.expenses.reduce((sum, expense) => sum + expense.amount, 0);
              return (
                <div key={group.key} className="expense-group-card">
                  <div className="expense-group-header">
                    <h3>{group.label}</h3>
                    <span>{group.expenses.length} expenses • {formatCurrency(groupTotal)}</span>
                  </div>
                  <ExpenseTable expenses={group.expenses} onDelete={setDeleteId} compact />
                </div>
              );
            })}
          </div>
        )}
      </section>

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
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Expense Source</label>
            <select className="form-select" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value as ExpenseSource})}>
              {expenseSources.filter(source => source.value).map(source => <option key={source.value} value={source.value}>{source.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Expense Type</label>
            <select className="form-select" value={formData.expenseType} onChange={e => setFormData({...formData, expenseType: e.target.value as ExpenseType})}>
              {expenseTypes.filter(type => type.value).map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Cost Treatment</label>
            <select className="form-select" value={formData.costTreatment} onChange={e => setFormData({...formData, costTreatment: e.target.value as ExpenseCostTreatment})}>
              {costTreatments.map(treatment => <option key={treatment.value} value={treatment.value}>{treatment.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Payment Source</label>
            <select className="form-select" value={formData.paymentSource} onChange={e => setFormData({...formData, paymentSource: e.target.value as PaymentSource})}>
              {paymentSources.map(source => <option key={source} value={source}>{source.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <label className="expense-receipt-toggle">
          <input type="checkbox" checked={formData.hasReceipt} onChange={e => setFormData({ ...formData, hasReceipt: e.target.checked })} />
          Receipt attached
        </label>
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

function FinancialMetric({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub: string; tone?: 'danger' | 'good' }) {
  return (
    <div className={`expense-financial-card ${tone || ''}`}>
      <div className="expense-financial-icon"><Icon size={18} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function ExpenseTable({ expenses, onDelete, compact }: { expenses: EnrichedExpense[]; onDelete: (id: string) => void; compact?: boolean }) {
  if (expenses.length === 0) return <div className="expense-empty">No expenses</div>;

  return (
    <div className={`expense-table-wrap ${compact ? 'compact' : ''}`}>
      <table className="expense-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Job</th>
            <th>Vendor</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Source</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map(expense => (
            <tr key={expense.id} className={expense.inferredTreatment === 'reimbursable' ? 'is-reimbursable' : expense.inferredTreatment === 'allowance' ? 'is-allowance' : ''}>
              <td data-label="Date">{formatDate(expense.date)}</td>
              <td data-label="Job"><Link to={`/jobs/${expense.jobId}`}>{expense.jobName}</Link></td>
              <td data-label="Vendor">{expense.vendor}</td>
              <td data-label="Category"><span className="badge badge-gray">{expense.category.replace('_', ' ')}</span></td>
              <td data-label="Amount" className="expense-amount">{formatCurrency(expense.amount)}</td>
              <td data-label="Source">
                <div className="expense-source-stack">
                  <span>{expense.inferredSource.replace('_', ' ')}</span>
                  <small>{expense.inferredType} • {expense.inferredTreatment.replace('_', ' ')}</small>
                </div>
              </td>
              <td data-label="Notes" className="expense-notes-cell">
                <span>{expense.notes || 'No notes'}</span>
                <small>{expense.receipt ? 'Receipt attached' : 'No receipt'}</small>
              </td>
              <td data-label="Actions">
                <button className="btn btn-sm btn-danger btn-icon" onClick={() => onDelete(expense.id)}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
