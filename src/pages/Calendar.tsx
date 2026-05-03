import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/formatters';
import type { Job, JobStatus, Task, TaskStatus, TaskType } from '../data/types';
import { useToast } from '../components/common/Toast';
import { Modal } from '../components/common/Modal';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  GripVertical,
  Plus,
  Users,
} from 'lucide-react';

type CalendarView = 'month' | 'week' | 'day';
type PlannerMode = 'calendar' | 'crew';
type DragPayload = { type: 'job' | 'task'; id: string };
type SelectedScheduleItem =
  | { type: 'job'; job: Job; dateKey: string }
  | { type: 'task'; task: Task }
  | { type: 'time'; dateKey: string; hours: number };

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TASK_TYPES: { value: 'all' | TaskType; label: string }[] = [
  { value: 'all', label: 'All task types' },
  { value: 'task', label: 'Task' },
  { value: 'order', label: 'Order' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'client_action', label: 'Client Action' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'admin', label: 'Admin' },
];

const TASK_STATUSES: { value: 'all' | TaskStatus; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

const JOB_STATUSES: { value: 'all' | JobStatus; label: string }[] = [
  { value: 'all', label: 'All job statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'awaiting_materials', label: 'Awaiting Materials' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
];

const toDateKey = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}`;
};

const fromDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const differenceInDays = (start: string, end: string) => {
  const startDate = fromDateKey(start);
  const endDate = fromDateKey(end);
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
};

const getStartOfWeek = (date: Date) => addDays(date, -date.getDay());

const isJobOnDay = (job: Job, dayKey: string) => {
  const start = job.startDate || job.dueDate;
  const end = job.dueDate || job.startDate;
  return Boolean(start && end && dayKey >= start && dayKey <= end);
};

const taskIsDeadline = (task: Task) => task.taskType === 'inspection' || task.taskType === 'client_action' || task.priority === 'urgent';

export function Calendar() {
  const { jobs, tasks, timeEntries, workers, addTask, updateTask, updateJob } = useApp();
  const { showToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('week');
  const [mode, setMode] = useState<PlannerMode>('calendar');
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<'all' | TaskType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus | JobStatus>('all');
  const [selectedItem, setSelectedItem] = useState<SelectedScheduleItem | null>(null);
  const [quickForm, setQuickForm] = useState({
    mode: 'task' as 'task' | 'job',
    title: '',
    jobId: '',
    workerId: '',
    taskType: 'task' as TaskType,
    priority: 'medium' as Task['priority'],
  });

  const todayKey = toDateKey(new Date());
  const activeWorkers = workers.filter(worker => worker.status === 'active');

  const visibleDays = useMemo(() => {
    if (view === 'day') return [new Date(currentDate)];
    if (view === 'week') {
      const start = getStartOfWeek(currentDate);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }

    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 12);
    const gridStart = addDays(firstDay, -firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [currentDate, view]);

  const visibleDateKeys = useMemo(() => visibleDays.map(toDateKey), [visibleDays]);
  const visibleStart = visibleDateKeys[0];
  const visibleEnd = visibleDateKeys[visibleDateKeys.length - 1];

  const filteredJobs = useMemo(() => jobs.filter(job => {
    const intersectsRange = Boolean(job.startDate && job.dueDate && job.startDate <= visibleEnd && job.dueDate >= visibleStart);
    const matchesJob = jobFilter === 'all' || job.id === jobFilter;
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return intersectsRange && matchesJob && matchesStatus;
  }), [jobs, jobFilter, statusFilter, visibleEnd, visibleStart]);

  const filteredTasks = useMemo(() => tasks.filter(task => {
    if (!task.dueDate || task.dueDate < visibleStart || task.dueDate > visibleEnd) return false;
    if (jobFilter !== 'all' && task.jobId !== jobFilter) return false;
    if (workerFilter !== 'all' && task.assignedTo !== workerFilter) return false;
    if (taskTypeFilter !== 'all' && task.taskType !== taskTypeFilter) return false;
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    return true;
  }), [jobFilter, statusFilter, taskTypeFilter, tasks, visibleEnd, visibleStart, workerFilter]);

  const tasksByDay = useMemo(() => filteredTasks.reduce((acc, task) => {
    if (!task.dueDate) return acc;
    acc[task.dueDate] = [...(acc[task.dueDate] || []), task];
    return acc;
  }, {} as Record<string, Task[]>), [filteredTasks]);

  const timeByDay = useMemo(() => timeEntries.reduce((acc, entry) => {
    if (entry.date < visibleStart || entry.date > visibleEnd) return acc;
    if (jobFilter !== 'all' && entry.jobId !== jobFilter) return acc;
    if (workerFilter !== 'all' && entry.workerId !== workerFilter) return acc;
    acc[entry.date] = (acc[entry.date] || 0) + entry.totalHours;
    return acc;
  }, {} as Record<string, number>), [jobFilter, timeEntries, visibleEnd, visibleStart, workerFilter]);

  const calendarTitle = useMemo(() => {
    if (view === 'month') return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (view === 'day') return currentDate.toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return `${formatDate(visibleStart)} - ${formatDate(visibleEnd)}`;
  }, [currentDate, view, visibleEnd, visibleStart]);

  const alerts = useMemo(() => {
    const overlappingDays = visibleDateKeys.filter(dayKey => filteredJobs.filter(job => isJobOnDay(job, dayKey) && !['completed', 'closed'].includes(job.status)).length > activeWorkers.length && activeWorkers.length > 0);
    const unassignedTasks = filteredTasks.filter(task => !task.assignedTo && task.status !== 'done');
    const missedDeadlines = filteredTasks.filter(task => task.dueDate && task.dueDate < todayKey && task.status !== 'done');
    return { overlappingDays, unassignedTasks, missedDeadlines };
  }, [activeWorkers.length, filteredJobs, filteredTasks, todayKey, visibleDateKeys]);

  const movePeriod = (direction: number) => {
    if (view === 'month') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1, 12));
    if (view === 'week') setCurrentDate(addDays(currentDate, direction * 7));
    if (view === 'day') setCurrentDate(addDays(currentDate, direction));
  };

  const openQuickAdd = (dateKey: string) => {
    setSelectedDate(dateKey);
    setQuickForm({
      mode: 'task',
      title: '',
      jobId: jobFilter === 'all' ? '' : jobFilter,
      workerId: workerFilter === 'all' ? '' : workerFilter,
      taskType: 'task',
      priority: 'medium',
    });
  };

  const showCalendarResults = () => {
    window.requestAnimationFrame(() => {
      document.querySelector('.schedule-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const showUnassignedTasks = () => {
    setWorkerFilter('all');
    setTaskTypeFilter('all');
    setStatusFilter('open');
    showCalendarResults();
  };

  const showMissedDeadlines = () => {
    setTaskTypeFilter('all');
    setStatusFilter('open');
    showCalendarResults();
  };

  const handleDragStart = (payload: DragPayload, event: React.DragEvent) => {
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (dateKey: string, event: React.DragEvent) => {
    event.preventDefault();
    setDragOverDate(null);
    const raw = event.dataTransfer.getData('application/json');
    if (!raw) return;

    const payload = JSON.parse(raw) as DragPayload;
    if (payload.type === 'task') {
      updateTask(payload.id, { dueDate: dateKey });
      showToast('Task rescheduled');
      return;
    }

    const job = jobs.find(item => item.id === payload.id);
    if (!job) return;
    const duration = differenceInDays(job.startDate, job.dueDate);
    updateJob(job.id, { startDate: dateKey, dueDate: toDateKey(addDays(fromDateKey(dateKey), duration)) });
    showToast('Job moved');
  };

  const adjustJobDuration = (job: Job, days: number) => {
    const newDueDate = toDateKey(addDays(fromDateKey(job.dueDate), days));
    if (newDueDate < job.startDate) return;
    updateJob(job.id, { dueDate: newDueDate });
    showToast(days > 0 ? 'Job duration extended' : 'Job duration shortened');
  };

  const handleQuickSave = () => {
    if (!selectedDate) return;
    if (quickForm.mode === 'task') {
      if (!quickForm.title.trim()) {
        showToast('Enter a task name', 'error');
        return;
      }
      addTask({
        title: quickForm.title.trim(),
        dueDate: selectedDate,
        jobId: quickForm.jobId || undefined,
        assignedTo: quickForm.workerId || undefined,
        taskType: quickForm.taskType,
        assignmentRole: quickForm.workerId ? 'worker' : 'office',
        priority: quickForm.priority,
        status: 'open',
      });
      showToast('Task added to schedule');
    } else {
      if (!quickForm.jobId) {
        showToast('Select a job to schedule', 'error');
        return;
      }
      const job = jobs.find(item => item.id === quickForm.jobId);
      if (!job) return;
      const duration = differenceInDays(job.startDate || selectedDate, job.dueDate || selectedDate);
      updateJob(job.id, { startDate: selectedDate, dueDate: toDateKey(addDays(fromDateKey(selectedDate), duration || 1)), status: job.status === 'approved' ? 'scheduled' : job.status });
      if (quickForm.workerId) {
        addTask({
          title: `Crew assigned to ${job.name}`,
          dueDate: selectedDate,
          jobId: job.id,
          assignedTo: quickForm.workerId,
          taskType: 'task',
          assignmentRole: 'worker',
          priority: 'medium',
          status: 'open',
        });
      }
      showToast('Job scheduled');
    }
    setSelectedDate(null);
  };

  const getTaskClass = (task: Task) => {
    if (task.status === 'done') return 'completed';
    if (task.dueDate && task.dueDate < todayKey) return 'overdue';
    if (taskIsDeadline(task)) return 'deadline';
    return 'task';
  };

  const renderTask = (task: Task, compact = false) => {
    const worker = workers.find(item => item.id === task.assignedTo);
    return (
      <button
        key={task.id}
        draggable
        onDragStart={(event) => handleDragStart({ type: 'task', id: task.id }, event)}
        onClick={() => setSelectedItem({ type: 'task', task })}
        className={`schedule-event ${getTaskClass(task)} ${compact ? 'compact' : ''}`}
        title="Open task details or drag to reschedule"
      >
        <GripVertical size={12} />
        <span>{task.title}</span>
        {!compact && worker && <small>{worker.name}</small>}
      </button>
    );
  };

  const renderJob = (job: Job, dayKey: string, compact = false) => {
    const starts = job.startDate === dayKey;
    const ends = job.dueDate === dayKey;
    return (
      <button
        key={`${job.id}-${dayKey}`}
        draggable
        onDragStart={(event) => handleDragStart({ type: 'job', id: job.id }, event)}
        onClick={() => setSelectedItem({ type: 'job', job, dateKey: dayKey })}
        className={`schedule-event job ${job.status === 'completed' || job.status === 'closed' ? 'completed' : ''} ${starts ? 'starts' : ''} ${ends ? 'ends' : ''} ${compact ? 'compact' : ''}`}
        title="Open job schedule details or drag to move job"
      >
        <GripVertical size={12} />
        <span>{compact ? job.name : `${job.name} (${differenceInDays(job.startDate, job.dueDate) + 1}d)`}</span>
        {!compact && <small>{job.status.replace('_', ' ')}</small>}
      </button>
    );
  };

  const renderCalendarGrid = () => (
    <div className={`schedule-grid ${view}`}>
      {visibleDays.map(day => {
        const dayKey = toDateKey(day);
        const isToday = dayKey === todayKey;
        const inMonth = view !== 'month' || day.getMonth() === currentDate.getMonth();
        const dayJobs = filteredJobs.filter(job => isJobOnDay(job, dayKey));
        const dayTasks = tasksByDay[dayKey] || [];
        const dayHours = timeByDay[dayKey] || 0;
        const isOver = dragOverDate === dayKey;

        return (
          <div
            key={dayKey}
            className={`schedule-day ${isToday ? 'today' : ''} ${!inMonth ? 'muted' : ''} ${isOver ? 'drop-target' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragOverDate(dayKey); }}
            onDragLeave={() => setDragOverDate(null)}
            onDrop={(event) => handleDrop(dayKey, event)}
            onDoubleClick={() => openQuickAdd(dayKey)}
          >
            <button className="schedule-day-header" onClick={() => openQuickAdd(dayKey)}>
              <span>{DAY_LABELS[day.getDay()]}</span>
              <strong>{day.getDate()}</strong>
            </button>
            <div className="schedule-day-events">
              {dayJobs.slice(0, view === 'month' ? 3 : 8).map(job => renderJob(job, dayKey, view === 'month'))}
              {dayTasks.slice(0, view === 'month' ? 3 : 10).map(task => renderTask(task, view === 'month'))}
              {dayHours > 0 && <button className="schedule-event time" onClick={() => setSelectedItem({ type: 'time', dateKey: dayKey, hours: dayHours })}><Clock size={12} /><span>{dayHours.toFixed(1)}h logged</span></button>}
              {(dayJobs.length + dayTasks.length) > (view === 'month' ? 6 : 18) && <div className="schedule-more">+ more scheduled</div>}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderCrewView = () => (
    <div className="schedule-crew-grid">
      <div className="schedule-crew-worker schedule-crew-heading">Crew</div>
      {visibleDays.map(day => <div key={toDateKey(day)} className="schedule-crew-heading">{DAY_LABELS[day.getDay()]} {day.getDate()}</div>)}
      {activeWorkers.map(worker => (
        <Fragment key={worker.id}>
          <div key={`${worker.id}-name`} className="schedule-crew-worker">
            <strong>{worker.name}</strong>
            <span>{worker.trade || worker.type}</span>
          </div>
          {visibleDays.map(day => {
            const dayKey = toDateKey(day);
            const assignedTasks = filteredTasks.filter(task => task.assignedTo === worker.id && task.dueDate === dayKey);
            const laborHours = timeEntries.filter(entry => entry.workerId === worker.id && entry.date === dayKey).reduce((sum, entry) => sum + entry.totalHours, 0);
            return (
              <div
                key={`${worker.id}-${dayKey}`}
                className="schedule-crew-cell"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(dayKey, event)}
                onDoubleClick={() => openQuickAdd(dayKey)}
              >
                {assignedTasks.map(task => renderTask(task, true))}
                {laborHours > 0 && <span className="schedule-crew-hours">{laborHours.toFixed(1)}h</span>}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <div>
          <div className="page-eyebrow">Planning</div>
          <h1>Schedule</h1>
          <p>Plan jobs, tasks, inspections, deadlines, and crew assignments in one live calendar.</p>
        </div>
        <div className="schedule-header-actions">
          <button className="btn btn-secondary" onClick={() => setCurrentDate(new Date())}>Today</button>
          <button className="btn btn-secondary btn-icon" onClick={() => movePeriod(-1)}><ChevronLeft size={18} /></button>
          <strong>{calendarTitle}</strong>
          <button className="btn btn-secondary btn-icon" onClick={() => movePeriod(1)}><ChevronRight size={18} /></button>
          <button className="btn btn-primary" onClick={() => openQuickAdd(todayKey)}><Plus size={18} /> Quick Add</button>
        </div>
      </div>

      <div className="schedule-toolbar">
        <div className="schedule-segment">
          {(['month', 'week', 'day'] as CalendarView[]).map(option => (
            <button key={option} className={view === option ? 'active' : ''} onClick={() => setView(option)}>{option}</button>
          ))}
        </div>
        <div className="schedule-segment">
          <button className={mode === 'calendar' ? 'active' : ''} onClick={() => setMode('calendar')}><CalendarIcon size={15} /> Calendar</button>
          <button className={mode === 'crew' ? 'active' : ''} onClick={() => setMode('crew')}><Users size={15} /> Crew</button>
        </div>
      </div>

      <div className="schedule-filters">
        <Filter size={18} />
        <select className="form-select" value={jobFilter} onChange={event => setJobFilter(event.target.value)}>
          <option value="all">All jobs</option>
          {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
        </select>
        <select className="form-select" value={workerFilter} onChange={event => setWorkerFilter(event.target.value)}>
          <option value="all">All workers</option>
          {workers.map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
        </select>
        <select className="form-select" value={taskTypeFilter} onChange={event => setTaskTypeFilter(event.target.value as 'all' | TaskType)}>
          {TASK_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select className="form-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | TaskStatus | JobStatus)}>
          <option value="all">All statuses</option>
          <optgroup label="Tasks">{TASK_STATUSES.filter(option => option.value !== 'all').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>
          <optgroup label="Jobs">{JOB_STATUSES.filter(option => option.value !== 'all').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>
        </select>
      </div>

      <div className="schedule-alerts">
        {alerts.overlappingDays.length > 0 && <button onClick={() => { setMode('calendar'); showCalendarResults(); }}><AlertTriangle size={16} /><strong>{alerts.overlappingDays.length}</strong><span>days may be overbooked</span><em>Review</em></button>}
        {alerts.unassignedTasks.length > 0 && <button onClick={showUnassignedTasks}><AlertTriangle size={16} /><strong>{alerts.unassignedTasks.length}</strong><span>unassigned tasks</span><em>Review</em></button>}
        {alerts.missedDeadlines.length > 0 && <button className="danger" onClick={showMissedDeadlines}><AlertTriangle size={16} /><strong>{alerts.missedDeadlines.length}</strong><span>missed deadlines</span><em>Review</em></button>}
        {alerts.overlappingDays.length + alerts.unassignedTasks.length + alerts.missedDeadlines.length === 0 && <div className="success"><CalendarIcon size={16} /><strong>Clear</strong><span>No scheduling alerts in this view</span></div>}
      </div>

      <div className="schedule-legend">
        <span><i className="job" /> Jobs</span>
        <span><i className="task" /> Tasks</span>
        <span><i className="completed" /> Completed</span>
        <span><i className="overdue" /> Overdue</span>
        <span><i className="deadline" /> Inspections/deadlines</span>
      </div>

      <div className="schedule-board">
        {mode === 'calendar' ? renderCalendarGrid() : renderCrewView()}
      </div>

      <div className="schedule-timeline">
        <div className="schedule-section-heading">
          <h3>Job Timeline</h3>
          <span>Drag a job to move it. Use +/- to adjust duration.</span>
        </div>
        <div className="schedule-timeline-list">
          {filteredJobs.length === 0 ? <div className="schedule-empty">No jobs scheduled in this view.</div> : filteredJobs.map(job => (
            <div key={job.id} className="schedule-timeline-row">
              <Link to={`/jobs/${job.id}`}>{job.name}</Link>
              <span>{formatDate(job.startDate)} - {formatDate(job.dueDate)}</span>
              <b>{differenceInDays(job.startDate, job.dueDate) + 1} days</b>
              <div>
                <button className="btn btn-sm btn-secondary" onClick={() => adjustJobDuration(job, -1)}>-</button>
                <button className="btn btn-sm btn-secondary" onClick={() => adjustJobDuration(job, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={Boolean(selectedDate)} onClose={() => setSelectedDate(null)} title={selectedDate ? `Schedule ${formatDate(selectedDate)}` : 'Schedule'}>
        <div className="schedule-quick-tabs">
          <button className={quickForm.mode === 'task' ? 'active' : ''} onClick={() => setQuickForm({ ...quickForm, mode: 'task' })}>Add Task</button>
          <button className={quickForm.mode === 'job' ? 'active' : ''} onClick={() => setQuickForm({ ...quickForm, mode: 'job' })}>Schedule Job</button>
        </div>
        {quickForm.mode === 'task' ? (
          <>
            <div className="form-group"><label className="form-label">Task *</label><input className="form-input" value={quickForm.title} onChange={event => setQuickForm({ ...quickForm, title: event.target.value })} /></div>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Job</label><select className="form-select" value={quickForm.jobId} onChange={event => setQuickForm({ ...quickForm, jobId: event.target.value })}><option value="">No job</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Worker</label><select className="form-select" value={quickForm.workerId} onChange={event => setQuickForm({ ...quickForm, workerId: event.target.value })}><option value="">Unassigned</option>{activeWorkers.map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={quickForm.taskType} onChange={event => setQuickForm({ ...quickForm, taskType: event.target.value as TaskType })}>{TASK_TYPES.filter(option => option.value !== 'all').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Priority</label><select className="form-select" value={quickForm.priority} onChange={event => setQuickForm({ ...quickForm, priority: event.target.value as Task['priority'] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            </div>
          </>
        ) : (
          <>
            <div className="form-group"><label className="form-label">Job *</label><select className="form-select" value={quickForm.jobId} onChange={event => setQuickForm({ ...quickForm, jobId: event.target.value })}><option value="">Select job</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Assign Worker</label><select className="form-select" value={quickForm.workerId} onChange={event => setQuickForm({ ...quickForm, workerId: event.target.value })}><option value="">No worker assignment</option>{activeWorkers.map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></div>
          </>
        )}
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setSelectedDate(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleQuickSave}>Save to Schedule</button>
        </div>
      </Modal>

      <Modal isOpen={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} title="Scheduled Item" size="sm">
        {selectedItem?.type === 'job' && (
          <div className="schedule-detail-card">
            <span className="badge badge-blue">Job</span>
            <h3>{selectedItem.job.name}</h3>
            <p>{selectedItem.job.customer || 'No customer'} - {selectedItem.job.status.replace('_', ' ')}</p>
            <div><strong>Scheduled</strong><span>{formatDate(selectedItem.job.startDate)} - {formatDate(selectedItem.job.dueDate)}</span></div>
            <div><strong>Selected day</strong><span>{formatDate(selectedItem.dateKey)}</span></div>
            <div><strong>Address</strong><span>{selectedItem.job.address || 'No address'}</span></div>
            <Link className="btn btn-primary" to={`/jobs/${selectedItem.job.id}`}><ExternalLink size={16} /> Open Job</Link>
          </div>
        )}
        {selectedItem?.type === 'task' && (
          <div className="schedule-detail-card">
            <span className={`badge ${selectedItem.task.status === 'done' ? 'badge-green' : selectedItem.task.dueDate && selectedItem.task.dueDate < todayKey ? 'badge-red' : 'badge-yellow'}`}>Task</span>
            <h3>{selectedItem.task.title}</h3>
            <p>{selectedItem.task.description || selectedItem.task.taskType?.replace('_', ' ') || 'Scheduled task'}</p>
            <div><strong>Due</strong><span>{selectedItem.task.dueDate ? formatDate(selectedItem.task.dueDate) : 'No due date'}</span></div>
            <div><strong>Status</strong><span>{selectedItem.task.status.replace('_', ' ')}</span></div>
            <div><strong>Priority</strong><span>{selectedItem.task.priority}</span></div>
            <div><strong>Assigned</strong><span>{workers.find(worker => worker.id === selectedItem.task.assignedTo)?.name || 'Unassigned'}</span></div>
            {selectedItem.task.jobId && <Link className="btn btn-primary" to={`/jobs/${selectedItem.task.jobId}`}><ExternalLink size={16} /> Open Related Job</Link>}
          </div>
        )}
        {selectedItem?.type === 'time' && (
          <div className="schedule-detail-card">
            <span className="badge badge-blue">Time</span>
            <h3>{selectedItem.hours.toFixed(1)} hours logged</h3>
            <p>{formatDate(selectedItem.dateKey)}</p>
            <Link className="btn btn-primary" to="/time-entries"><ExternalLink size={16} /> Open Time Entries</Link>
          </div>
        )}
      </Modal>
    </div>
  );
}
