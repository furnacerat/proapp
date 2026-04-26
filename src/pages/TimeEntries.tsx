import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Copy,
  DollarSign,
  Edit3,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import type { TimeEntry } from '../data/types';

type DatePreset = 'all' | 'this_week' | 'last_7' | 'overtime';
type GroupMode = 'none' | 'job' | 'worker' | 'date';

interface EnrichedEntry extends TimeEntry {
  jobName: string;
  workerName: string;
  workerRate: number;
}

const today = () => new Date().toISOString().split('T')[0];

export function TimeEntries() {
  const { jobs, workers, timeEntries, addTimeEntry, updateTimeEntry, deleteTimeEntry } = useApp();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ startTime: '', endTime: '', totalHours: '', notes: '' });

  const [formData, setFormData] = useState({
    jobId: '', workerId: '', date: today(), startTime: '07:00', endTime: '16:00', notes: ''
  });

  const enrichedEntries = useMemo<EnrichedEntry[]>(() => {
    return timeEntries.map(entry => {
      const job = jobs.find(item => item.id === entry.jobId);
      const worker = workers.find(item => item.id === entry.workerId);
      return {
        ...entry,
        jobName: job?.name || 'Unknown Job',
        workerName: worker?.name || 'Unknown Worker',
        workerRate: worker?.hourlyRate || 0,
      };
    });
  }, [timeEntries, jobs, workers]);

  const weekRange = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setDate(now.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, []);

  const filteredEntries = useMemo(() => {
    let result = [...enrichedEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const query = search.trim().toLowerCase();

    if (query) {
      result = result.filter(entry =>
        entry.jobName.toLowerCase().includes(query) ||
        entry.workerName.toLowerCase().includes(query) ||
        entry.notes?.toLowerCase().includes(query)
      );
    }

    if (jobFilter) result = result.filter(entry => entry.jobId === jobFilter);
    if (workerFilter) result = result.filter(entry => entry.workerId === workerFilter);
    if (dateFilter) result = result.filter(entry => entry.date === dateFilter);

    if (datePreset === 'this_week') {
      result = result.filter(entry => {
        const date = new Date(entry.date);
        return date >= weekRange.start && date <= weekRange.end;
      });
    }

    if (datePreset === 'last_7') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      cutoff.setHours(0, 0, 0, 0);
      result = result.filter(entry => new Date(entry.date) >= cutoff);
    }

    if (datePreset === 'overtime') result = result.filter(entry => entry.overtime);

    return result;
  }, [enrichedEntries, search, jobFilter, workerFilter, dateFilter, datePreset, weekRange]);

  const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.totalHours, 0);
  const totalCost = filteredEntries.reduce((sum, entry) => sum + entry.laborCost, 0);
  const averageHoursPerJob = jobs.length > 0 ? enrichedEntries.reduce((sum, entry) => sum + entry.totalHours, 0) / Math.max(1, new Set(enrichedEntries.map(entry => entry.jobId)).size) : 0;
  const overtimeThisWeek = enrichedEntries
    .filter(entry => entry.overtime && new Date(entry.date) >= weekRange.start && new Date(entry.date) <= weekRange.end)
    .reduce((sum, entry) => sum + Math.max(0, entry.totalHours - 8), 0);

  const jobLaborSummaries = useMemo(() => {
    return jobs.map(job => {
      const entries = enrichedEntries.filter(entry => entry.jobId === job.id);
      const hours = entries.reduce((sum, entry) => sum + entry.totalHours, 0);
      const cost = entries.reduce((sum, entry) => sum + entry.laborCost, 0);
      const averageRate = entries.length > 0 ? cost / Math.max(hours, 1) : workers.reduce((sum, worker) => sum + (worker.hourlyRate || 0), 0) / Math.max(workers.length, 1);
      const budgetHours = job.estimatedCost > 0 && averageRate > 0 ? job.estimatedCost / averageRate : 0;
      return { job, entries, hours, cost, budgetHours, budgetCost: job.estimatedCost };
    }).filter(summary => summary.entries.length > 0);
  }, [jobs, enrichedEntries, workers]);

  const mostExpensiveJob = [...jobLaborSummaries].sort((a, b) => b.cost - a.cost)[0];

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, { label: string; entries: EnrichedEntry[]; jobId?: string }>();
    filteredEntries.forEach(entry => {
      const key = groupMode === 'job' ? entry.jobId : groupMode === 'worker' ? entry.workerId : groupMode === 'date' ? entry.date : 'all';
      const label = groupMode === 'job' ? entry.jobName : groupMode === 'worker' ? entry.workerName : groupMode === 'date' ? formatDate(entry.date) : 'Entries';
      const existing = groups.get(key) || { label, entries: [], jobId: groupMode === 'job' ? entry.jobId : undefined };
      existing.entries.push(entry);
      groups.set(key, existing);
    });
    return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
  }, [filteredEntries, groupMode]);

  const alerts = useMemo(() => {
    const highOvertimeWorkers = workers.map(worker => {
      const hours = enrichedEntries
        .filter(entry => entry.workerId === worker.id && entry.overtime && new Date(entry.date) >= weekRange.start && new Date(entry.date) <= weekRange.end)
        .reduce((sum, entry) => sum + Math.max(0, entry.totalHours - 8), 0);
      return { worker, hours };
    }).filter(item => item.hours >= 4);

    const laborOverages = jobLaborSummaries.filter(summary => summary.budgetCost > 0 && summary.cost > summary.budgetCost);
    const activeJobsMissingTime = jobs.filter(job => ['active', 'scheduled'].includes(job.status) && !enrichedEntries.some(entry => entry.jobId === job.id && entry.date === today()));

    return [
      ...highOvertimeWorkers.slice(0, 2).map(item => ({ title: 'Overtime spike', detail: `${item.worker.name} has ${item.hours.toFixed(1)} overtime hours this week.` })),
      ...laborOverages.slice(0, 2).map(item => ({ title: 'Labor overage', detail: `${item.job.name} is over by ${formatCurrency(item.cost - item.budgetCost)}.` })),
      ...(activeJobsMissingTime.length > 0 ? [{ title: 'Missing time entries', detail: `${activeJobsMissingTime.length} active or scheduled job${activeJobsMissingTime.length === 1 ? '' : 's'} have no time logged today.` }] : []),
    ];
  }, [workers, enrichedEntries, weekRange, jobLaborSummaries, jobs]);

  const calculateHours = (startTime: string, endTime: string) => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    return (endH + endM / 60) - (startH + startM / 60);
  };

  const addEntryFromForm = (data = formData, successMessage = 'Time entry added') => {
    if (!data.jobId || !data.workerId) {
      showToast('Select job and worker', 'error');
      return false;
    }
    const hours = calculateHours(data.startTime, data.endTime);
    if (hours <= 0) {
      showToast('End time must be after start time', 'error');
      return false;
    }

    addTimeEntry({
      jobId: data.jobId,
      workerId: data.workerId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      totalHours: hours,
      overtime: hours > 8,
      notes: data.notes,
    });
    showToast(successMessage);
    return true;
  };

  const handleSave = () => {
    if (addEntryFromForm()) {
      setShowModal(false);
      setFormData({ jobId: '', workerId: '', date: today(), startTime: '07:00', endTime: '16:00', notes: '' });
    }
  };

  const handleQuickSave = () => {
    addEntryFromForm(formData, 'Quick time entry saved');
  };

  const repeatLastEntry = () => {
    const last = [...timeEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (!last) {
      showToast('No previous entry to repeat', 'error');
      return;
    }
    addTimeEntry({
      jobId: last.jobId,
      workerId: last.workerId,
      date: today(),
      startTime: last.startTime,
      endTime: last.endTime,
      totalHours: last.totalHours,
      overtime: last.overtime,
      notes: last.notes,
    });
    showToast('Last entry repeated for today');
  };

  const copyPreviousDay = () => {
    const previous = new Date();
    previous.setDate(previous.getDate() - 1);
    const previousDate = previous.toISOString().split('T')[0];
    const previousEntries = timeEntries.filter(entry => entry.date === previousDate);
    if (previousEntries.length === 0) {
      showToast('No entries found for previous day', 'error');
      return;
    }
    previousEntries.forEach(entry => {
      addTimeEntry({
        jobId: entry.jobId,
        workerId: entry.workerId,
        date: today(),
        startTime: entry.startTime,
        endTime: entry.endTime,
        totalHours: entry.totalHours,
        overtime: entry.overtime,
        notes: entry.notes,
      });
    });
    showToast(`Copied ${previousEntries.length} previous day entries`);
  };

  const startInlineEdit = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setEditForm({
      startTime: entry.startTime,
      endTime: entry.endTime || entry.startTime,
      totalHours: entry.totalHours.toString(),
      notes: entry.notes || '',
    });
  };

  const saveInlineEdit = (entry: TimeEntry) => {
    const calculatedHours = calculateHours(editForm.startTime, editForm.endTime);
    const totalHours = parseFloat(editForm.totalHours) || calculatedHours;
    if (totalHours <= 0) {
      showToast('Hours must be greater than zero', 'error');
      return;
    }
    updateTimeEntry(entry.id, {
      startTime: editForm.startTime,
      endTime: editForm.endTime,
      totalHours,
      overtime: totalHours > 8,
      notes: editForm.notes,
    });
    setEditingId(null);
    showToast('Time entry updated');
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteTimeEntry(deleteId);
      showToast('Entry deleted');
      setDeleteId(null);
    }
  };

  return (
    <div className="time-command-page">
      <div className="time-command-header">
        <div>
          <div className="page-eyebrow">Field Team</div>
          <h1 className="page-title">Time Entries</h1>
          <p className="page-subtitle">Track labor hours, cost impact, and job efficiency in real time.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Entry
        </button>
      </div>

      <div className="time-kpi-grid">
        <Kpi icon={Clock} label="Total Hours" value={totalHours.toFixed(1)} sub={`${filteredEntries.length} visible entries`} />
        <Kpi icon={DollarSign} label="Total Cost" value={formatCurrency(totalCost)} sub="Filtered labor cost" />
        <Kpi icon={CalendarDays} label="Entries" value={filteredEntries.length.toString()} sub={`${timeEntries.length} all-time`} />
        <Kpi icon={Users} label="Avg Hours per Job" value={averageHoursPerJob.toFixed(1)} sub="Across jobs with labor" />
        <Kpi icon={AlertTriangle} label="OT Hours This Week" value={overtimeThisWeek.toFixed(1)} sub="Hours above 8 per entry" tone={overtimeThisWeek > 0 ? 'warning' : undefined} />
        <Kpi icon={UserRound} label="Most Expensive Job" value={mostExpensiveJob ? formatCurrency(mostExpensiveJob.cost) : '$0'} sub={mostExpensiveJob?.job.name || 'No labor yet'} />
      </div>

      {alerts.length > 0 && (
        <div className="time-alert-grid">
          {alerts.map(alert => (
            <div key={`${alert.title}-${alert.detail}`} className="time-alert-card">
              <AlertTriangle size={18} />
              <span><strong>{alert.title}</strong>{alert.detail}</span>
            </div>
          ))}
        </div>
      )}

      <section className="time-quick-add">
        <div>
          <h2>Quick Add</h2>
          <p>Log today&apos;s labor without leaving the command center.</p>
        </div>
        <div className="time-quick-grid">
          <select value={formData.workerId} onChange={event => setFormData({ ...formData, workerId: event.target.value })}>
            <option value="">Worker</option>
            {workers.filter(worker => worker.status === 'active').map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
          </select>
          <select value={formData.jobId} onChange={event => setFormData({ ...formData, jobId: event.target.value })}>
            <option value="">Job</option>
            {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
          </select>
          <input type="date" value={formData.date} onChange={event => setFormData({ ...formData, date: event.target.value })} />
          <input type="time" value={formData.startTime} onChange={event => setFormData({ ...formData, startTime: event.target.value })} />
          <input type="time" value={formData.endTime} onChange={event => setFormData({ ...formData, endTime: event.target.value })} />
          <input value={formData.notes} onChange={event => setFormData({ ...formData, notes: event.target.value })} placeholder="Notes" />
        </div>
        <div className="time-quick-actions">
          <button className="btn btn-primary" onClick={handleQuickSave}><Save size={16} /> One-Click Save</button>
          <button className="btn btn-secondary" onClick={repeatLastEntry}><RotateCcw size={16} /> Repeat Last Entry</button>
          <button className="btn btn-secondary" onClick={copyPreviousDay}><Copy size={16} /> Copy Previous Day</button>
        </div>
      </section>

      <div className="time-controls">
        <div className="time-search">
          <Search size={18} />
          <input placeholder="Search jobs, workers, notes..." value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        <select value={jobFilter} onChange={event => setJobFilter(event.target.value)}>
          <option value="">All Jobs</option>
          {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
        </select>
        <select value={workerFilter} onChange={event => setWorkerFilter(event.target.value)}>
          <option value="">All Workers</option>
          {workers.map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} />
      </div>

      <div className="time-filter-row">
        {(['all', 'this_week', 'last_7', 'overtime'] as DatePreset[]).map(preset => (
          <button key={preset} className={datePreset === preset ? 'is-active' : ''} onClick={() => setDatePreset(preset)}>
            {preset === 'all' ? 'All Dates' : preset === 'this_week' ? 'This Week' : preset === 'last_7' ? 'Last 7 Days' : 'Overtime Only'}
          </button>
        ))}
      </div>

      <div className="time-group-toggle">
        <span>Group</span>
        {(['none', 'job', 'worker', 'date'] as GroupMode[]).map(mode => (
          <button key={mode} className={groupMode === mode ? 'is-active' : ''} onClick={() => setGroupMode(mode)}>
            {mode === 'none' ? 'None' : mode === 'job' ? 'By Job' : mode === 'worker' ? 'By Worker' : 'By Date'}
          </button>
        ))}
      </div>

      <section className="time-table-card">
        {groupMode === 'none' ? (
          <TimeTable
            entries={filteredEntries}
            jobs={jobs}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            onEdit={startInlineEdit}
            onSave={saveInlineEdit}
            onCancel={() => setEditingId(null)}
            onDelete={setDeleteId}
          />
        ) : (
          <div className="time-groups">
            {groupedEntries.length === 0 ? <div className="time-empty">No entries</div> : groupedEntries.map(group => {
              const hours = group.entries.reduce((sum, entry) => sum + entry.totalHours, 0);
              const cost = group.entries.reduce((sum, entry) => sum + entry.laborCost, 0);
              const jobSummary = group.jobId ? jobLaborSummaries.find(summary => summary.job.id === group.jobId) : undefined;
              const overHours = jobSummary && jobSummary.budgetHours > 0 ? hours - jobSummary.budgetHours : 0;
              const overCost = jobSummary ? cost - jobSummary.budgetCost : 0;
              return (
                <div key={group.key} className="time-group-card">
                  <div className="time-group-header">
                    <div>
                      <h3>{group.label}</h3>
                      <p>{group.entries.length} entries • {hours.toFixed(1)} hours • {formatCurrency(cost)}</p>
                    </div>
                    {jobSummary && (
                      <div className="time-budget-pill">
                        <span>Budget vs actual labor</span>
                        <strong>{formatCurrency(cost)} / {formatCurrency(jobSummary.budgetCost)}</strong>
                      </div>
                    )}
                  </div>
                  {jobSummary && overCost > 0 && (
                    <div className="time-overage-warning">
                      <AlertTriangle size={16} /> Over budget by {Math.max(0, overHours).toFixed(1)} hours / {formatCurrency(overCost)}
                    </div>
                  )}
                  <TimeTable
                    entries={group.entries}
                    jobs={jobs}
                    editingId={editingId}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    onEdit={startInlineEdit}
                    onSave={saveInlineEdit}
                    onCancel={() => setEditingId(null)}
                    onDelete={setDeleteId}
                    compact
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

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

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub: string; tone?: 'warning' }) {
  return (
    <div className={`time-kpi-card ${tone || ''}`}>
      <div className="time-kpi-icon"><Icon size={18} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function TimeTable({
  entries,
  jobs,
  editingId,
  editForm,
  setEditForm,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  compact,
}: {
  entries: EnrichedEntry[];
  jobs: { id: string; name: string; estimatedCost: number }[];
  editingId: string | null;
  editForm: { startTime: string; endTime: string; totalHours: string; notes: string };
  setEditForm: (form: { startTime: string; endTime: string; totalHours: string; notes: string }) => void;
  onEdit: (entry: TimeEntry) => void;
  onSave: (entry: TimeEntry) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  if (entries.length === 0) return <div className="time-empty">No entries</div>;

  return (
    <div className={`time-table-wrap ${compact ? 'compact' : ''}`}>
      <table className="time-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Job</th>
            <th>Worker</th>
            <th>Time Range</th>
            <th>Hours</th>
            <th>Cost</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => {
            const isEditing = editingId === entry.id;
            const job = jobs.find(item => item.id === entry.jobId);
            return (
              <tr key={entry.id} className={entry.overtime ? 'is-overtime' : ''}>
                <td data-label="Date">{formatDate(entry.date)}</td>
                <td data-label="Job"><Link to={`/jobs/${entry.jobId}`}>{entry.jobName}</Link></td>
                <td data-label="Worker">{entry.workerName}</td>
                <td data-label="Time Range">
                  {isEditing ? (
                    <div className="time-inline-pair">
                      <input type="time" value={editForm.startTime} onChange={event => setEditForm({ ...editForm, startTime: event.target.value })} />
                      <input type="time" value={editForm.endTime} onChange={event => setEditForm({ ...editForm, endTime: event.target.value })} />
                    </div>
                  ) : `${formatTime(entry.startTime)} - ${entry.endTime ? formatTime(entry.endTime) : 'Active'}`}
                </td>
                <td data-label="Hours">
                  {isEditing ? <input className="time-inline-hours" type="number" value={editForm.totalHours} onChange={event => setEditForm({ ...editForm, totalHours: event.target.value })} /> : <>{entry.totalHours.toFixed(1)}h {entry.overtime && <span className="badge badge-red">Overtime</span>}</>}
                </td>
                <td data-label="Cost">{formatCurrency(entry.laborCost)}</td>
                <td data-label="Notes" className="time-notes-cell">
                  {isEditing ? <input value={editForm.notes} onChange={event => setEditForm({ ...editForm, notes: event.target.value })} /> : <span>{entry.notes || 'No notes'}</span>}
                  {!isEditing && <div className="time-row-detail">Rate: {formatCurrency(entry.workerRate)}/hr • Job labor budget reference: {formatCurrency(job?.estimatedCost || 0)}</div>}
                </td>
                <td data-label="Actions">
                  <div className="time-row-actions">
                    {isEditing ? (
                      <>
                        <button className="btn btn-sm btn-secondary btn-icon" onClick={() => onSave(entry)}><Save size={14} /></button>
                        <button className="btn btn-sm btn-secondary btn-icon" onClick={onCancel}><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-sm btn-secondary btn-icon" onClick={() => onEdit(entry)}><Edit3 size={14} /></button>
                        <button className="btn btn-sm btn-danger btn-icon" onClick={() => onDelete(entry.id)}><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
