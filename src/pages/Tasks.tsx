import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck,
  Clock3,
  Edit3,
  ExternalLink,
  Filter,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/formatters';
import { TASK_STATUSES, PRIORITIES } from '../data/types';
import type { Priority, Task, TaskAssignmentRole, TaskStatus, TaskType } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';

type GroupMode = 'none' | 'today' | 'job' | 'worker' | 'priority';
type DueFilter = '' | 'today' | 'overdue';

interface EnrichedTask extends Task {
  jobName: string;
  assigneeName: string;
  effectiveType: TaskType;
  effectiveRole: TaskAssignmentRole;
  isToday: boolean;
  isOverdue: boolean;
  actionLabel?: string;
  actionTo?: string;
}

const taskTypes: { value: TaskType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'order', label: 'Order' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'client_action', label: 'Client Action' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'admin', label: 'Admin' },
];

const assignmentRoles: { value: TaskAssignmentRole; label: string }[] = [
  { value: 'worker', label: 'Worker' },
  { value: 'owner', label: 'Owner' },
  { value: 'office', label: 'Office' },
];

const todayString = () => new Date().toISOString().split('T')[0];

const defaultForm = {
  title: '',
  description: '',
  dueDate: todayString(),
  jobId: '',
  assignedTo: '',
  assignmentRole: 'worker' as TaskAssignmentRole,
  taskType: 'task' as TaskType,
  priority: 'medium' as Priority,
  status: 'open' as TaskStatus,
};

export function Tasks() {
  const { jobs, workers, tasks, estimates, materialOrders, addTask, updateTask, deleteTask } = useApp();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('');
  const [dueFilter, setDueFilter] = useState<DueFilter>('');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const taskResultsRef = useRef<HTMLElement | null>(null);

  const today = todayString();

  useEffect(() => {
    const priority = searchParams.get('priority');
    const status = searchParams.get('status');
    const due = searchParams.get('due');
    if (priority === 'high') setPriorityFilter('high');
    if (status && ['open', 'in_progress', 'blocked', 'done'].includes(status)) setStatusFilter(status);
    if (due === 'today' || due === 'overdue') {
      setDueFilter(due);
      setOpenOnly(true);
    }
  }, [searchParams]);

  const getTaskAction = (task: Task): Pick<EnrichedTask, 'actionLabel' | 'actionTo'> => {
    if (task.orderId || task.sourceType === 'order') return { actionLabel: 'Open order board', actionTo: '/estimates/orders' };
    if (task.estimateId || (task.sourceType === 'approved_estimate' && task.sourceId)) return { actionLabel: 'Open estimate', actionTo: `/estimates/${task.estimateId || task.sourceId}` };
    if (task.invoiceId) return { actionLabel: 'Open invoices', actionTo: '/invoices' };
    if (task.shoppingListId) return { actionLabel: 'Open shopping list', actionTo: `/shopping-lists${task.jobId ? `?jobId=${encodeURIComponent(task.jobId)}` : ''}` };
    if (task.jobId) return { actionLabel: 'Open job', actionTo: `/jobs/${task.jobId}` };
    if (task.customerId) return { actionLabel: 'Open customer', actionTo: '/customers' };
    return {};
  };

  const enrichedTasks = useMemo<EnrichedTask[]>(() => tasks.map(task => {
    const job = jobs.find(item => item.id === task.jobId);
    const worker = workers.find(item => item.id === task.assignedTo);
    const dueDate = task.dueDate || '';
    const action = getTaskAction(task);
    return {
      ...task,
      jobName: job?.name || 'Company',
      assigneeName: task.assignmentRole === 'owner' ? 'Owner' : task.assignmentRole === 'office' ? 'Office' : worker?.name || 'Unassigned',
      effectiveType: task.taskType || 'task',
      effectiveRole: task.assignmentRole || (task.assignedTo ? 'worker' : 'office'),
      isToday: dueDate === today,
      isOverdue: task.status !== 'done' && !!dueDate && dueDate < today,
      ...action,
    };
  }), [tasks, jobs, workers, today]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return enrichedTasks
      .filter(task => {
        if (query && ![task.title, task.description || '', task.jobName, task.assigneeName, task.effectiveType, task.priority].some(value => value.toLowerCase().includes(query))) return false;
        if (jobFilter && task.jobId !== jobFilter) return false;
        if (statusFilter && task.status !== statusFilter) return false;
        if (priorityFilter && task.priority !== priorityFilter) return false;
        if (typeFilter && task.effectiveType !== typeFilter) return false;
        if (dueFilter === 'today' && !task.isToday) return false;
        if (dueFilter === 'overdue' && !task.isOverdue) return false;
        if (openOnly && task.status === 'done') return false;
        return true;
      })
      .sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
        if (priorityRank[a.priority] !== priorityRank[b.priority]) return priorityRank[a.priority] - priorityRank[b.priority];
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.title.localeCompare(b.title);
      });
  }, [enrichedTasks, search, jobFilter, statusFilter, priorityFilter, typeFilter, dueFilter, openOnly]);

  const groupedTasks = useMemo(() => {
    const groups = new Map<string, { label: string; tasks: EnrichedTask[] }>();
    filteredTasks.forEach(task => {
      const key = groupMode === 'today' ? (task.isToday ? 'today' : task.isOverdue ? 'overdue' : 'upcoming')
        : groupMode === 'job' ? task.jobId || 'company'
        : groupMode === 'worker' ? task.assignedTo || task.effectiveRole
        : groupMode === 'priority' ? task.priority
        : 'all';
      const label = groupMode === 'today' ? (task.isToday ? 'Today' : task.isOverdue ? 'Overdue' : 'Upcoming')
        : groupMode === 'job' ? task.jobName
        : groupMode === 'worker' ? task.assigneeName
        : groupMode === 'priority' ? task.priority
        : 'Tasks';
      const group = groups.get(key) || { label, tasks: [] };
      group.tasks.push(task);
      groups.set(key, group);
    });
    return [...groups.entries()].map(([key, value]) => ({ key, ...value }));
  }, [filteredTasks, groupMode]);

  const todayTasks = enrichedTasks.filter(task => task.isToday && task.status !== 'done');
  const highPriorityTasks = enrichedTasks.filter(task => ['high', 'urgent'].includes(task.priority) && task.status !== 'done');
  const overdueTasks = enrichedTasks.filter(task => task.isOverdue);
  const blockingTasks = enrichedTasks.filter(task => task.status === 'blocked');
  const highNotStarted = enrichedTasks.filter(task => ['high', 'urgent'].includes(task.priority) && task.status === 'open');

  const alerts = [
    ...overdueTasks.slice(0, 2).map(task => ({ title: 'Overdue task', detail: `${task.title} was due ${task.dueDate ? formatDate(task.dueDate) : 'earlier'}.` })),
    ...blockingTasks.slice(0, 2).map(task => ({ title: 'Blocking job progress', detail: `${task.title} is blocking ${task.jobName}.` })),
    ...(highNotStarted.length > 0 ? [{ title: 'High priority not started', detail: `${highNotStarted.length} high priority task${highNotStarted.length === 1 ? '' : 's'} still open.` }] : []),
  ];

  const showTaskResults = () => {
    window.requestAnimationFrame(() => {
      taskResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const applyTaskFocusFilter = (filter: { due?: DueFilter; priority?: Priority | ''; status?: TaskStatus | '' }) => {
    setOpenOnly(true);
    setDueFilter(filter.due || '');
    setPriorityFilter(filter.priority || '');
    setStatusFilter(filter.status || '');
    setGroupMode('none');
    showTaskResults();
  };

  const openTaskModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        title: task.title || '',
        description: task.description || '',
        dueDate: task.dueDate || today,
        jobId: task.jobId || '',
        assignedTo: task.assignedTo || '',
        assignmentRole: task.assignmentRole || (task.assignedTo ? 'worker' : 'office'),
        taskType: task.taskType || 'task',
        priority: task.priority,
        status: task.status,
      });
    } else {
      setEditingTask(null);
      setFormData(defaultForm);
    }
    setShowModal(true);
  };

  const closeTaskModal = () => {
    setShowModal(false);
    setEditingTask(null);
    setFormData(defaultForm);
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      showToast('Title required', 'error');
      return;
    }
    const updates = {
      title: formData.title,
      description: formData.description,
      dueDate: formData.dueDate || undefined,
      jobId: formData.jobId || undefined,
      assignedTo: formData.assignmentRole === 'worker' ? formData.assignedTo || undefined : undefined,
      assignmentRole: formData.assignmentRole,
      taskType: formData.taskType,
      priority: formData.priority,
      status: formData.status,
    };
    if (editingTask) {
      updateTask(editingTask.id, updates);
      showToast('Task updated');
    } else {
      addTask({
        ...updates,
        sourceType: 'manual',
      });
      showToast('Task added');
    }
    closeTaskModal();
  };

  const quickAdd = () => {
    if (!formData.title.trim()) {
      showToast('Add a task title first', 'error');
      return;
    }
    handleSave();
  };

  const startWork = () => {
    const task = [...todayTasks, ...highPriorityTasks, ...overdueTasks].find(item => item.status === 'open');
    if (!task) {
      showToast('No open focus task to start');
      return;
    }
    updateTask(task.id, { status: 'in_progress' });
    showToast(`Started: ${task.title}`);
    if (task.actionTo) navigate(task.actionTo);
  };

  const startTask = (task: EnrichedTask) => {
    updateTask(task.id, { status: 'in_progress' });
    showToast(`Started: ${task.title}`);
    if (task.actionTo) navigate(task.actionTo);
  };

  const completeTask = (task: EnrichedTask) => {
    updateTask(task.id, { status: 'done' });
    showToast(`Completed: ${task.title}`);
  };

  const generateSmartTasks = () => {
    let created = 0;
    estimates.filter(estimate => estimate.status === 'approved').slice(0, 3).forEach(estimate => {
      if (tasks.some(task => task.sourceType === 'approved_estimate' && task.sourceId === estimate.id)) return;
      const job = jobs.find(item => item.estimateId === estimate.id);
      addTask({
        title: `Convert approved estimate ${estimate.estimateNumber}`,
        description: `Review scope and confirm next steps for ${estimate.name}.`,
        dueDate: today,
        jobId: job?.id,
        priority: 'high',
        status: 'open',
        taskType: 'follow_up',
        assignmentRole: 'office',
        sourceType: 'approved_estimate',
        sourceId: estimate.id,
      });
      created += 1;
    });

    materialOrders.filter(order => ['draft', 'sent', 'ordered'].includes(order.status)).slice(0, 3).forEach(order => {
      if (tasks.some(task => task.sourceType === 'order' && task.sourceId === order.id)) return;
      addTask({
        title: `Follow up on ${order.poNumber}`,
        description: `Confirm supplier status${order.expectedDate ? ` before ${formatDate(order.expectedDate)}` : ''}.`,
        dueDate: order.expectedDate || today,
        jobId: order.jobId,
        priority: order.expectedDate && order.expectedDate < today ? 'urgent' : 'medium',
        status: 'open',
        taskType: 'order',
        assignmentRole: 'office',
        sourceType: 'order',
        sourceId: order.id,
      });
      created += 1;
    });

    jobs.filter(job => ['approved', 'scheduled', 'active'].includes(job.status)).slice(0, 3).forEach(job => {
      if (tasks.some(task => task.sourceType === 'job_creation' && task.sourceId === job.id)) return;
      addTask({
        title: `Confirm next field action for ${job.name}`,
        description: 'Assign crew, materials, or customer follow-up needed to keep the job moving.',
        dueDate: today,
        jobId: job.id,
        priority: job.status === 'active' ? 'high' : 'medium',
        status: 'open',
        taskType: 'task',
        assignmentRole: 'owner',
        sourceType: 'job_creation',
        sourceId: job.id,
      });
      created += 1;
    });

    showToast(created > 0 ? `Generated ${created} smart task${created === 1 ? '' : 's'}` : 'No new smart tasks found');
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteTask(deleteId);
      showToast('Task deleted');
      setDeleteId(null);
    }
  };

  return (
    <div className="tasks-command-page">
      <div className="tasks-command-header">
        <div>
          <div className="page-eyebrow">Planning</div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Drive daily execution, accountability, and job follow-through.</p>
        </div>
        <div className="tasks-header-actions">
          <button className="btn btn-secondary" onClick={generateSmartTasks}><Sparkles size={18} /> Generate Smart Tasks</button>
          <button className="btn btn-primary" onClick={() => openTaskModal()}><Plus size={18} /> Add Task</button>
        </div>
      </div>

      <section className="tasks-focus-panel">
        <div className="tasks-focus-copy">
          <span>Today Focus</span>
          <h2>{todayTasks.length} tasks due today</h2>
          <p>{highPriorityTasks.length} high priority • {overdueTasks.length} overdue • {blockingTasks.length} blocking progress</p>
        </div>
        <div className="tasks-focus-stats">
          <FocusMetric icon={CalendarCheck} label="Due Today" value={todayTasks.length} onClick={() => applyTaskFocusFilter({ due: 'today' })} />
          <FocusMetric icon={AlertTriangle} label="High Priority" value={highPriorityTasks.length} warning onClick={() => applyTaskFocusFilter({ priority: 'high' })} />
          <FocusMetric icon={Clock3} label="Overdue" value={overdueTasks.length} danger onClick={() => applyTaskFocusFilter({ due: 'overdue' })} />
        </div>
        <button className="tasks-start-btn" onClick={startWork}><Play size={18} /> Start Work</button>
      </section>

      {alerts.length > 0 && (
        <section className="tasks-alert-grid">
          {alerts.map(alert => (
            <button key={`${alert.title}-${alert.detail}`} className="tasks-alert-card" onClick={() => {
              const title = alert.title.toLowerCase();
              applyTaskFocusFilter({
                due: title.includes('overdue') ? 'overdue' : '',
                priority: title.includes('high') ? 'high' : '',
                status: title.includes('blocking') ? 'blocked' : '',
              });
            }}>
              <AlertTriangle size={18} />
              <span><strong>{alert.title}</strong>{alert.detail}</span>
              <em>Review</em>
            </button>
          ))}
        </section>
      )}

      <section className="tasks-quick-add">
        <div>
          <h2>Quick Add</h2>
          <p>Create the next action without leaving the work list.</p>
        </div>
        <div className="tasks-quick-grid">
          <input value={formData.title} onChange={event => setFormData({ ...formData, title: event.target.value })} placeholder="Task" />
          <select value={formData.jobId} onChange={event => setFormData({ ...formData, jobId: event.target.value })}>
            <option value="">Company-wide</option>
            {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
          </select>
          <input type="date" value={formData.dueDate} onChange={event => setFormData({ ...formData, dueDate: event.target.value })} />
          <select value={formData.priority} onChange={event => setFormData({ ...formData, priority: event.target.value as Priority })}>
            {PRIORITIES.map(priority => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
          </select>
          <button className="btn btn-primary" onClick={quickAdd}><Plus size={16} /> Save</button>
        </div>
      </section>

      <section className="tasks-controls">
        <div className="tasks-search">
          <Search size={18} />
          <input placeholder="Search task, job, assignee..." value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        <select value={jobFilter} onChange={event => setJobFilter(event.target.value)}>
          <option value="">All Jobs</option>
          {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
        </select>
        <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setDueFilter(''); }}>
          <option value="">All Status</option>
          {TASK_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
        <select value={priorityFilter} onChange={event => { setPriorityFilter(event.target.value); setDueFilter(''); }}>
          <option value="">All Priority</option>
          {PRIORITIES.map(priority => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
        </select>
        <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as TaskType | '')}>
          <option value="">All Types</option>
          {taskTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <label className="tasks-open-toggle">
          <input type="checkbox" checked={openOnly} onChange={event => setOpenOnly(event.target.checked)} />
          Open only
        </label>
      </section>

      <div className="tasks-group-toggle">
        <Filter size={16} />
        <span>Group</span>
        {(['none', 'today', 'job', 'worker', 'priority'] as GroupMode[]).map(mode => (
          <button key={mode} className={groupMode === mode ? 'is-active' : ''} onClick={() => setGroupMode(mode)}>
            {mode === 'none' ? 'None' : mode === 'today' ? 'By Today' : mode === 'job' ? 'By Job' : mode === 'worker' ? 'By Worker' : 'By Priority'}
          </button>
        ))}
      </div>

      <section className="tasks-table-card" ref={taskResultsRef}>
        {groupMode === 'none' ? (
          <TaskTable tasks={filteredTasks} workers={workers} onUpdate={updateTask} onDelete={setDeleteId} onEdit={openTaskModal} onStart={startTask} onComplete={completeTask} />
        ) : (
          <div className="tasks-group-list">
            {groupedTasks.length === 0 ? <div className="tasks-empty">No tasks</div> : groupedTasks.map(group => (
              <div key={group.key} className="tasks-group-card">
                <div className="tasks-group-header">
                  <h3>{group.label.replace('_', ' ')}</h3>
                  <span>{group.tasks.length} tasks • {group.tasks.filter(task => task.status !== 'done').length} open</span>
                </div>
                <TaskTable tasks={group.tasks} workers={workers} onUpdate={updateTask} onDelete={setDeleteId} onEdit={openTaskModal} onStart={startTask} onComplete={completeTask} compact />
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal isOpen={showModal} onClose={closeTaskModal} title={editingTask ? 'Edit Task' : 'Add Task'} size="lg">
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
            <label className="form-label">Task Type</label>
            <select className="form-select" value={formData.taskType} onChange={e => setFormData({...formData, taskType: e.target.value as TaskType})}>
              {taskTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Assignment</label>
            <select className="form-select" value={formData.assignmentRole} onChange={e => setFormData({...formData, assignmentRole: e.target.value as TaskAssignmentRole, assignedTo: ''})}>
              {assignmentRoles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </div>
        </div>
        {formData.assignmentRole === 'worker' && (
          <div className="form-group">
            <label className="form-label">Worker</label>
            <select className="form-select" value={formData.assignedTo} onChange={e => setFormData({...formData, assignedTo: e.target.value})}>
              <option value="">Unassigned</option>
              {workers.filter(worker => worker.status === 'active').map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as Priority})}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as TaskStatus})}>
              {TASK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={closeTaskModal}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editingTask ? 'Save Task' : 'Add Task'}</button>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Task" message="Delete this task?" confirmLabel="Delete" danger />
    </div>
  );
}

function FocusMetric({ icon: Icon, label, value, warning, danger, onClick }: { icon: LucideIcon; label: string; value: number; warning?: boolean; danger?: boolean; onClick?: () => void }) {
  return (
    <button className={`tasks-focus-metric ${warning ? 'warning' : ''} ${danger ? 'danger' : ''}`} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
      <em>Review</em>
    </button>
  );
}

function TaskTable({
  tasks,
  workers,
  onUpdate,
  onDelete,
  onEdit,
  onStart,
  onComplete,
  compact,
}: {
  tasks: EnrichedTask[];
  workers: { id: string; name: string }[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onStart: (task: EnrichedTask) => void;
  onComplete: (task: EnrichedTask) => void;
  compact?: boolean;
}) {
  if (tasks.length === 0) return <div className="tasks-empty">No tasks</div>;

  const priorityClass = (priority: Priority) => priority === 'urgent' ? 'badge-red' : priority === 'high' ? 'badge-yellow' : priority === 'medium' ? 'badge-blue' : 'badge-gray';
  const statusClass = (status: TaskStatus) => status === 'done' ? 'badge-green' : status === 'blocked' ? 'badge-red' : status === 'in_progress' ? 'badge-yellow' : 'badge-blue';

  return (
    <div className={`tasks-table-wrap ${compact ? 'compact' : ''}`}>
      <table className="tasks-table">
        <thead>
          <tr>
            <th></th>
            <th>Task</th>
            <th>Job</th>
            <th>Assigned</th>
            <th>Due</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id} className={`${task.status === 'done' ? 'is-done' : ''} ${task.isOverdue ? 'is-overdue' : ''} ${task.status === 'blocked' ? 'is-blocked' : ''}`}>
              <td data-label="Done">
                <input
                  className="tasks-check"
                  type="checkbox"
                  checked={task.status === 'done'}
                  onChange={event => onUpdate(task.id, { status: event.target.checked ? 'done' : 'open' })}
                />
              </td>
              <td data-label="Task">
                <div className="tasks-title-cell">
                  <strong>{task.title}</strong>
                  <span>{task.description || task.effectiveType.replace('_', ' ')}</span>
                </div>
              </td>
              <td data-label="Job">{task.jobId ? <Link to={`/jobs/${task.jobId}`}>{task.jobName}</Link> : <span>Company</span>}</td>
              <td data-label="Assigned">
                <div className="tasks-assignment-cell">
                  <span>{task.assigneeName}</span>
                  <select value={task.assignmentRole || (task.assignedTo ? 'worker' : 'office')} onChange={event => onUpdate(task.id, { assignmentRole: event.target.value as TaskAssignmentRole, assignedTo: event.target.value === 'worker' ? task.assignedTo : undefined })}>
                    {assignmentRoles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                  {(task.assignmentRole || (task.assignedTo ? 'worker' : 'office')) === 'worker' && (
                    <select value={task.assignedTo || ''} onChange={event => onUpdate(task.id, { assignedTo: event.target.value || undefined, assignmentRole: 'worker' })}>
                      <option value="">Unassigned</option>
                      {workers.map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
                    </select>
                  )}
                </div>
              </td>
              <td data-label="Due">{task.dueDate ? formatDate(task.dueDate) : 'No date'}</td>
              <td data-label="Priority"><span className={`badge ${priorityClass(task.priority)}`}>{task.priority}</span></td>
              <td data-label="Status">
                <div className="tasks-status-cell">
                  <span className={`badge ${statusClass(task.status)}`}>{task.status.replace('_', ' ')}</span>
                  <select value={task.status} onChange={event => onUpdate(task.id, { status: event.target.value as TaskStatus })}>
                    {TASK_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </div>
              </td>
              <td data-label="Actions">
                <div className="tasks-action-cell">
                  {task.actionTo ? (
                    <Link className="btn btn-sm btn-primary" to={task.actionTo}>
                      <ExternalLink size={14} /> {task.actionLabel}
                    </Link>
                  ) : (
                    <button className="btn btn-sm btn-primary" onClick={() => onEdit(task)}>
                      <ExternalLink size={14} /> Open task
                    </button>
                  )}
                  <button className="btn btn-sm btn-secondary" onClick={() => onEdit(task)}>
                    <Edit3 size={14} /> Edit
                  </button>
                  {task.status === 'done' ? (
                    <button className="btn btn-sm btn-secondary" onClick={() => onUpdate(task.id, { status: 'open' })}>
                      Reopen
                    </button>
                  ) : (
                    <>
                      {task.status !== 'in_progress' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => onStart(task)}>
                          <Play size={14} /> Start
                        </button>
                      )}
                      <button className="btn btn-sm btn-secondary" onClick={() => onComplete(task)}>
                        Done
                      </button>
                    </>
                  )}
                  <button className="btn btn-sm btn-danger btn-icon" onClick={() => onDelete(task.id)} title="Delete task">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
