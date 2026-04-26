import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';
import { getJobInsights } from '../utils/insights';
import { JOB_STATUSES, EXPENSE_CATEGORIES, INVOICE_TYPES, CHANGE_ORDER_STATUSES, PHOTO_CATEGORIES, TASK_STATUSES, PRIORITIES, PunchListStatus, IssueStatus, IssueSeverity } from '../data/types';
import type { JobTimelineEntry, JobLog, PunchListItem, JobIssue, FileAttachment, AllowanceCategory, AllowanceSelectionStatus } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { 
  ArrowLeft, MapPin, Trash2, Plus, Camera, FileText, Clock, Receipt, CheckSquare, DollarSign, 
  AlertTriangle, TrendingUp, Wrench, Edit, Copy, Upload, AlertCircle, Clipboard, Activity,
  CheckCircle, XCircle, PlayCircle, PauseCircle, Save, Image, File, MessageSquare, Users, ListChecks,
  Flag, Paperclip, Eye, Calendar, Send, ShoppingCart
} from 'lucide-react';
import BrandHeader from '../components/BrandHeader';

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { jobs, workers, timeEntries, expenses, tasks, invoices, payments, notes, photos, changeOrders, branding,
    updateJob, deleteJob, duplicateJob,
    addTimeEntry, deleteTimeEntry, addExpense, deleteExpense,
    addTask, deleteTask, addInvoice, updateInvoice, deleteInvoice, addPayment, addNote, deleteNote, addPhoto, deletePhoto,
    addChangeOrder, updateChangeOrder, deleteChangeOrder, approveChangeOrder,
    getJobLaborCost, getJobExpenseTotal, getJobChangeOrderTotal, getJobActualCost, getJobProfit, getJobBalance, getJobProgress, updateExpense,
    timeline, jobLogs, punchLists, jobIssues, fileAttachments,
    addTimelineEntry, updateTimelineEntry, deleteTimelineEntry,
    addJobLog, updateJobLog, deleteJobLog,
    addPunchListItem, updatePunchListItem, deletePunchListItem,
    addJobIssue, updateJobIssue, deleteJobIssue,
    addFileAttachment, updateFileAttachment, deleteFileAttachment,
    allowances, materialOrders, shoppingLists, addAllowance, deleteAllowance, addAllowanceSelection, updateAllowanceSelection, createAllowanceOverageChangeOrder,
  } = useApp();
  const { showToast } = useToast();
  
  const job = jobs.find(j => j.id === id);
  const [activeTab, setActiveTab] = useState('overview');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null);
  const [printPreview, setPrintPreview] = useState<{ section: string; open: boolean }>({ section: '', open: false });

  const [timeEntryForm, setTimeEntryForm] = useState({ workerId: '', date: new Date().toISOString().split('T')[0], startTime: '07:00', endTime: '16:00', notes: '' });
  const [expenseForm, setExpenseForm] = useState({ date: new Date().toISOString().split('T')[0], vendor: '', amount: '', category: 'materials', paymentSource: 'company_card', notes: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '', priority: 'medium' as const, status: 'open' as const });
  const [invoiceForm, setInvoiceForm] = useState({ invoiceNumber: '', amount: '', type: 'deposit', dueDate: '', status: 'draft', notes: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], method: 'check', checkNumber: '', notes: '' });
  const [noteForm, setNoteForm] = useState('');
  const [photoForm, setPhotoForm] = useState({ url: '', description: '', category: 'progress' as string });
  const [changeOrderForm, setChangeOrderForm] = useState({ description: '', amount: '', status: 'pending' as const });
  const [allowanceForm, setAllowanceForm] = useState({ name: '', category: 'materials' as AllowanceCategory, amount: '', notes: '', clientResponsible: true });
  const [selectionForm, setSelectionForm] = useState({ allowanceId: '', itemName: '', vendor: '', quantity: '1', unitCost: '', total: '', date: new Date().toISOString().split('T')[0], receiptAttachment: '', notes: '', status: 'selected' as AllowanceSelectionStatus, reimbursable: false });
  
  // Field operations forms
  const [timelineForm, setTimelineForm] = useState({ type: 'note' as const, title: '', description: '' });
  const [jobLogForm, setJobLogForm] = useState({ date: new Date().toISOString().split('T')[0], workCompleted: '', workers: '', issues: '', notes: '', hoursWorked: '0' });
  const [punchListForm, setPunchListForm] = useState({ description: '', status: 'open' as PunchListStatus });
  const [issueForm, setIssueForm] = useState({ title: '', description: '', severity: 'medium' as IssueSeverity, status: 'open' as IssueStatus, estimatedCost: '', estimatedHours: '' });
  const [fileForm, setFileForm] = useState({ name: '', url: '', type: '', size: 0, category: '' });

  const issueSeverityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];
  
  const [showModal, setShowModal] = useState<string | null>(null);
  const [showGenerateInvoice, setShowGenerateInvoice] = useState(false);
  const [generateInvoiceOptions, setGenerateInvoiceOptions] = useState({ amount: '', type: 'deposit', adjustFinalPrice: false });
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<string | null>(null);
  const [receiptForm, setReceiptForm] = useState({ url: '', vendor: '', amount: '', notes: '' });
  const [emailForm, setEmailForm] = useState({ email: '', subject: '', body: '' });
  const [pendingEmailAction, setPendingEmailAction] = useState<(() => void) | null>(null);
  const [photoCategory, setPhotoCategory] = useState<'before' | 'after' | 'progress' | 'issue' | 'other'>('progress');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoDescription, setPhotoDescription] = useState('');

  const handlePrint = () => window.print();

  const handleEmailWithFallback = (subject: string, body: string, existingEmail?: string) => {
    if (existingEmail) {
      window.location.href = `mailto:${existingEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
      setEmailForm({ email: '', subject, body });
      setShowModal('email');
    }
  };
  
  // Add timeline entry
  const handleAddTimelineEntry = () => {
    if (!timelineForm.title) { showToast('Enter a title', 'error'); return; }
    addTimelineEntry({ jobId: job.id, type: timelineForm.type, title: timelineForm.title, description: timelineForm.description, timestamp: new Date().toISOString() });
    showToast('Timeline entry added');
    setTimelineForm({ type: 'note', title: '', description: '' });
    setShowModal(null);
  };

  // Add daily log
  const handleAddJobLog = () => {
    if (!jobLogForm.workCompleted) { showToast('Enter work completed', 'error'); return; }
    addJobLog({ jobId: job.id, date: jobLogForm.date, workCompleted: jobLogForm.workCompleted, workers: jobLogForm.workers.split(',').map(w => w.trim()).filter(Boolean), issues: jobLogForm.issues, notes: jobLogForm.notes, hoursWorked: parseFloat(jobLogForm.hoursWorked) || 0 });
    showToast('Daily log added');
    setJobLogForm({ date: new Date().toISOString().split('T')[0], workCompleted: '', workers: '', issues: '', notes: '', hoursWorked: '0' });
    setShowModal(null);
  };

  // Add punch list item
  const handleAddPunchListItem = () => {
    if (!punchListForm.description) { showToast('Enter description', 'error'); return; }
    addPunchListItem({ jobId: job.id, description: punchListForm.description, status: punchListForm.status });
    showToast('Punch list item added');
    setPunchListForm({ description: '', status: 'open' });
    setShowModal(null);
  };

  // Update punch list item
  const handleUpdatePunchListItem = (itemId: string, status: PunchListItem['status']) => {
    updatePunchListItem(itemId, { status, completedAt: status === 'done' ? new Date().toISOString() : undefined });
  };

  // Add issue
  const handleAddIssue = () => {
    if (!issueForm.title) { showToast('Enter issue title', 'error'); return; }
    addJobIssue({ jobId: job.id, title: issueForm.title, description: issueForm.description, severity: issueForm.severity, status: issueForm.status, estimatedCost: issueForm.estimatedCost ? parseFloat(issueForm.estimatedCost) : undefined, estimatedHours: issueForm.estimatedHours || undefined });
    showToast('Issue logged');
    setIssueForm({ title: '', description: '', severity: 'medium', status: 'open', estimatedCost: '', estimatedHours: '' });
    setShowModal(null);
  };

  // Update issue
  const handleUpdateIssue = (issueId: string, updates: Partial<JobIssue>) => {
    updateJobIssue(issueId, updates);
  };

  const jobTimeEntries = useMemo(() => timeEntries.filter(t => t.jobId === id), [timeEntries, id]);
  const jobExpenses = useMemo(() => expenses.filter(e => e.jobId === id), [expenses, id]);
  const jobTasks = useMemo(() => tasks.filter(t => t.jobId === id), [tasks, id]);
  const jobInvoices = useMemo(() => invoices.filter(i => i.jobId === id), [invoices, id]);
  const jobNotes = useMemo(() => notes.filter(n => n.jobId === id), [notes, id]);
  const jobPhotos = useMemo(() => photos.filter(p => p.jobId === id), [photos, id]);
  const jobChangeOrders = useMemo(() => changeOrders.filter(co => co.jobId === id), [changeOrders, id]);
  const jobTimeline = useMemo(() => (timeline || []).filter(t => t.jobId === id), [timeline, id]);
  const jobLogEntries = useMemo(() => (jobLogs || []).filter(l => l.jobId === id), [jobLogs, id]);
  const jobPunchList = useMemo(() => (punchLists || []).filter(p => p.jobId === id), [punchLists, id]);
  const jobIssueEntries = useMemo(() => (jobIssues || []).filter(i => i.jobId === id), [jobIssues, id]);
  const jobAttachments = useMemo(() => (fileAttachments || []).filter(f => f.jobId === id), [fileAttachments, id]);
  const jobAllowances = useMemo(() => (allowances || []).filter(a => a.jobId === id), [allowances, id]);
  const jobMaterialOrders = useMemo(() => (materialOrders || []).filter(o => o.jobId === id), [materialOrders, id]);
  const jobShoppingLists = useMemo(() => (shoppingLists || []).filter(l => l.jobId === id), [shoppingLists, id]);

  const profit = useMemo(() => getJobProfit(id!), [id, job, getJobProfit]);
  const balance = useMemo(() => getJobBalance(id!), [id, jobInvoices, payments]);
  const progress = useMemo(() => getJobProgress(id!), [id, jobTasks]);
  const insights = useMemo(() => job ? getJobInsights(job, jobExpenses, jobTimeEntries) : [], [job, jobExpenses, jobTimeEntries]);

  if (!job) {
    return (
      <div>
        <div className="page-header">
          <Link to="/jobs" className="btn btn-secondary"><ArrowLeft size={18} /> Back</Link>
        </div>
        <div className="page-content">
          <div className="empty-state">
            <h3>Job not found</h3>
            <p>The requested job could not be found.</p>
          </div>
        </div>
      </div>
    );
  }

  const totalLaborCost = getJobLaborCost(job.id);
  const totalExpenses = getJobExpenseTotal(job.id);
  const changeOrderTotal = getJobChangeOrderTotal(job.id);
  const actualCost = getJobActualCost(job.id);
  const budgetUsage = job.contractAmount > 0 ? (actualCost / job.contractAmount) * 100 : 0;

  const handleAddTimeEntry = () => {
    if (!timeEntryForm.workerId) { showToast('Select a worker', 'error'); return; }
    const [startH, startM] = timeEntryForm.startTime.split(':').map(Number);
    const [endH, endM] = timeEntryForm.endTime.split(':').map(Number);
    const hours = (endH + endM / 60) - (startH + startM / 60);
    if (hours <= 0) { showToast('End time must be after start', 'error'); return; }
    addTimeEntry({ jobId: job.id, workerId: timeEntryForm.workerId, date: timeEntryForm.date, startTime: timeEntryForm.startTime, endTime: timeEntryForm.endTime, totalHours: hours, overtime: hours > 8, notes: timeEntryForm.notes });
    showToast('Time entry added');
    setShowModal(null);
    setTimeEntryForm({ workerId: '', date: new Date().toISOString().split('T')[0], startTime: '07:00', endTime: '16:00', notes: '' });
  };

  const handleAddExpense = () => {
    if (!expenseForm.vendor || !expenseForm.amount) { showToast('Fill required fields', 'error'); return; }
    addExpense({ jobId: job.id, date: expenseForm.date, vendor: expenseForm.vendor, amount: parseFloat(expenseForm.amount), category: expenseForm.category as any, paymentSource: expenseForm.paymentSource as any, notes: expenseForm.notes });
    showToast('Expense added');
    setShowModal(null);
    setExpenseForm({ date: new Date().toISOString().split('T')[0], vendor: '', amount: '', category: 'materials', paymentSource: 'company_card', notes: '' });
  };

  const handleCaptureReceipt = () => {
    if (!receiptForm.url) { showToast('Enter receipt URL', 'error'); return; }
    if (selectedExpense) {
      updateExpense(selectedExpense, { receipt: receiptForm.url });
      showToast('Receipt attached');
    } else {
      addExpense({ 
        jobId: job.id, 
        date: new Date().toISOString().split('T')[0], 
        vendor: receiptForm.vendor || 'Receipt', 
        amount: parseFloat(receiptForm.amount) || 0, 
        category: 'materials', 
        paymentSource: 'company_card', 
        notes: receiptForm.notes,
        receipt: receiptForm.url 
      });
      showToast('Receipt captured');
    }
    setShowModal(null);
    setReceiptForm({ url: '', vendor: '', amount: '', notes: '' });
    setSelectedExpense(null);
  };

  const handleSendEmail = () => {
    if (!emailForm.email) { showToast('Enter email address', 'error'); return; }
    window.location.href = `mailto:${emailForm.email}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(emailForm.body)}`;
    setShowModal(null);
    setEmailForm({ email: '', subject: '', body: '' });
  };

  const handleAddTask = () => {
    if (!taskForm.title) { showToast('Enter task title', 'error'); return; }
    addTask({ ...taskForm, jobId: job.id, dueDate: taskForm.dueDate || undefined });
    showToast('Task added');
    setShowModal(null);
    setTaskForm({ title: '', description: '', dueDate: '', priority: 'medium', status: 'open' });
  };

  const handleAddInvoice = () => {
    if (!invoiceForm.amount) { showToast('Enter amount', 'error'); return; }
    const invNum = invoiceForm.invoiceNumber || `INV-${String(invoices.length + 1).padStart(3, '0')}`;
    addInvoice({ jobId: job.id, invoiceNumber: invNum, amount: parseFloat(invoiceForm.amount), type: invoiceForm.type as any, dueDate: invoiceForm.dueDate, status: invoiceForm.status as any, notes: invoiceForm.notes });
    showToast('Invoice created');
    setShowModal(null);
    setInvoiceForm({ invoiceNumber: '', amount: '', type: 'deposit', dueDate: '', status: 'draft', notes: '' });
  };

  const handleAddPayment = () => {
    if (!paymentForm.amount || !selectedInvoice) { showToast('Enter amount', 'error'); return; }
    addPayment({ invoiceId: selectedInvoice, amount: parseFloat(paymentForm.amount), date: paymentForm.date, method: paymentForm.method as any, checkNumber: paymentForm.checkNumber, notes: paymentForm.notes });
    showToast('Payment recorded');
    setShowModal(null);
    setSelectedInvoice(null);
    setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], method: 'check', checkNumber: '', notes: '' });
  };

  const handleAddNote = () => {
    if (!noteForm.trim()) { showToast('Enter note text', 'error'); return; }
    addNote({ jobId: job.id, content: noteForm });
    showToast('Note added');
    setNoteForm('');
  };

  const handleAddPhoto = () => {
    if (!photoForm.url) { showToast('Enter photo URL', 'error'); return; }
    addPhoto({ jobId: job.id, url: photoForm.url, description: photoForm.description, category: photoForm.category as any });
    showToast('Photo added');
    setShowModal(null);
    setPhotoForm({ url: '', description: '', category: 'progress' });
  };

  const handleAddChangeOrder = () => {
    if (!changeOrderForm.description || !changeOrderForm.amount) { showToast('Fill required fields', 'error'); return; }
    addChangeOrder({ jobId: job.id, description: changeOrderForm.description, amount: parseFloat(changeOrderForm.amount), status: changeOrderForm.status as any });
    showToast('Change order created');
    setShowModal(null);
    setChangeOrderForm({ description: '', amount: '', status: 'pending' });
  };

  const handleAddAllowance = () => {
    if (!allowanceForm.name || !allowanceForm.amount) { showToast('Allowance name and amount required', 'error'); return; }
    addAllowance({ jobId: job.id, name: allowanceForm.name, category: allowanceForm.category, allowanceAmount: parseFloat(allowanceForm.amount), clientResponsible: allowanceForm.clientResponsible, affectsContractorCost: false, notes: allowanceForm.notes });
    setAllowanceForm({ name: '', category: 'materials', amount: '', notes: '', clientResponsible: true });
    setShowModal(null);
    showToast('Allowance added outside contractor cost math');
  };

  const handleAddAllowanceSelection = () => {
    if (!selectionForm.allowanceId || !selectionForm.itemName || !selectionForm.total) { showToast('Selection and total required', 'error'); return; }
    addAllowanceSelection(selectionForm.allowanceId, {
      itemName: selectionForm.itemName,
      vendor: selectionForm.vendor || undefined,
      quantity: parseFloat(selectionForm.quantity) || undefined,
      unitCost: selectionForm.unitCost ? parseFloat(selectionForm.unitCost) : undefined,
      total: parseFloat(selectionForm.total) || 0,
      date: selectionForm.date,
      receiptAttachment: selectionForm.receiptAttachment || undefined,
      notes: selectionForm.notes,
      status: selectionForm.status,
    }, selectionForm.reimbursable);
    setSelectionForm({ allowanceId: '', itemName: '', vendor: '', quantity: '1', unitCost: '', total: '', date: new Date().toISOString().split('T')[0], receiptAttachment: '', notes: '', status: 'selected', reimbursable: false });
    setShowModal(null);
    showToast(selectionForm.reimbursable ? 'Selection tracked and reimbursable expense added' : 'Selection tracked against allowance');
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    switch (deleteConfirm.type) {
      case 'timeEntry': deleteTimeEntry(deleteConfirm.id); showToast('Time entry deleted'); break;
      case 'expense': deleteExpense(deleteConfirm.id); showToast('Expense deleted'); break;
      case 'task': deleteTask(deleteConfirm.id); showToast('Task deleted'); break;
      case 'invoice': deleteInvoice(deleteConfirm.id); showToast('Invoice deleted'); break;
      case 'note': deleteNote(deleteConfirm.id); showToast('Note deleted'); break;
      case 'photo': deleteNote(deleteConfirm.id); showToast('Photo deleted'); break;
      case 'changeOrder': deleteChangeOrder(deleteConfirm.id); showToast('Change order deleted'); break;
    }
    setDeleteConfirm(null);
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      lead: 'badge-gray', estimate_sent: 'badge-blue', approved: 'badge-purple', scheduled: 'badge-indigo',
      active: 'badge-green', awaiting_materials: 'badge-yellow', awaiting_payment: 'badge-orange',
      completed: 'badge-emerald', closed: 'badge-slate', pending: 'badge-yellow', rejected: 'badge-red',
      open: 'badge-blue', in_progress: 'badge-yellow', blocked: 'badge-red', done: 'badge-green',
      draft: 'badge-gray', sent: 'badge-blue', paid: 'badge-green', partial: 'badge-yellow', overdue: 'badge-red',
    };
    return map[status] || 'badge-gray';
  };

  const getBudgetColor = () => {
    if (budgetUsage > 100) return 'bg-red-500';
    if (budgetUsage > 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Activity size={14} />, count: null },
    { id: 'timeline', label: 'Timeline', icon: <Clock size={14} />, count: null },
    { id: 'dailylog', label: 'Daily Log', icon: <Clipboard size={14} />, count: null },
    { id: 'punchlist', label: 'Punch List', icon: <ListChecks size={14} />, count: null },
    { id: 'issues', label: 'Issues', icon: <AlertTriangle size={14} />, count: null },
    { id: 'schedule', label: 'Schedule', icon: <Calendar size={14} />, count: null },
    { id: 'workers', label: 'Team', icon: <Users size={14} />, count: jobTimeEntries.length > 0 ? [...new Set(jobTimeEntries.map(t => t.workerId))].length : 0 },
    { id: 'time', label: 'Time', icon: <Clock size={14} />, count: jobTimeEntries.length },
    { id: 'expenses', label: 'Expenses', icon: <Receipt size={14} />, count: jobExpenses.length },
    { id: 'allowances', label: 'Allowances', icon: <DollarSign size={14} />, count: jobAllowances.length },
    { id: 'orders', label: 'Orders', icon: <ShoppingCart size={14} />, count: jobMaterialOrders.length },
    { id: 'shopping', label: 'Shopping', icon: <ShoppingCart size={14} />, count: jobShoppingLists.length },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={14} />, count: jobTasks.length },
    { id: 'invoices', label: 'Invoices', icon: <FileText size={14} />, count: jobInvoices.length },
    { id: 'changeorders', label: 'Changes', icon: <Edit size={14} />, count: jobChangeOrders.length },
    { id: 'photos', label: 'Photos', icon: <Camera size={14} />, count: jobPhotos.length },
    { id: 'files', label: 'Files', icon: <Paperclip size={14} />, count: null },
    { id: 'notes', label: 'Notes', icon: <MessageSquare size={14} />, count: jobNotes.length },
  ];

  return (
    <div>
      <div className="page-header">
        <Link to="/jobs" className="btn btn-secondary"><ArrowLeft size={18} /> Back</Link>
        <div className="page-actions">
          <Link className="btn btn-secondary" to={`/shopping-lists?jobId=${job.id}`}>
            <ShoppingCart size={18} /> View Job Shopping Lists
          </Link>
          <button className="btn btn-secondary" onClick={() => duplicateJob(job.id)} title="Duplicate Job">
            <Copy size={18} /> Duplicate
          </button>
          <button className="btn btn-danger" onClick={() => setDeleteConfirm({ type: 'job', id: job.id })}>Delete</button>
        </div>
      </div>

      <div className="page-content">
        <div className="job-header">
          <div className="job-info">
            <h1 className="job-title">{job.name}</h1>
            <div className="job-address flex items-center gap-2">
              <MapPin size={16} /> {job.address}
            </div>
            <div className="job-customer mt-2">{job.customer} {job.customerPhone && <span className="text-muted"> • {job.customerPhone}</span>}</div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <select className={`form-select badge-lg ${getStatusColor(job.status)}`} value={job.status} onChange={(e) => updateJob(job.id, { status: e.target.value as any })}>
              <option value="lead">Lead</option>
              <option value="estimate_sent">Estimate Sent</option>
              <option value="approved">Approved</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="awaiting_materials">Awaiting Materials</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
            <span className="text-sm text-muted">{job.type.replace('_', ' ')}</span>
          </div>
        </div>

        <div className="grid-4 gap-4 mb-6">
          <div className="card">
            <div className="text-xs text-muted uppercase">Contract</div>
            <div className="text-2xl font-bold">{formatCurrency(job.contractAmount)}</div>
          </div>
          <div className="card">
            <div className="text-xs text-muted uppercase">Actual Cost</div>
            <div className="text-2xl font-bold">{formatCurrency(actualCost)}</div>
            <div className="text-xs text-muted">{formatCurrency(totalLaborCost + totalExpenses)} + {formatCurrency(changeOrderTotal)}</div>
          </div>
          <div className="card">
            <div className="text-xs text-muted uppercase">Profit</div>
            <div className={`text-2xl font-bold ${profit.profit >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatCurrency(profit.profit)} ({profit.margin.toFixed(0)}%)
            </div>
          </div>
          <div className="card">
            <div className="text-xs text-muted uppercase">Balance Due</div>
            <div className="text-2xl font-bold">{formatCurrency(balance)}</div>
          </div>
        </div>

        <div className="card mb-6">
          <div className="card-body">
            <div className="text-xs text-muted mb-2">Budget Usage: {Math.round(budgetUsage)}%</div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className={`h-3 rounded-full transition-all ${getBudgetColor()}`} style={{ width: `${Math.min(budgetUsage, 100)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>$0</span>
              <span>{formatCurrency(job.contractAmount)}</span>
            </div>
          </div>
        </div>

        {insights.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {insights.map(insight => (
              <div key={insight.id} className={`flex-shrink-0 px-3 py-2 rounded-lg border ${getStatusColor(insight.severity).replace('badge-', 'border-').replace('bg-', 'bg-white ')}`}>
                <div className="text-sm font-medium">{insight.title}</div>
                <div className="text-xs text-muted">{insight.description}</div>
              </div>
            ))}
          </div>
        )}

        <div className="tabs mb-4">
          <select 
            className="form-select" 
            value={activeTab} 
            onChange={(e) => setActiveTab(e.target.value)}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            {tabs.map(tab => (
              <option key={tab.id} value={tab.id}>
                {tab.label}{tab.count !== null ? ` (${tab.count})` : ''}
              </option>
            ))}
          </select>
        </div>

        {activeTab === 'overview' && (
          <div className="grid-2 gap-6">
            <div className="card">
              <div className="card-header"><h3 className="card-title">Quick Stats</h3></div>
              <div className="card-body">
                <div className="stats-row">
                  <div className="stat-item"><div className="stat-label">Contract</div><div className="stat-value">{formatCurrency(job.contractAmount)}</div></div>
                  <div className="stat-item"><div className="stat-label">Est. Cost</div><div className="stat-value">{formatCurrency(job.estimatedCost)}</div></div>
                  <div className="stat-item"><div className="stat-label">Actual</div><div className="stat-value">{formatCurrency(actualCost)}</div></div>
                </div>
                <div className="mt-4 grid-2 gap-4">
                  <div><span className="text-muted">Start:</span> {formatDate(job.startDate)}</div>
                  <div><span className="text-muted">Due:</span> {formatDate(job.dueDate)}</div>
                  <div><span className="text-muted">Progress:</span> {progress}%</div>
                  <div><span className="text-muted">Change Orders:</span> {formatCurrency(changeOrderTotal)}</div>
                  <div><span className="text-muted">Orders:</span> {jobMaterialOrders.length}</div>
                  <div><span className="text-muted">Shopping Lists:</span> {jobShoppingLists.length}</div>
                </div>
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-secondary">{job.notes || 'No notes'}</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="card-title">Quick Actions</h3></div>
              <div className="card-body space-y-2">
                <button className="btn btn-primary w-full" onClick={() => duplicateJob(job.id)}><Copy size={16} /> Duplicate Job</button>
                <button className="btn btn-primary w-full" onClick={() => {
                  setGenerateInvoiceOptions({ amount: String(job.contractAmount - balance), type: 'deposit', adjustFinalPrice: false });
                  setShowGenerateInvoice(true);
                }}><FileText size={16} /> Generate Invoice</button>
                <Link className="btn btn-secondary w-full" to={`/shopping-lists?jobId=${job.id}`}><ShoppingCart size={16} /> Create Shopping List</Link>
                <Link className="btn btn-secondary w-full" to={`/shopping-lists?jobId=${job.id}`}><Plus size={16} /> Add to Shopping List</Link>
                <button className="btn btn-secondary w-full" onClick={() => setShowModal('time')}>+ Add Time Entry</button>
                <button className="btn btn-secondary w-full" onClick={() => setShowModal('expense')}>+ Add Expense</button>
                <button className="btn btn-secondary w-full" onClick={() => setShowModal('task')}>+ Add Task</button>
                <button className="btn btn-secondary w-full" onClick={() => setShowModal('changeorder')}>+ Change Order</button>
                <button className="btn btn-secondary w-full" onClick={() => setShowModal('photo')}>+ Add Photo</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'time' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Time Entries ({jobTimeEntries.length})</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowModal('time')}>+ Add</button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Date</th><th>Worker</th><th>Hours</th><th>Cost</th><th>Notes</th><th></th></tr></thead>
                <tbody>
                  {jobTimeEntries.length === 0 ? <tr><td colSpan={6} className="text-center text-muted">No entries</td></tr> : jobTimeEntries.map(entry => {
                    const worker = workers.find(w => w.id === entry.workerId);
                    return (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.date)}</td>
                        <td>{worker?.name}</td>
                        <td>{entry.totalHours.toFixed(1)}h {entry.overtime && <span className="badge badge-red">OT</span>}</td>
                        <td>{formatCurrency(entry.laborCost)}</td>
                        <td className="truncate" style={{maxWidth: '150px'}}>{entry.notes}</td>
                        <td><button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteConfirm({ type: 'timeEntry', id: entry.id })}><Trash2 size={14} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'allowances' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Client Allowances ({jobAllowances.length})</h3>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-secondary" onClick={() => setShowModal('allowanceSelection')}>+ Add Selection</button>
                <button className="btn btn-sm btn-primary" onClick={() => setShowModal('allowance')}>+ Add Allowance</button>
              </div>
            </div>
            <div className="card-body">
              <div className="allowance-card-grid">
                {jobAllowances.length === 0 ? <div className="text-muted">No allowances yet. Add client-funded budgets without changing contractor profit math.</div> : jobAllowances.map(allowance => {
                  const percent = allowance.allowanceAmount > 0 ? Math.min(100, (allowance.usedAmount / allowance.allowanceAmount) * 100) : 0;
                  return (
                    <div className="allowance-card" key={allowance.id}>
                      <div>
                        <strong>{allowance.name}</strong>
                        <span>{allowance.category} - {allowance.clientResponsible ? 'Client Allowance' : 'Contractor Managed'}</span>
                      </div>
                      <b>{formatCurrency(allowance.allowanceAmount)}</b>
                      <small>Used {formatCurrency(allowance.usedAmount)} - Remaining {formatCurrency(allowance.remainingAmount)}</small>
                      <div className="allowance-progress"><span style={{ width: `${percent}%` }} /></div>
                      <em>{allowance.affectsContractorCost ? 'Reimbursable contractor cost only when selected' : 'Does not affect contractor cost, profit, or margin.'}</em>
                      {allowance.status !== 'under' && <div className={`allowance-status ${allowance.status}`}>{allowance.status === 'over_limit' ? `Over by ${formatCurrency(Math.abs(allowance.remainingAmount))}` : '80% used'}</div>}
                      {allowance.remainingAmount < 0 && <button className="btn btn-sm btn-primary" onClick={() => createAllowanceOverageChangeOrder(allowance.id)}>Create Change Order for Overage</button>}
                      <div className="allowance-selections">
                        {allowance.selections.map(selection => (
                          <div key={selection.id}>
                            <span>{selection.itemName} - {formatCurrency(selection.total)}</span>
                            <select className="form-select" value={selection.status} onChange={e => updateAllowanceSelection(allowance.id, selection.id, { status: e.target.value as AllowanceSelectionStatus })}>
                              <option value="planned">Planned</option><option value="selected">Selected</option><option value="purchased">Purchased</option><option value="installed">Installed</option>
                            </select>
                          </div>
                        ))}
                      </div>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteAllowance(allowance.id)}>Delete</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Expenses ({jobExpenses.length})</h3>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-secondary" onClick={handlePrint}>Print</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowModal('capture')}>Capture Receipt</button>
                <button className="btn btn-sm btn-primary" onClick={() => setShowModal('expense')}>+ Add</button>
              </div>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th>Amount</th><th>Receipt</th><th>Notes</th><th></th></tr></thead>
                <tbody>
                  {jobExpenses.length === 0 ? <tr><td colSpan={7} className="text-center text-muted">No expenses</td></tr> : jobExpenses.map(exp => (
                    <tr key={exp.id}>
                      <td>{formatDate(exp.date)}</td>
                      <td>{exp.vendor}</td>
                      <td><span className="badge badge-gray">{exp.category}</span></td>
                      <td>{formatCurrency(exp.amount)}</td>
                      <td>
                        {exp.receipt ? (
                          <a href={exp.receipt} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary btn-icon">
                            <Camera size={14} />
                          </a>
                        ) : (
                          <button className="btn btn-sm btn-ghost btn-icon" onClick={() => { setSelectedExpense(exp.id); setShowModal('capture'); }}>
                            <Camera size={14} />
                          </button>
                        )}
                      </td>
                      <td className="truncate" style={{maxWidth: '150px'}}>{exp.notes}</td>
                      <td><button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteConfirm({ type: 'expense', id: exp.id })}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Material Orders ({jobMaterialOrders.length})</h3>
              <Link className="btn btn-sm btn-primary" to="/estimates/orders">Open Orders</Link>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>PO #</th><th>Supplier</th><th>Status</th><th>Items</th><th>Total</th><th>Expected</th></tr></thead>
                <tbody>
                  {jobMaterialOrders.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-muted">No material orders linked to this job</td></tr>
                  ) : jobMaterialOrders.map(order => (
                    <tr key={order.id}>
                      <td>{order.poNumber}</td>
                      <td>{order.supplierName || 'Unassigned'}</td>
                      <td><span className={`badge ${getStatusColor(order.status)}`}>{order.status.replace('_', ' ')}</span></td>
                      <td>{order.items.length}</td>
                      <td>{formatCurrency(order.total)}</td>
                      <td>{order.expectedDate ? formatDate(order.expectedDate) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'shopping' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Shopping Lists ({jobShoppingLists.length})</h3>
              <Link className="btn btn-sm btn-primary" to={`/shopping-lists?jobId=${job.id}`}>Open Shopping</Link>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>List</th><th>Status</th><th>Supplier</th><th>Items</th><th>Estimated</th><th>Completed</th></tr></thead>
                <tbody>
                  {jobShoppingLists.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-muted">No shopping lists linked to this job</td></tr>
                  ) : jobShoppingLists.map(list => {
                    const estimated = list.items.reduce((sum, item) => sum + (item.actualCost ?? item.estimatedCost ?? 0), 0);
                    const purchased = list.items.filter(item => item.purchased).length;
                    return (
                      <tr key={list.id}>
                        <td>{list.title}</td>
                        <td><span className={`badge ${getStatusColor(list.status)}`}>{list.status}</span></td>
                        <td>{list.supplierName || list.store || 'Unassigned'}</td>
                        <td>{purchased}/{list.items.length}</td>
                        <td>{formatCurrency(estimated)}</td>
                        <td>{list.completedAt ? formatDate(list.completedAt) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Tasks ({jobTasks.length})</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowModal('task')}>+ Add</button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Task</th><th>Due</th><th>Priority</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {jobTasks.length === 0 ? <tr><td colSpan={5} className="text-center text-muted">No tasks</td></tr> : jobTasks.map(task => (
                    <tr key={task.id}>
                      <td>{task.title}</td>
                      <td>{task.dueDate ? formatDate(task.dueDate) : '-'}</td>
                      <td><span className={`badge ${getStatusColor(task.priority)}`}>{task.priority}</span></td>
                      <td><span className={`badge ${getStatusColor(task.status)}`}>{task.status.replace('_', ' ')}</span></td>
                      <td><button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteConfirm({ type: 'task', id: task.id })}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Invoices & Payments</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowModal('invoice')}>+ Invoice</button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Invoice #</th><th>Type</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {jobInvoices.length === 0 ? <tr><td colSpan={7} className="text-center text-muted">No invoices</td></tr> : jobInvoices.map(inv => {
                    const invPayments = payments.filter(p => p.invoiceId === inv.id);
                    const paid = invPayments.reduce((s, p) => s + p.amount, 0);
                    return (
                      <tr key={inv.id}>
                        <td>{inv.invoiceNumber}</td>
                        <td><span className="badge badge-gray">{inv.type}</span></td>
                        <td>{formatCurrency(inv.amount)}</td>
                        <td>{formatCurrency(paid)}</td>
                        <td className="font-medium">{formatCurrency(inv.amount - paid)}</td>
                        <td><span className={`badge ${getStatusColor(inv.status)}`}>{inv.status}</span></td>
                        <td>
                          <div className="flex gap-2">
                            {inv.status !== 'paid' && <button className="btn btn-sm btn-secondary" onClick={() => setShowModal('payment')}>Pay</button>}
                            <button className="btn btn-sm btn-secondary btn-icon" onClick={() => handleEmailWithFallback(
                              `Invoice ${inv.invoiceNumber}: ${job.name}`,
                              `Hi,\n\nPlease find attached Invoice ${inv.invoiceNumber} for ${job.name}.\n\nAmount: ${formatCurrency(inv.amount)}\nDue: ${formatCurrency(inv.amount - paid)}\n\nThank you for your business!\n\nAllen's`,
                              job.customerEmail
                            )} title="Email Invoice"><Send size={14} /></button>
                            <button className="btn btn-sm btn-secondary btn-icon" onClick={handlePrint} title="Print Invoice"><FileText size={14} /></button>
                            <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteConfirm({ type: 'invoice', id: inv.id })}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'changeorders' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Change Orders ({jobChangeOrders.length})</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowModal('changeorder')}>+ Add</button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Description</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {jobChangeOrders.length === 0 ? <tr><td colSpan={4} className="text-center text-muted">No change orders</td></tr> : jobChangeOrders.map(co => (
                    <tr key={co.id}>
                      <td>{co.description}</td>
                      <td>{formatCurrency(co.amount)}</td>
                      <td><span className={`badge ${getStatusColor(co.status)}`}>{co.status}</span></td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-sm btn-secondary btn-icon" onClick={() => handleEmailWithFallback(
                            `Change Order: ${job.name}`,
                            `Hi,\n\nA change order has been submitted for ${job.name}.\n\nDescription: ${co.description}\nAmount: ${formatCurrency(co.amount)}\n\nPlease review and let us know if you have any questions.\n\nThanks,\nAllen's`,
                            job.customerEmail
                          )} title="Email Change Order"><Send size={14} /></button>
                          <button className="btn btn-sm btn-secondary btn-icon" onClick={handlePrint} title="Print"><FileText size={14} /></button>
                          {co.status === 'pending' && (
                            <button className="btn btn-sm btn-primary" onClick={() => approveChangeOrder(co.id)}>Approve</button>
                          )}
                          <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteConfirm({ type: 'changeOrder', id: co.id })}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Photos ({jobPhotos.length})</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowModal('photo')}>+ Add</button>
            </div>
            <div className="card-body">
              {jobPhotos.length === 0 ? (
                <div className="text-center text-muted py-8">No photos yet</div>
              ) : (
                <div className="grid-3 gap-4">
                  {jobPhotos.map(photo => (
                    <div key={photo.id} className="relative rounded-lg overflow-hidden bg-gray-100 aspect-video">
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                        <Camera size={32} />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
                        <div className="text-xs text-white">{photo.category}</div>
                        <div className="text-xs text-gray-300">{photo.description}</div>
                      </div>
                      <button className="absolute top-2 right-2 btn btn-sm btn-danger" onClick={() => setDeleteConfirm({ type: 'photo', id: photo.id })}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            <div className="card mb-4">
              <div className="card-header"><h3 className="card-title">Add Note</h3></div>
              <div className="card-body">
                <textarea className="form-textarea" value={noteForm} onChange={e => setNoteForm(e.target.value)} placeholder="Write a note..." />
                <button className="btn btn-primary mt-2" onClick={handleAddNote} disabled={!noteForm.trim()}>Add Note</button>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="card-title">Notes ({jobNotes.length})</h3></div>
              <div className="card-body">
                {jobNotes.length === 0 ? <p className="text-muted text-center">No notes yet</p> : jobNotes.map(note => (
                  <div key={note.id} className="list-item">
                    <div className="list-item-content">
                      <div className="list-item-title">{note.content}</div>
                      <div className="list-item-subtitle">{formatDate(note.createdAt)}</div>
                    </div>
                    <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteConfirm({ type: 'note', id: note.id })}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Schedule</h3></div>
            <div className="card-body">
              <div className="grid-2 gap-4">
                <div><span className="text-muted">Start Date:</span> {formatDate(job.startDate)}</div>
                <div><span className="text-muted">Due Date:</span> {formatDate(job.dueDate)}</div>
              </div>
              <h4 className="font-medium mt-6 mb-4">Task Schedule</h4>
              <div className="space-y-2">
                {jobTasks.map((task, i) => (
                  <div key={task.id} className={`flex items-center justify-between p-3 rounded-lg ${task.status === 'done' ? 'bg-green-50' : task.dueDate && new Date(task.dueDate) < new Date() ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-muted">{i + 1}.</span>
                      <span className={task.status === 'done' ? 'line-through' : ''}>{task.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.dueDate && <span className="text-sm text-muted">{formatDate(task.dueDate)}</span>}
                      <span className={`badge ${getStatusColor(task.status)}`}>{task.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workers' && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Team ({[...new Set(jobTimeEntries.map(t => t.workerId))].length} workers)</h3></div>
            <div className="card-body">
              <div className="space-y-2">
                {[...new Set(jobTimeEntries.map(t => t.workerId))].map(workerId => {
                  const worker = workers.find(w => w.id === workerId);
                  const workerEntries = jobTimeEntries.filter(t => t.workerId === workerId);
                  const hours = workerEntries.reduce((s, t) => s + t.totalHours, 0);
                  const cost = workerEntries.reduce((s, t) => s + t.laborCost, 0);
                  return (
                    <div key={workerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{worker?.name}</div>
                        <div className="text-sm text-muted">{worker?.trade}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{hours.toFixed(1)}h</div>
                        <div className="text-sm text-muted">{formatCurrency(cost)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Activity Timeline</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowModal('timeline')}>+ Add Entry</button>
            </div>
            <div className="card-body">
              {timeline.length === 0 ? (
                <div className="text-center text-muted py-8">No timeline entries yet</div>
              ) : (
                <div className="space-y-3">
                  {jobTimeline.map(entry => (
                    <div key={entry.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        {entry.type === 'photo' ? <Camera size={14} /> : entry.type === 'payment' ? <Receipt size={14} /> : entry.type === 'change_order' ? <Edit size={14} /> : <Clock size={14} />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{entry.title}</div>
                        <div className="text-sm text-muted">{entry.description}</div>
                        <div className="text-xs text-muted mt-1">{formatTime(entry.timestamp)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'dailylog' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Daily Logs</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowModal('dailylog')}>+ Add Log</button>
            </div>
            <div className="card-body">
              {jobLogEntries.length === 0 ? (
                <div className="text-center text-muted py-8">No daily logs yet</div>
              ) : (
                <div className="space-y-4">
                  {jobLogEntries.map(log => (
                    <div key={log.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{formatDate(log.date)}</div>
                        <div className="badge badge-blue">{log.hoursWorked}h</div>
                      </div>
                      <div className="mb-2"><span className="text-muted">Work:</span> {log.workCompleted}</div>
                      {log.workers.length > 0 && <div className="text-sm text-muted mb-1"><span className="text-muted">Workers:</span> {log.workers.join(', ')}</div>}
                      {log.issues && <div className="text-sm text-red-600 mb-1"><span className="text-muted">Issues:</span> {log.issues}</div>}
                      {log.notes && <div className="text-sm text-muted"><span className="text-muted">Notes:</span> {log.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'punchlist' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Punch List ({jobPunchList.length})</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowModal('punchlist')}>+ Add Item</button>
            </div>
            <div className="card-body">
              {jobPunchList.length === 0 ? (
                <div className="text-center text-muted py-8">No punch list items yet</div>
              ) : (
                <div className="space-y-2">
                  {jobPunchList.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <button className={`btn btn-sm btn-icon ${item.status === 'done' ? 'btn-success' : 'btn-secondary'}`} onClick={() => handleUpdatePunchListItem(item.id, item.status === 'done' ? 'open' : 'done')}>
                          {item.status === 'done' ? <CheckCircle size={16} /> : <CheckSquare size={16} />}
                        </button>
                        <span className={item.status === 'done' ? 'line-through text-muted' : ''}>{item.description}</span>
                      </div>
                      <span className={`badge ${getStatusColor(item.status)}`}>{item.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Issues ({jobIssueEntries.length})</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowModal('issue')}>+ Log Issue</button>
            </div>
            <div className="card-body">
              {jobIssueEntries.length === 0 ? (
                <div className="text-center text-muted py-8">No issues logged</div>
              ) : (
                <div className="space-y-3">
                  {jobIssueEntries.map(issue => (
                    <div key={issue.id} className={`p-4 border rounded-lg border-l-4 ${issue.severity === 'critical' ? 'border-l-red-500' : issue.severity === 'high' ? 'border-l-orange-500' : 'border-l-yellow-500'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium">{issue.title}</div>
                        <div className="flex gap-2">
                          <select className="form-select form-select-sm" value={issue.status} onChange={(e) => handleUpdateIssue(issue.id, { status: e.target.value as any })}>
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>
                      </div>
                      <div className="text-sm text-muted mb-2">{issue.description}</div>
                      <div className="flex gap-4 text-sm">
                        <span className={`badge ${getStatusColor(issue.severity)}`}>{issue.severity}</span>
                        <span className={`badge ${getStatusColor(issue.status)}`}>{issue.status}</span>
                        {issue.estimatedCost && <span className="text-muted">Est: {formatCurrency(issue.estimatedCost)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">File Attachments ({jobAttachments.length})</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowModal('file')}>+ Add File</button>
            </div>
            <div className="card-body">
              {jobAttachments.length === 0 ? (
                <div className="text-center text-muted py-8">No files attached</div>
              ) : (
                <div className="grid-3 gap-3">
                  {jobAttachments.map(file => (
                    <div key={file.id} className="p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                      <div className="flex-shrink-0"><File size={20} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{file.name}</div>
                        <div className="text-xs text-muted">{file.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Before & After Photos ({jobPhotos.length})</h3>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-secondary" onClick={() => { setPhotoCategory('before'); setShowModal('photo'); }}>+ Before</button>
                <button className="btn btn-sm btn-secondary" onClick={() => { setPhotoCategory('after'); setShowModal('photo'); }}>+ After</button>
                <button className="btn btn-sm btn-primary" onClick={() => { setPhotoCategory('progress'); setShowModal('photo'); }}>+ Other</button>
              </div>
            </div>
            <div className="card-body">
              {jobPhotos.length === 0 ? (
                <div className="text-center text-muted py-8">No photos yet. Click "Before" or "After" to add photos.</div>
              ) : (
                <div>
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-muted uppercase mb-3">Before Photos</h4>
                    <div className="grid-4 gap-3">
                      {jobPhotos.filter(p => p.category === 'before').map(photo => (
                        <div key={photo.id} className="relative group">
                          <img src={photo.url} alt={photo.description || 'Before'} className="w-full h-32 object-cover rounded-lg" />
                          <button className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100" onClick={() => deletePhoto(photo.id)}>
                            <Trash2 size={14} />
                          </button>
                          {photo.description && <div className="text-xs mt-1 truncate">{photo.description}</div>}
                        </div>
                      ))}
                      {jobPhotos.filter(p => p.category === 'before').length === 0 && <div className="text-sm text-muted">No before photos</div>}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted uppercase mb-3">After Photos</h4>
                    <div className="grid-4 gap-3">
                      {jobPhotos.filter(p => p.category === 'after').map(photo => (
                        <div key={photo.id} className="relative group">
                          <img src={photo.url} alt={photo.description || 'After'} className="w-full h-32 object-cover rounded-lg" />
                          <button className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100" onClick={() => deletePhoto(photo.id)}>
                            <Trash2 size={14} />
                          </button>
                          {photo.description && <div className="text-xs mt-1 truncate">{photo.description}</div>}
                        </div>
                      ))}
                      {jobPhotos.filter(p => p.category === 'after').length === 0 && <div className="text-sm text-muted">No after photos</div>}
                    </div>
                  </div>
                  {jobPhotos.filter(p => !['before', 'after'].includes(p.category)).length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-muted uppercase mb-3">Other Photos</h4>
                      <div className="grid-4 gap-3">
                        {jobPhotos.filter(p => !['before', 'after'].includes(p.category)).map(photo => (
                          <div key={photo.id} className="relative group">
                            <img src={photo.url} alt={photo.description || 'Photo'} className="w-full h-32 object-cover rounded-lg" />
                            <button className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100" onClick={() => deletePhoto(photo.id)}>
                              <Trash2 size={14} />
                            </button>
                            <span className="text-xs badge">{photo.category}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showModal === 'time'} onClose={() => setShowModal(null)} title="Add Time Entry">
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Worker *</label>
            <select className="form-select" value={timeEntryForm.workerId} onChange={e => setTimeEntryForm({...timeEntryForm, workerId: e.target.value})}>
              <option value="">Select worker</option>
              {workers.filter(w => w.status === 'active').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={timeEntryForm.date} onChange={e => setTimeEntryForm({...timeEntryForm, date: e.target.value})} />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Start</label>
            <input className="form-input" type="time" value={timeEntryForm.startTime} onChange={e => setTimeEntryForm({...timeEntryForm, startTime: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">End</label>
            <input className="form-input" type="time" value={timeEntryForm.endTime} onChange={e => setTimeEntryForm({...timeEntryForm, endTime: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={timeEntryForm.notes} onChange={e => setTimeEntryForm({...timeEntryForm, notes: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddTimeEntry}>Add Entry</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'allowance'} onClose={() => setShowModal(null)} title="Add Allowance">
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={allowanceForm.name} onChange={e => setAllowanceForm({ ...allowanceForm, name: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Category</label><select className="form-select" value={allowanceForm.category} onChange={e => setAllowanceForm({ ...allowanceForm, category: e.target.value as AllowanceCategory })}>{['materials','fixtures','cabinets','flooring','lighting','plumbing','appliances','other'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div className="form-group"><label className="form-label">Allowance Amount *</label><input className="form-input" type="number" value={allowanceForm.amount} onChange={e => setAllowanceForm({ ...allowanceForm, amount: e.target.value })} /></div>
        <label className="shopping-toggle"><input type="checkbox" checked={allowanceForm.clientResponsible} onChange={e => setAllowanceForm({ ...allowanceForm, clientResponsible: e.target.checked })} /> Client responsible / does not affect contractor cost</label>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={allowanceForm.notes} onChange={e => setAllowanceForm({ ...allowanceForm, notes: e.target.value })} /></div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}><button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handleAddAllowance}>Add Allowance</button></div>
      </Modal>

      <Modal isOpen={showModal === 'allowanceSelection'} onClose={() => setShowModal(null)} title="Add Allowance Selection">
        <div className="form-group"><label className="form-label">Allowance *</label><select className="form-select" value={selectionForm.allowanceId} onChange={e => setSelectionForm({ ...selectionForm, allowanceId: e.target.value })}><option value="">Select allowance</option>{jobAllowances.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div className="form-row form-row-2"><div className="form-group"><label className="form-label">Item *</label><input className="form-input" value={selectionForm.itemName} onChange={e => setSelectionForm({ ...selectionForm, itemName: e.target.value })} /></div><div className="form-group"><label className="form-label">Vendor</label><input className="form-input" value={selectionForm.vendor} onChange={e => setSelectionForm({ ...selectionForm, vendor: e.target.value })} /></div></div>
        <div className="form-row form-row-3"><div className="form-group"><label className="form-label">Qty</label><input className="form-input" type="number" value={selectionForm.quantity} onChange={e => setSelectionForm({ ...selectionForm, quantity: e.target.value })} /></div><div className="form-group"><label className="form-label">Unit Cost</label><input className="form-input" type="number" value={selectionForm.unitCost} onChange={e => setSelectionForm({ ...selectionForm, unitCost: e.target.value })} /></div><div className="form-group"><label className="form-label">Total *</label><input className="form-input" type="number" value={selectionForm.total} onChange={e => setSelectionForm({ ...selectionForm, total: e.target.value })} /></div></div>
        <div className="form-row form-row-2"><div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={selectionForm.date} onChange={e => setSelectionForm({ ...selectionForm, date: e.target.value })} /></div><div className="form-group"><label className="form-label">Receipt</label><input className="form-input" value={selectionForm.receiptAttachment} onChange={e => setSelectionForm({ ...selectionForm, receiptAttachment: e.target.value })} /></div></div>
        <label className="shopping-toggle"><input type="checkbox" checked={selectionForm.reimbursable} onChange={e => setSelectionForm({ ...selectionForm, reimbursable: e.target.checked })} /> Contractor paid - add as reimbursable expense</label>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={selectionForm.notes} onChange={e => setSelectionForm({ ...selectionForm, notes: e.target.value })} /></div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}><button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handleAddAllowanceSelection}>Add Selection</button></div>
      </Modal>

      <Modal isOpen={showModal === 'expense'} onClose={() => setShowModal(null)} title="Add Expense">
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Vendor *</label>
            <input className="form-input" value={expenseForm.vendor} onChange={e => setExpenseForm({...expenseForm, vendor: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Amount *</label>
            <input className="form-input" type="number" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={expenseForm.notes} onChange={e => setExpenseForm({...expenseForm, notes: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddExpense}>Add Expense</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'task'} onClose={() => setShowModal(null)} title="Add Task">
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={taskForm.dueDate} onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value as any})}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddTask}>Add Task</button>
        </div>
      </Modal>

<Modal isOpen={showModal === 'invoice'} onClose={() => setShowModal(null)} title="Create Invoice">
        {!jobInvoices.length && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">Generate an invoice from your job data, or create a custom invoice.</p>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Invoice Amount *</label>
          <input className="form-input" type="number" value={invoiceForm.amount} onChange={e => setInvoiceForm({...invoiceForm, amount: e.target.value})} placeholder="0.00" />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={invoiceForm.type} onChange={e => setInvoiceForm({...invoiceForm, type: e.target.value})}>
              <option value="deposit">Deposit</option>
              <option value="progress">Progress Payment</option>
              <option value="final">Final Payment</option>
              <option value="change_order">Change Order</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={invoiceForm.dueDate} onChange={e => setInvoiceForm({...invoiceForm, dueDate: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={invoiceForm.notes} onChange={e => setInvoiceForm({...invoiceForm, notes: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddInvoice}>Create Invoice</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'payment'} onClose={() => setShowModal(null)} title="Record Payment">
        <div className="form-group">
          <label className="form-label">Amount *</label>
          <input className="form-input" type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Method</label>
            <select className="form-select" value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}>
              <option value="check">Check</option><option value="cash">Cash</option><option value="ach">ACH</option><option value="card">Card</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Check #</label>
          <input className="form-input" value={paymentForm.checkNumber} onChange={e => setPaymentForm({...paymentForm, checkNumber: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddPayment}>Record Payment</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'changeorder'} onClose={() => setShowModal(null)} title="Create Change Order">
        <div className="form-group">
          <label className="form-label">Description *</label>
          <textarea className="form-textarea" value={changeOrderForm.description} onChange={e => setChangeOrderForm({...changeOrderForm, description: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Amount *</label>
          <input className="form-input" type="number" value={changeOrderForm.amount} onChange={e => setChangeOrderForm({...changeOrderForm, amount: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddChangeOrder}>Create Change Order</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'photo'} onClose={() => setShowModal(null)} title="Add Photo">
        <div className="form-group">
          <label className="form-label">Photo URL *</label>
          <input className="form-input" value={photoForm.url} onChange={e => setPhotoForm({...photoForm, url: e.target.value})} placeholder="https://..." />
          <p className="text-xs text-muted mt-1">Enter a URL or use camera to capture</p>
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-select" value={photoForm.category} onChange={e => setPhotoForm({...photoForm, category: e.target.value as any})}>
            {PHOTO_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <input className="form-input" value={photoForm.description} onChange={e => setPhotoForm({...photoForm, description: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddPhoto}>Add Photo</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'capture'} onClose={() => { setShowModal(null); setSelectedExpense(null); setReceiptForm({ url: '', vendor: '', amount: '', notes: '' }); }} title={selectedExpense ? 'Attach Receipt' : 'Capture Receipt'}>
        <div className="form-group">
          <label className="form-label">Receipt URL *</label>
          <input className="form-input" value={receiptForm.url} onChange={e => setReceiptForm({...receiptForm, url: e.target.value})} placeholder="https://..." />
          <p className="text-xs text-muted mt-1">Enter photo URL or use camera to capture</p>
        </div>
        {!selectedExpense && (
          <>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <input className="form-input" value={receiptForm.vendor} onChange={e => setReceiptForm({...receiptForm, vendor: e.target.value})} placeholder="e.g., Home Depot" />
              </div>
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" value={receiptForm.amount} onChange={e => setReceiptForm({...receiptForm, amount: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={receiptForm.notes} onChange={e => setReceiptForm({...receiptForm, notes: e.target.value})} />
            </div>
          </>
        )}
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => { setShowModal(null); setSelectedExpense(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCaptureReceipt}>{selectedExpense ? 'Attach Receipt' : 'Save Expense'}</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'timeline'} onClose={() => setShowModal(null)} title="Add Timeline Entry">
        <div className="form-group">
          <label className="form-label">Type</label>
          <select className="form-select" value={timelineForm.type} onChange={e => setTimelineForm({...timelineForm, type: e.target.value as any})}>
            <option value="note">Note</option>
            <option value="photo">Photo</option>
            <option value="payment">Payment</option>
            <option value="change_order">Change Order</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={timelineForm.title} onChange={e => setTimelineForm({...timelineForm, title: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={timelineForm.description} onChange={e => setTimelineForm({...timelineForm, description: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddTimelineEntry}>Add Entry</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'dailylog'} onClose={() => setShowModal(null)} title="Add Daily Log">
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={jobLogForm.date} onChange={e => setJobLogForm({...jobLogForm, date: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Work Completed *</label>
          <textarea className="form-textarea" value={jobLogForm.workCompleted} onChange={e => setJobLogForm({...jobLogForm, workCompleted: e.target.value})} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Workers</label>
            <input className="form-input" value={jobLogForm.workers} onChange={e => setJobLogForm({...jobLogForm, workers: e.target.value})} placeholder="Names separate by comma" />
          </div>
          <div className="form-group">
            <label className="form-label">Hours Worked</label>
            <input className="form-input" type="number" value={jobLogForm.hoursWorked} onChange={e => setJobLogForm({...jobLogForm, hoursWorked: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Issues</label>
          <textarea className="form-textarea" value={jobLogForm.issues} onChange={e => setJobLogForm({...jobLogForm, issues: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={jobLogForm.notes} onChange={e => setJobLogForm({...jobLogForm, notes: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddJobLog}>Add Log</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'punchlist'} onClose={() => setShowModal(null)} title="Add Punch List Item">
        <div className="form-group">
          <label className="form-label">Description *</label>
          <textarea className="form-textarea" value={punchListForm.description} onChange={e => setPunchListForm({...punchListForm, description: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddPunchListItem}>Add Item</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'issue'} onClose={() => setShowModal(null)} title="Log Issue">
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={issueForm.title} onChange={e => setIssueForm({...issueForm, title: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={issueForm.description} onChange={e => setIssueForm({...issueForm, description: e.target.value})} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Severity</label>
            <select className="form-select" value={issueForm.severity} onChange={e => setIssueForm({...issueForm, severity: e.target.value as any})}>
              {issueSeverityOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Est. Cost</label>
            <input className="form-input" type="number" value={issueForm.estimatedCost} onChange={e => setIssueForm({...issueForm, estimatedCost: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Est. Hours</label>
          <input className="form-input" type="number" value={issueForm.estimatedHours} onChange={e => setIssueForm({...issueForm, estimatedHours: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddIssue}>Log Issue</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'file'} onClose={() => setShowModal(null)} title="Add File Attachment">
        <div className="form-group">
          <label className="form-label">File Name *</label>
          <input className="form-input" value={fileForm.name} onChange={e => setFileForm({...fileForm, name: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">File URL *</label>
          <input className="form-input" value={fileForm.url} onChange={e => setFileForm({...fileForm, url: e.target.value})} placeholder="https://..." />
        </div>
        <div className="form-group">
          <label className="form-label">Type</label>
          <select className="form-select" value={fileForm.type} onChange={e => setFileForm({...fileForm, type: e.target.value})}>
            <option value="">Select type</option>
            <option value="pdf">PDF</option>
            <option value="image">Image</option>
            <option value="document">Document</option>
            <option value="spreadsheet">Spreadsheet</option>
          </select>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { addFileAttachment({ jobId: job.id, name: fileForm.name, url: fileForm.url, type: fileForm.type, size: fileForm.size || 0, category: fileForm.category || 'document' }); showToast('File added'); setShowModal(null); setFileForm({ name: '', url: '', type: '', size: 0, category: '' }); }}>Add File</button>
        </div>
      </Modal>

      <Modal isOpen={showModal === 'email'} onClose={() => setShowModal(null)} title="Send Email">
        <div className="form-group">
          <label className="form-label">To *</label>
          <input className="form-input" type="email" value={emailForm.email} onChange={e => setEmailForm({...emailForm, email: e.target.value})} placeholder="customer@email.com" />
        </div>
        <div className="form-group">
          <label className="form-label">Subject</label>
          <input className="form-input" value={emailForm.subject} onChange={e => setEmailForm({...emailForm, subject: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Message</label>
          <textarea className="form-textarea" value={emailForm.body} onChange={e => setEmailForm({...emailForm, body: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSendEmail}>Open Email</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Confirm Delete"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel="Delete"
        danger
      />

      <Modal isOpen={showModal === 'photo'} onClose={() => { setShowModal(null); setPhotoUrl(''); setPhotoDescription(''); }} title={`Add ${photoCategory === 'before' ? 'Before' : photoCategory === 'after' ? 'After' : 'Photo'}`}>
        <div className="form-group">
          <label className="form-label">Photo URL or Data URL</label>
          <input className="form-input" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <input className="form-input" value={photoDescription} onChange={e => setPhotoDescription(e.target.value)} placeholder="e.g., Kitchen cabinets before" />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => { setShowModal(null); setPhotoUrl(''); setPhotoDescription(''); }}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (photoUrl) {
              addPhoto({ jobId: job.id, url: photoUrl, description: photoDescription, category: photoCategory });
              setPhotoUrl('');
              setPhotoDescription('');
              setShowModal(null);
            }
          }}>Add Photo</button>
        </div>
      </Modal>

      <Modal isOpen={showGenerateInvoice} onClose={() => setShowGenerateInvoice(false)} title="Generate Invoice" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-muted">Job: {job.name}</div>
            <div className="text-sm text-muted">Contract: {formatCurrency(job.contractAmount)}</div>
            <div className="text-sm text-muted">Balance: {formatCurrency(balance)}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Invoice Amount</label>
            <input className="form-input" type="number" value={generateInvoiceOptions.amount} onChange={e => setGenerateInvoiceOptions({...generateInvoiceOptions, amount: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" value={generateInvoiceOptions.type} onChange={e => setGenerateInvoiceOptions({...generateInvoiceOptions, type: e.target.value})}>
              <option value="deposit">Deposit</option>
              <option value="progress">Progress Payment</option>
              <option value="final">Final Payment</option>
              <option value="change_order">Change Order</option>
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={generateInvoiceOptions.adjustFinalPrice} onChange={e => setGenerateInvoiceOptions({...generateInvoiceOptions, adjustFinalPrice: e.target.checked})} />
            <span>Adjust final price</span>
          </label>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setShowGenerateInvoice(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            const invNum = `INV-${String(invoices.length + 1).padStart(3, '0')}`;
            addInvoice({ jobId: job.id, invoiceNumber: invNum, amount: parseFloat(generateInvoiceOptions.amount) || job.contractAmount, type: generateInvoiceOptions.type as any, dueDate: new Date().toISOString().split('T')[0], status: 'draft', notes: '' });
            showToast('Invoice generated');
            setShowGenerateInvoice(false);
          }}>Generate Invoice</button>
        </div>
      </Modal>
    </div>
  );
}
