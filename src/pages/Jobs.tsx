import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  DollarSign,
  Edit,
  Eye,
  FileText,
  ListPlus,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  StickyNote,
  Trash2,
  TrendingUp,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, parseDateString } from '../utils/formatters';
import { getJobHealthScore } from '../utils/insights';
import { JOB_STATUSES, JOB_TYPES } from '../data/types';
import type { ExpenseCategory, Job, JobStatus, JobType, ShoppingListItemCategory } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';

type PipelineFilter = 'all' | 'active' | 'scheduled' | 'in_progress' | 'on_hold' | 'completed';
type DetailTab = 'overview' | 'tasks' | 'expenses' | 'orders' | 'shopping' | 'allowances' | 'notes';
type QuickAction = 'expense' | 'shopping' | 'order' | 'invoice' | 'note';

const pipelineFilters: { id: PipelineFilter; label: string; statuses?: JobStatus[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active', statuses: ['approved', 'scheduled', 'active', 'awaiting_materials', 'awaiting_payment'] },
  { id: 'scheduled', label: 'Scheduled', statuses: ['scheduled'] },
  { id: 'in_progress', label: 'In Progress', statuses: ['active'] },
  { id: 'on_hold', label: 'On Hold', statuses: ['awaiting_materials', 'awaiting_payment'] },
  { id: 'completed', label: 'Completed', statuses: ['completed', 'closed'] },
];

const expenseCategories: ExpenseCategory[] = ['materials', 'permits', 'dump_fees', 'fuel', 'rental', 'subcontractor', 'equipment', 'misc'];
const shoppingCategories: ShoppingListItemCategory[] = ['material', 'tool', 'supply', 'hardware', 'rental', 'other'];

const emptyActionForm = {
  vendor: '',
  amount: '',
  expenseCategory: 'materials' as ExpenseCategory,
  itemName: '',
  quantity: '1',
  unit: 'ea',
  estimatedCost: '',
  shoppingCategory: 'material' as ShoppingListItemCategory,
  supplierId: '',
  notes: '',
  invoiceAmount: '',
  dueDate: '',
};

export function Jobs() {
  const {
    jobs,
    tasks,
    expenses,
    timeEntries,
    invoices,
    payments,
    notes,
    changeOrders,
    materialOrders,
    shoppingLists,
    allowances,
    jobIssues,
    punchLists,
    suppliers,
    addJob,
    updateJob,
    deleteJob,
    addExpense,
    addShoppingList,
    addShoppingListItem,
    addMaterialOrder,
    addInvoice,
    addNote,
    getJobProgress,
    getJobActualCost,
    getJobProfit,
  } = useApp();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>('all');
  const [typeFilter, setTypeFilter] = useState<JobType | ''>('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);
  const [actionJobId, setActionJobId] = useState<string>('');
  const [actionForm, setActionForm] = useState(emptyActionForm);
  const [detailOpen, setDetailOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '', customer: '', customerPhone: '', customerEmail: '', address: '',
    type: 'remodel' as JobType, contractAmount: '', estimatedCost: '',
    startDate: '', dueDate: '', status: 'lead' as JobStatus, notes: ''
  });

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter && ['all', 'active', 'scheduled', 'in_progress', 'on_hold', 'completed'].includes(filter)) {
      setPipelineFilter(filter as PipelineFilter);
    }
  }, [searchParams]);

  const jobSummaries = useMemo(() => jobs.map(job => {
    const jobTasks = tasks.filter(task => task.jobId === job.id);
    const doneTasks = jobTasks.filter(task => task.status === 'done').length;
    const blockedTasks = jobTasks.filter(task => task.status === 'blocked');
    const jobExpenses = expenses.filter(expense => expense.jobId === job.id);
    const jobTimeEntries = timeEntries.filter(entry => entry.jobId === job.id);
    const jobInvoices = invoices.filter(invoice => invoice.jobId === job.id);
    const jobPayments = payments.filter(payment => jobInvoices.some(invoice => invoice.id === payment.invoiceId));
    const jobChangeOrders = changeOrders.filter(order => order.jobId === job.id);
    const jobIssuesForJob = (jobIssues || []).filter(issue => issue.jobId === job.id);
    const jobPunchList = (punchLists || []).filter(item => item.jobId === job.id);
    const jobAllowances = allowances.filter(allowance => allowance.jobId === job.id);
    const jobOrders = materialOrders.filter(order => order.jobId === job.id);
    const jobShoppingLists = shoppingLists.filter(list => list.jobId === job.id);
    const progress = getJobProgress(job.id);
    const actualCost = getJobActualCost(job.id);
    const profitInfo = getJobProfit(job.id);
    const health = getJobHealthScore(job, {
      expenses: jobExpenses,
      timeEntries: jobTimeEntries,
      tasks: jobTasks,
      invoices: jobInvoices,
      payments: jobPayments,
      changeOrders: jobChangeOrders,
      issues: jobIssuesForJob,
      punchList: jobPunchList,
      materialOrders: jobOrders,
      shoppingLists: jobShoppingLists,
      allowances: jobAllowances,
      progress,
    });
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = job.dueDate ? parseDateString(job.dueDate) : null;
    due?.setHours(0, 0, 0, 0);
    const isDelayed = !!due && due < now && !['completed', 'closed'].includes(job.status);
    const overBudget = job.estimatedCost > 0 && actualCost > job.estimatedCost;
    const missingMaterials = ['approved', 'scheduled', 'active', 'awaiting_materials'].includes(job.status) && jobOrders.length === 0 && jobShoppingLists.length === 0;

    return {
      job,
      progress,
      actualCost,
      profit: profitInfo.profit,
      margin: profitInfo.margin,
      jobTasks,
      doneTasks,
      blockedTasks,
      jobExpenses,
      jobOrders,
      jobShoppingLists,
      health,
      alerts: [
        ...(overBudget ? [{ type: 'budget', label: 'Over budget', detail: `${formatCurrency(actualCost - job.estimatedCost)} over estimate` }] : []),
        ...(missingMaterials ? [{ type: 'materials', label: 'Missing materials', detail: 'No order or shopping list linked' }] : []),
        ...(isDelayed ? [{ type: 'delay', label: 'Delayed task', detail: `Due ${formatDate(job.dueDate)}` }] : []),
        ...blockedTasks.slice(0, 1).map(task => ({ type: 'blocked', label: 'Delayed task', detail: task.title })),
      ],
    };
  }), [jobs, tasks, expenses, timeEntries, invoices, payments, changeOrders, jobIssues, punchLists, allowances, materialOrders, shoppingLists, getJobProgress, getJobActualCost, getJobProfit]);

  const filteredSummaries = useMemo(() => {
    const currentFilter = pipelineFilters.find(filter => filter.id === pipelineFilter);
    const query = search.trim().toLowerCase();

    return jobSummaries
      .filter(({ job }) => {
        if (query && ![job.name, job.customer, job.address, job.type, job.status].some(value => (value || '').toLowerCase().includes(query))) return false;
        if (typeFilter && job.type !== typeFilter) return false;
        if (currentFilter?.statuses && !currentFilter.statuses.includes(job.status)) return false;
        return true;
      })
      .sort((a, b) => {
        const activeA = ['active', 'awaiting_materials', 'awaiting_payment'].includes(a.job.status) ? 0 : 1;
        const activeB = ['active', 'awaiting_materials', 'awaiting_payment'].includes(b.job.status) ? 0 : 1;
        if (activeA !== activeB) return activeA - activeB;
        return parseDateString(a.job.dueDate || '2999-12-31').getTime() - parseDateString(b.job.dueDate || '2999-12-31').getTime();
      });
  }, [jobSummaries, pipelineFilter, search, typeFilter]);

  const selectedSummary = useMemo(() => {
    return jobSummaries.find(summary => summary.job.id === selectedJobId) || filteredSummaries[0] || jobSummaries[0];
  }, [filteredSummaries, jobSummaries, selectedJobId]);

  const selectedJob = selectedSummary?.job;

  useEffect(() => {
    if (!selectedJobId && selectedJob) setSelectedJobId(selectedJob.id);
  }, [selectedJob, selectedJobId]);

  const kpis = useMemo(() => {
    const active = jobs.filter(job => job.status === 'active');
    const scheduled = jobs.filter(job => job.status === 'scheduled');
    const completed = jobs.filter(job => job.status === 'completed' || job.status === 'closed');
    const revenue = jobs.reduce((sum, job) => sum + job.contractAmount, 0);
    return [
      { label: 'Active Jobs', value: active.length.toString(), sub: `${formatCurrency(active.reduce((sum, job) => sum + job.contractAmount, 0))} contracted`, filter: 'in_progress' as PipelineFilter, icon: Wrench },
      { label: 'Scheduled', value: scheduled.length.toString(), sub: `${formatCurrency(scheduled.reduce((sum, job) => sum + job.contractAmount, 0))} value`, filter: 'scheduled' as PipelineFilter, icon: CalendarDays },
      { label: 'Completed', value: completed.length.toString(), sub: `${formatCurrency(completed.reduce((sum, job) => sum + job.contractAmount, 0))} closed`, filter: 'completed' as PipelineFilter, icon: CheckCircle },
      { label: 'Total Revenue', value: formatCurrency(revenue), sub: `${jobs.length} total jobs`, filter: 'all' as PipelineFilter, icon: TrendingUp },
    ];
  }, [jobs]);

  const selectedJobData = useMemo(() => {
    if (!selectedJob) return null;
    return {
      tasks: tasks.filter(task => task.jobId === selectedJob.id),
      expenses: expenses.filter(expense => expense.jobId === selectedJob.id),
      invoices: invoices.filter(invoice => invoice.jobId === selectedJob.id),
      notes: notes.filter(note => note.jobId === selectedJob.id),
      orders: materialOrders.filter(order => order.jobId === selectedJob.id),
      shopping: shoppingLists.filter(list => list.jobId === selectedJob.id),
      allowances: allowances.filter(allowance => allowance.jobId === selectedJob.id),
    };
  }, [selectedJob, tasks, expenses, invoices, notes, materialOrders, shoppingLists, allowances]);

  const openModal = (job?: Job) => {
    if (job) {
      setEditingJob(job);
      setFormData({
        name: job.name,
        customer: job.customer || '',
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
      updateJob(editingJob.id, jobData);
      showToast('Job updated');
    } else {
      const id = addJob(jobData);
      setSelectedJobId(id);
      showToast('Job created');
    }
    setShowModal(false);
  };

  const handleDelete = () => {
    if (deleteJobId) {
      deleteJob(deleteJobId);
      showToast('Job deleted');
      setDeleteJobId(null);
      if (selectedJobId === deleteJobId) setSelectedJobId('');
    }
  };

  const openQuickAction = (type: QuickAction, job: Job) => {
    const preferredSupplier = suppliers.find(supplier => supplier.isDefault || supplier.isPreferred) || suppliers[0];
    setQuickAction(type);
    setActionJobId(job.id);
    setActionForm({
      ...emptyActionForm,
      vendor: preferredSupplier?.name || '',
      supplierId: preferredSupplier?.id || '',
      invoiceAmount: job.contractAmount.toString(),
      dueDate: job.dueDate || '',
    });
  };

  const handleQuickAction = () => {
    const job = jobs.find(item => item.id === actionJobId);
    if (!job || !quickAction) return;
    const supplier = suppliers.find(item => item.id === actionForm.supplierId);
    const supplierName = supplier?.name || actionForm.vendor || 'Supplier TBD';

    if (quickAction === 'expense') {
      const amount = parseFloat(actionForm.amount) || 0;
      if (!amount) {
        showToast('Enter an expense amount', 'error');
        return;
      }
      addExpense({
        jobId: job.id,
        date: new Date().toISOString().split('T')[0],
        vendor: supplierName,
        amount,
        category: actionForm.expenseCategory,
        paymentSource: 'company_card',
        notes: actionForm.notes,
      });
      showToast('Expense added');
    }

    if (quickAction === 'shopping') {
      if (!actionForm.itemName.trim()) {
        showToast('Enter a shopping item', 'error');
        return;
      }
      const openList = shoppingLists.find(list => list.jobId === job.id && list.status !== 'completed');
      const listId = openList?.id || addShoppingList({
        jobId: job.id,
        jobName: job.name,
        title: `${job.name} Shopping List`,
        status: 'open',
        supplierId: supplier?.id,
        supplierName,
        store: supplierName,
        notes: 'Created from Jobs command center',
        items: [],
      });
      addShoppingListItem(listId, {
        name: actionForm.itemName,
        category: actionForm.shoppingCategory,
        quantity: parseFloat(actionForm.quantity) || 1,
        unit: actionForm.unit || 'ea',
        estimatedCost: parseFloat(actionForm.estimatedCost) || undefined,
        purchased: false,
        urgent: true,
        supplierId: supplier?.id,
        supplierName,
        notes: actionForm.notes,
      });
      showToast('Shopping item added');
    }

    if (quickAction === 'order') {
      const quantity = parseFloat(actionForm.quantity) || 1;
      const unitPrice = parseFloat(actionForm.estimatedCost) || 0;
      const subtotal = quantity * unitPrice;
      addMaterialOrder({
        jobId: job.id,
        supplierId: supplier?.id,
        supplierName,
        poNumber: `PO-${Date.now().toString().slice(-6)}`,
        status: 'draft',
        items: actionForm.itemName.trim() ? [{
          id: crypto.randomUUID(),
          name: actionForm.itemName,
          quantity,
          unit: actionForm.unit || 'ea',
          unitPrice,
          category: 'material',
          supplier: supplierName,
          supplierId: supplier?.id,
          orderedQuantity: quantity,
          receivedQuantity: 0,
          lineTotal: subtotal,
        }] : [],
        subtotal,
        total: subtotal,
        notes: actionForm.notes || 'Created from Jobs command center',
      });
      showToast('Order created');
    }

    if (quickAction === 'invoice') {
      const amount = parseFloat(actionForm.invoiceAmount) || job.contractAmount;
      addInvoice({
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        jobId: job.id,
        amount,
        type: 'progress',
        dueDate: actionForm.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft',
        notes: actionForm.notes || 'Generated from Jobs command center',
      });
      showToast('Invoice draft created');
    }

    if (quickAction === 'note') {
      if (!actionForm.notes.trim()) {
        showToast('Enter a note', 'error');
        return;
      }
      addNote({ jobId: job.id, content: actionForm.notes });
      showToast('Note added');
    }

    setQuickAction(null);
    setActionForm(emptyActionForm);
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

  const selectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setDetailOpen(true);
  };

  return (
    <div className="jobs-command-page">
      <div className="jobs-command-header">
        <div>
          <div className="page-eyebrow">Operations</div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-subtitle">Manage active projects, track progress, and monitor profitability</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add New Job
        </button>
      </div>

      <div className="jobs-kpi-grid">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <button key={kpi.label} className={`jobs-kpi-card ${pipelineFilter === kpi.filter ? 'is-active' : ''}`} onClick={() => setPipelineFilter(kpi.filter)} title={`Filter to ${kpi.label}`}>
              <div className="jobs-kpi-icon"><Icon size={18} /></div>
              <div>
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <small>{kpi.sub}</small>
              </div>
            </button>
          );
        })}
      </div>

      <div className="jobs-toolbar">
        <div className="jobs-search">
          <Search size={18} />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search jobs, customers, addresses..." />
        </div>
        <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as JobType | '')}>
          <option value="">All Types</option>
          {JOB_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
      </div>

      <div className="jobs-pipeline">
        {pipelineFilters.map(filter => (
          <button key={filter.id} className={pipelineFilter === filter.id ? 'is-active' : ''} onClick={() => setPipelineFilter(filter.id)}>
            {filter.label}
            <span>{filter.statuses ? jobs.filter(job => filter.statuses?.includes(job.status)).length : jobs.length}</span>
          </button>
        ))}
      </div>

      <div className="jobs-command-layout">
        <section className="jobs-list-panel">
          {filteredSummaries.length === 0 ? (
            <div className="jobs-empty-state">
              <ClipboardList size={36} />
              <h3>No jobs found</h3>
              <p>Adjust filters or add a new job to start managing the work pipeline.</p>
              <button className="btn btn-primary" onClick={() => openModal()}><Plus size={16} /> Add New Job</button>
            </div>
          ) : filteredSummaries.map(summary => (
            <article key={summary.job.id} className={`job-command-card ${selectedJob?.id === summary.job.id ? 'is-selected' : ''}`} onClick={() => selectJob(summary.job.id)}>
              <div className="job-card-main">
                <div>
                  <div className="job-card-title-row">
                    <h3>{summary.job.name}</h3>
                    <span className={`badge ${getStatusBadgeClass(summary.job.status)}`}>{summary.job.status.replace('_', ' ')}</span>
                  </div>
                  <p>{summary.job.customer || 'No customer'} • {summary.job.type.replace('_', ' ')}</p>
                </div>
                <div className="job-card-right">
                  <div className={`job-health-pill ${summary.health.status}`}>{summary.health.score} {summary.health.label}</div>
                  <div className="job-due-pill"><CalendarDays size={14} /> {summary.job.dueDate ? formatDate(summary.job.dueDate) : 'No due date'}</div>
                </div>
              </div>

              <div className="job-progress-row">
                <div className="job-progress-track"><span style={{ width: `${summary.progress}%` }} /></div>
                <strong>{summary.progress}%</strong>
              </div>

              <div className="job-card-metrics">
                <span><small>Revenue</small>{formatCurrency(summary.job.contractAmount)}</span>
                <span><small>Actual</small>{formatCurrency(summary.actualCost)}</span>
                <span className={summary.profit >= 0 ? 'positive' : 'negative'}><small>Profit</small>{formatCurrency(summary.profit)}</span>
              </div>

              {summary.alerts.length > 0 && (
                <div className="job-alert-strip">
                  {summary.alerts.slice(0, 2).map(alert => <span key={`${summary.job.id}-${alert.type}`}><AlertTriangle size={13} /> {alert.label}</span>)}
                </div>
              )}

              <div className="job-card-actions" onClick={event => event.stopPropagation()}>
                <Link to={`/jobs/${summary.job.id}`} className="btn btn-sm btn-secondary"><Eye size={15} /> View</Link>
                <button className="btn btn-sm btn-secondary" onClick={() => openQuickAction('expense', summary.job)}><DollarSign size={15} /> Add Expense</button>
                <button className="btn btn-sm btn-secondary" onClick={() => openQuickAction('shopping', summary.job)}><ListPlus size={15} /> Add Shopping Item</button>
                <button className="btn btn-sm btn-secondary" onClick={() => openQuickAction('order', summary.job)}><PackagePlus size={15} /> Create Order</button>
              </div>
            </article>
          ))}
        </section>

        {selectedJob && selectedSummary && (
          <aside className={`job-detail-command-panel ${detailOpen ? 'is-open' : ''}`}>
            <button className="job-detail-close" onClick={() => setDetailOpen(false)}><X size={18} /></button>
            <div className="job-detail-hero">
              <div>
                <span className={`badge ${getStatusBadgeClass(selectedJob.status)}`}>{selectedJob.status.replace('_', ' ')}</span>
                <h2>{selectedJob.name}</h2>
                <p>{selectedJob.customer || 'No customer'} • {selectedJob.address}</p>
              </div>
              <div className="job-detail-actions">
                <button className="btn btn-sm btn-secondary" onClick={() => openModal(selectedJob)}><Edit size={15} /> Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => setDeleteJobId(selectedJob.id)}><Trash2 size={15} /></button>
              </div>
            </div>

            <div className="job-detail-finance-grid">
              <Metric label="Estimated Total" value={formatCurrency(selectedJob.contractAmount)} />
              <Metric label="Actual Cost" value={formatCurrency(selectedSummary.actualCost)} />
              <Metric label="Profit" value={formatCurrency(selectedSummary.profit)} tone={selectedSummary.profit >= 0 ? 'positive' : 'negative'} />
            </div>

            <div className={`job-detail-health ${selectedSummary.health.status}`}>
              <div className="job-detail-health-score">
                <strong>{selectedSummary.health.score}</strong>
                <span>{selectedSummary.health.label}</span>
              </div>
              <div>
                <small>Job Health</small>
                <p>{selectedSummary.health.summary}</p>
              </div>
            </div>

            <div className="job-detail-progress">
              <div><span>Progress</span><strong>{selectedSummary.progress}%</strong></div>
              <div className="job-progress-track"><span style={{ width: `${selectedSummary.progress}%` }} /></div>
            </div>

            {selectedSummary.alerts.length > 0 && (
              <div className="job-smart-alerts">
                {selectedSummary.alerts.map(alert => (
                  <div key={`${selectedJob.id}-${alert.type}-${alert.detail}`}>
                    <AlertTriangle size={16} />
                    <span><strong>{alert.label}</strong>{alert.detail}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="job-quick-actions">
              <button onClick={() => openQuickAction('expense', selectedJob)}><DollarSign size={16} /> Add Expense</button>
              <button onClick={() => openQuickAction('shopping', selectedJob)}><ShoppingCart size={16} /> Add Shopping Item</button>
              <button onClick={() => openQuickAction('order', selectedJob)}><PackagePlus size={16} /> Create Order</button>
              <button onClick={() => openQuickAction('invoice', selectedJob)}><FileText size={16} /> Generate Invoice</button>
              <button onClick={() => openQuickAction('note', selectedJob)}><StickyNote size={16} /> Add Note</button>
            </div>

            <div className="job-detail-tabs">
              {(['overview', 'tasks', 'expenses', 'orders', 'shopping', 'allowances', 'notes'] as DetailTab[]).map(tab => (
                <button key={tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>{tab === 'shopping' ? 'Shopping List' : tab}</button>
              ))}
            </div>

            <div className="job-tab-body">
              {activeTab === 'overview' && (
                <div className="job-overview-grid">
                  <InfoBlock icon={Banknote} label="Contract" value={formatCurrency(selectedJob.contractAmount)} />
                  <InfoBlock icon={DollarSign} label="Estimated Cost" value={formatCurrency(selectedJob.estimatedCost)} />
                  <InfoBlock icon={ClipboardList} label="Tasks" value={`${selectedSummary.doneTasks}/${selectedSummary.jobTasks.length} complete`} />
                  <InfoBlock icon={PackagePlus} label="Orders" value={`${selectedJobData?.orders.length || 0} linked`} />
                </div>
              )}
              {activeTab === 'tasks' && <RecordList empty="No tasks linked yet.">{selectedJobData?.tasks.map(task => <MiniRecord key={task.id} title={task.title} meta={`${task.priority} • ${task.status.replace('_', ' ')}`} amount={task.dueDate ? formatDate(task.dueDate) : undefined} />)}</RecordList>}
              {activeTab === 'expenses' && <RecordList empty="No expenses yet.">{selectedJobData?.expenses.map(expense => <MiniRecord key={expense.id} title={expense.vendor} meta={`${expense.category.replace('_', ' ')} • ${formatDate(expense.date)}`} amount={formatCurrency(expense.amount)} />)}</RecordList>}
              {activeTab === 'orders' && <RecordList empty="No material orders yet.">{selectedJobData?.orders.map(order => <MiniRecord key={order.id} title={order.poNumber} meta={`${order.supplierName || 'No supplier'} • ${order.status}`} amount={formatCurrency(order.total)} />)}</RecordList>}
              {activeTab === 'shopping' && <RecordList empty="No shopping lists yet.">{selectedJobData?.shopping.map(list => <MiniRecord key={list.id} title={list.title} meta={`${list.items.length} item${list.items.length === 1 ? '' : 's'} • ${list.status}`} amount={list.supplierName || list.store} />)}</RecordList>}
              {activeTab === 'allowances' && <RecordList empty="No allowances yet.">{selectedJobData?.allowances.map(allowance => <MiniRecord key={allowance.id} title={allowance.name} meta={`${allowance.category} • ${allowance.status.replace('_', ' ')}`} amount={formatCurrency(allowance.remainingAmount)} />)}</RecordList>}
              {activeTab === 'notes' && <RecordList empty="No notes yet.">{selectedJobData?.notes.map(note => <MiniRecord key={note.id} title={note.content} meta={formatDate(note.createdAt)} />)}</RecordList>}
            </div>
          </aside>
        )}
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

      <Modal isOpen={!!quickAction} onClose={() => setQuickAction(null)} title={getQuickActionTitle(quickAction)} size="md">
        {(quickAction === 'expense' || quickAction === 'shopping' || quickAction === 'order') && (
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select className="form-select" value={actionForm.supplierId} onChange={event => {
                const supplier = suppliers.find(item => item.id === event.target.value);
                setActionForm({ ...actionForm, supplierId: event.target.value, vendor: supplier?.name || '' });
              }}>
                <option value="">No supplier</option>
                {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Vendor</label>
              <input className="form-input" value={actionForm.vendor} onChange={event => setActionForm({ ...actionForm, vendor: event.target.value, supplierId: '' })} placeholder="Vendor name" />
            </div>
          </div>
        )}
        {quickAction === 'expense' && (
          <>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Amount *</label><input className="form-input" type="number" value={actionForm.amount} onChange={event => setActionForm({ ...actionForm, amount: event.target.value })} /></div>
              <div className="form-group"><label className="form-label">Category</label><select className="form-select" value={actionForm.expenseCategory} onChange={event => setActionForm({ ...actionForm, expenseCategory: event.target.value as ExpenseCategory })}>{expenseCategories.map(category => <option key={category} value={category}>{category.replace('_', ' ')}</option>)}</select></div>
            </div>
          </>
        )}
        {(quickAction === 'shopping' || quickAction === 'order') && (
          <>
            <div className="form-group"><label className="form-label">Item Name *</label><input className="form-input" value={actionForm.itemName} onChange={event => setActionForm({ ...actionForm, itemName: event.target.value })} placeholder="Materials, fixture, rental..." /></div>
            <div className="form-row form-row-3">
              <div className="form-group"><label className="form-label">Quantity</label><input className="form-input" type="number" value={actionForm.quantity} onChange={event => setActionForm({ ...actionForm, quantity: event.target.value })} /></div>
              <div className="form-group"><label className="form-label">Unit</label><input className="form-input" value={actionForm.unit} onChange={event => setActionForm({ ...actionForm, unit: event.target.value })} /></div>
              <div className="form-group"><label className="form-label">{quickAction === 'order' ? 'Unit Price' : 'Est. Cost'}</label><input className="form-input" type="number" value={actionForm.estimatedCost} onChange={event => setActionForm({ ...actionForm, estimatedCost: event.target.value })} /></div>
            </div>
            {quickAction === 'shopping' && <div className="form-group"><label className="form-label">Category</label><select className="form-select" value={actionForm.shoppingCategory} onChange={event => setActionForm({ ...actionForm, shoppingCategory: event.target.value as ShoppingListItemCategory })}>{shoppingCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></div>}
          </>
        )}
        {quickAction === 'invoice' && (
          <div className="form-row form-row-2">
            <div className="form-group"><label className="form-label">Invoice Amount</label><input className="form-input" type="number" value={actionForm.invoiceAmount} onChange={event => setActionForm({ ...actionForm, invoiceAmount: event.target.value })} /></div>
            <div className="form-group"><label className="form-label">Due Date</label><input className="form-input" type="date" value={actionForm.dueDate} onChange={event => setActionForm({ ...actionForm, dueDate: event.target.value })} /></div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">{quickAction === 'note' ? 'Note *' : 'Notes'}</label>
          <textarea className="form-textarea" value={actionForm.notes} onChange={event => setActionForm({ ...actionForm, notes: event.target.value })} placeholder="Add context for the crew, vendor, or office..." />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setQuickAction(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleQuickAction}>Save</button>
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

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className={`job-detail-metric ${tone || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoBlock({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="job-info-block">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RecordList({ children, empty }: { children?: ReactNode; empty: string }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  if (!items || (Array.isArray(items) && items.length === 0)) return <div className="job-tab-empty">{empty}</div>;
  return <div className="job-record-list">{items}</div>;
}

function MiniRecord({ title, meta, amount }: { title: string; meta?: string; amount?: string }) {
  return (
    <div className="job-mini-record">
      <div>
        <strong>{title}</strong>
        {meta && <span>{meta}</span>}
      </div>
      {amount && <em>{amount}</em>}
    </div>
  );
}

function getQuickActionTitle(action: QuickAction | null) {
  if (action === 'expense') return 'Add Expense';
  if (action === 'shopping') return 'Add Shopping Item';
  if (action === 'order') return 'Create Order';
  if (action === 'invoice') return 'Generate Invoice';
  if (action === 'note') return 'Add Note';
  return 'Quick Action';
}
