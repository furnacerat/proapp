import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Hammer,
  MapPin,
  PackagePlus,
  Plus,
  StickyNote,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import { formatDate } from '../utils/formatters';
import type { Photo, ShoppingListItemCategory, Task } from '../data/types';

const todayString = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toTimeString().slice(0, 5);

const workerMatchesProfile = (worker: { id: string; email?: string }, profileEmail?: string, profileWorkerId?: string | null) =>
  worker.id === profileWorkerId || Boolean(profileEmail && worker.email?.toLowerCase() === profileEmail.toLowerCase());

export function FieldMode() {
  const {
    jobs,
    workers,
    tasks,
    timeEntries,
    shoppingLists,
    punchLists,
    photos,
    updateTask,
    addTimeEntry,
    addJobLog,
    addNote,
    addPhoto,
    addPunchListItem,
    updatePunchListItem,
    addShoppingList,
    addShoppingListItem,
  } = useApp();
  const { profile, role } = useAuth();
  const { showToast } = useToast();
  const today = todayString();

  const matchedWorker = workers.find(worker => workerMatchesProfile(worker, profile?.email, profile?.worker_id));
  const [selectedWorkerId, setSelectedWorkerId] = useState(matchedWorker?.id || workers[0]?.id || '');
  const selectedWorker = workers.find(worker => worker.id === selectedWorkerId);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [timeHours, setTimeHours] = useState('8');
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd, setTimeEnd] = useState('16:00');
  const [fieldNote, setFieldNote] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [materialQty, setMaterialQty] = useState('1');
  const [punchText, setPunchText] = useState('');
  const [photoCategory, setPhotoCategory] = useState<Photo['category']>('progress');

  const selectedJob = jobs.find(job => job.id === selectedJobId);
  const workerTaskJobIds = new Set(tasks.filter(task => task.assignedTo === selectedWorkerId).map(task => task.jobId).filter(Boolean));
  const fieldJobs = useMemo(() => {
    const activeStatuses = ['approved', 'scheduled', 'active', 'awaiting_materials'];
    return jobs
      .filter(job => activeStatuses.includes(job.status) || workerTaskJobIds.has(job.id))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [jobs, workerTaskJobIds]);

  const activeJobId = selectedJobId || fieldJobs[0]?.id || '';
  const activeJob = jobs.find(job => job.id === activeJobId);

  const visibleTasks = useMemo(() => {
    const relevant = selectedWorkerId
      ? tasks.filter(task => task.assignedTo === selectedWorkerId || task.assignmentRole === 'worker' && !task.assignedTo)
      : tasks;
    return relevant
      .filter(task => task.status !== 'done')
      .filter(task => !activeJobId || task.jobId === activeJobId || !task.jobId)
      .sort((a, b) => {
        const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
        if (priorityRank[a.priority] !== priorityRank[b.priority]) return priorityRank[a.priority] - priorityRank[b.priority];
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      });
  }, [activeJobId, selectedWorkerId, tasks]);

  const todaysHours = timeEntries
    .filter(entry => entry.date === today && (!selectedWorkerId || entry.workerId === selectedWorkerId))
    .reduce((sum, entry) => sum + entry.totalHours, 0);
  const openPunchItems = punchLists.filter(item => item.status !== 'done' && (!activeJobId || item.jobId === activeJobId));
  const jobPhotos = photos.filter(photo => photo.jobId === activeJobId).slice(-6).reverse();

  const completeTask = (task: Task) => {
    updateTask(task.id, { status: 'done' });
    showToast('Task marked complete');
  };

  const logTime = () => {
    if (!activeJob || !selectedWorker) {
      showToast('Select a job and worker before logging time', 'error');
      return;
    }
    const hours = Number(timeHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      showToast('Enter valid hours', 'error');
      return;
    }
    addTimeEntry({
      jobId: activeJob.id,
      workerId: selectedWorker.id,
      workerName: selectedWorker.name,
      date: today,
      startTime: timeStart || nowTime(),
      endTime: timeEnd || undefined,
      totalHours: hours,
      hours,
      overtime: hours > 8,
      notes: `Field mode quick log for ${activeJob.name}`,
    });
    showToast('Time logged');
  };

  const saveFieldNote = () => {
    if (!activeJob || !fieldNote.trim()) {
      showToast('Choose a job and enter a note', 'error');
      return;
    }
    addNote({ jobId: activeJob.id, content: fieldNote.trim() });
    addJobLog({
      jobId: activeJob.id,
      date: today,
      workCompleted: fieldNote.trim(),
      workers: selectedWorker ? [selectedWorker.name] : [],
      issues: '',
      notes: 'Added from Field Mode',
      hoursWorked: 0,
    });
    setFieldNote('');
    showToast('Field note saved');
  };

  const requestMaterial = () => {
    if (!activeJob || !materialName.trim()) {
      showToast('Choose a job and enter the material needed', 'error');
      return;
    }
    const openList = shoppingLists.find(list => list.jobId === activeJob.id && ['open', 'shopping'].includes(list.status));
    const item = {
      name: materialName.trim(),
      category: 'material' as ShoppingListItemCategory,
      quantity: Number(materialQty) || 1,
      unit: 'ea',
      purchased: false,
      urgent: true,
      notes: 'Requested from Field Mode',
    };
    if (openList) {
      addShoppingListItem(openList.id, item);
    } else {
      addShoppingList({
        jobId: activeJob.id,
        jobName: activeJob.name,
        title: `${activeJob.name} field needs`,
        status: 'open',
        notes: 'Created from Field Mode',
        items: [{ ...item, id: crypto.randomUUID() }],
      });
    }
    setMaterialName('');
    setMaterialQty('1');
    showToast('Material request added');
  };

  const addPunchItem = () => {
    if (!activeJob || !punchText.trim()) {
      showToast('Choose a job and describe the punch item', 'error');
      return;
    }
    addPunchListItem({
      jobId: activeJob.id,
      description: punchText.trim(),
      status: 'open',
    });
    setPunchText('');
    showToast('Punch item added');
  };

  const handlePhoto = (file?: File) => {
    if (!activeJob || !file) {
      showToast('Choose a job and photo first', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      addPhoto({
        jobId: activeJob.id,
        url: String(reader.result),
        description: `${photoCategory} photo added from Field Mode`,
        category: photoCategory,
      });
      showToast('Photo added to job');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="field-mode-page">
      <header className="field-hero">
        <div>
          <span className="field-eyebrow"><Hammer size={15} /> Field Worker Mode</span>
          <h1>Today in the field</h1>
          <p>Fast actions for the jobsite: tasks, time, notes, photos, material needs, and punch work.</p>
        </div>
        <Link className="field-secondary-link" to="/tasks">Open full task board</Link>
      </header>

      <section className="field-control-strip">
        {role !== 'crew' && (
          <label>
            <span>Worker</span>
            <select value={selectedWorkerId} onChange={event => setSelectedWorkerId(event.target.value)}>
              <option value="">All field work</option>
              {workers.map(worker => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
            </select>
          </label>
        )}
        <label>
          <span>Active job</span>
          <select value={activeJobId} onChange={event => setSelectedJobId(event.target.value)}>
            <option value="">All jobs</option>
            {fieldJobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
          </select>
        </label>
      </section>

      <section className="field-kpis">
        <FieldMetric icon={ClipboardCheck} label="Open tasks" value={visibleTasks.length} />
        <FieldMetric icon={Clock} label="Hours today" value={todaysHours.toFixed(1)} />
        <FieldMetric icon={CheckCircle2} label="Open punch" value={openPunchItems.length} />
      </section>

      {!activeJob && (
        <section className="field-empty">
          <Hammer size={30} />
          <h2>No active field job selected</h2>
          <p>Create a real job or assign tasks to a worker, then this mode becomes the daily field cockpit.</p>
          <div>
            <Link className="btn btn-primary" to="/jobs"><Plus size={18} /> Add Job</Link>
            <Link className="btn btn-secondary" to="/tasks"><Plus size={18} /> Assign Task</Link>
          </div>
        </section>
      )}

      {activeJob && (
        <>
          <section className="field-job-card">
            <div>
              <span>{activeJob.status.replace('_', ' ')}</span>
              <h2>{activeJob.name}</h2>
              <p><MapPin size={16} /> {activeJob.address || 'No address saved'}</p>
            </div>
            <Link className="btn btn-secondary" to={`/jobs/${activeJob.id}`}>Job Detail</Link>
          </section>

          <main className="field-grid">
            <section className="field-panel field-tasks-panel">
              <div className="field-panel-head">
                <h2>My Work</h2>
                <span>{visibleTasks.length} open</span>
              </div>
              <div className="field-task-list">
                {visibleTasks.length === 0 ? (
                  <div className="field-soft-empty">No open tasks for this job.</div>
                ) : visibleTasks.slice(0, 8).map(task => (
                  <article key={task.id} className={`field-task-card priority-${task.priority}`}>
                    <div>
                      <strong>{task.title}</strong>
                      <span>{task.dueDate ? formatDate(task.dueDate) : 'No due date'} · {task.priority}</span>
                      {task.description && <p>{task.description}</p>}
                    </div>
                    <button onClick={() => completeTask(task)}><CheckCircle2 size={18} /> Done</button>
                  </article>
                ))}
              </div>
            </section>

            <section className="field-panel">
              <div className="field-panel-head">
                <h2>Quick Time</h2>
                <Clock size={19} />
              </div>
              <div className="field-time-grid">
                <label><span>Start</span><input type="time" value={timeStart} onChange={event => setTimeStart(event.target.value)} /></label>
                <label><span>End</span><input type="time" value={timeEnd} onChange={event => setTimeEnd(event.target.value)} /></label>
                <label><span>Hours</span><input inputMode="decimal" value={timeHours} onChange={event => setTimeHours(event.target.value)} /></label>
              </div>
              <button className="field-primary-action" onClick={logTime}>Log Time</button>
            </section>

            <section className="field-panel">
              <div className="field-panel-head">
                <h2>Field Note</h2>
                <StickyNote size={19} />
              </div>
              <textarea value={fieldNote} onChange={event => setFieldNote(event.target.value)} placeholder="What got done, what changed, what needs attention?" />
              <button className="field-primary-action" onClick={saveFieldNote}>Save Note</button>
            </section>

            <section className="field-panel">
              <div className="field-panel-head">
                <h2>Material Need</h2>
                <PackagePlus size={19} />
              </div>
              <div className="field-material-row">
                <input value={materialName} onChange={event => setMaterialName(event.target.value)} placeholder="Material, supply, or tool" />
                <input value={materialQty} onChange={event => setMaterialQty(event.target.value)} inputMode="decimal" aria-label="Quantity" />
              </div>
              <button className="field-primary-action" onClick={requestMaterial}>Add to Shopping List</button>
            </section>

            <section className="field-panel">
              <div className="field-panel-head">
                <h2>Punch List</h2>
                <ClipboardCheck size={19} />
              </div>
              <div className="field-punch-add">
                <input value={punchText} onChange={event => setPunchText(event.target.value)} placeholder="Add punch item" />
                <button onClick={addPunchItem}><Plus size={18} /></button>
              </div>
              <div className="field-punch-list">
                {openPunchItems.length === 0 ? <div className="field-soft-empty">No open punch items.</div> : openPunchItems.slice(0, 6).map(item => (
                  <button key={item.id} onClick={() => updatePunchListItem(item.id, { status: 'done', completedAt: new Date().toISOString() })}>
                    <span>{item.description}</span>
                    <CheckCircle2 size={17} />
                  </button>
                ))}
              </div>
            </section>

            <section className="field-panel">
              <div className="field-panel-head">
                <h2>Photos</h2>
                <Camera size={19} />
              </div>
              <div className="field-photo-tools">
                <select value={photoCategory} onChange={event => setPhotoCategory(event.target.value as Photo['category'])}>
                  <option value="progress">Progress</option>
                  <option value="before">Before</option>
                  <option value="after">After</option>
                  <option value="issue">Issue</option>
                  <option value="other">Other</option>
                </select>
                <label className="field-file-button">
                  <Camera size={18} />
                  Add Photo
                  <input type="file" accept="image/*" capture="environment" onChange={event => handlePhoto(event.target.files?.[0])} />
                </label>
              </div>
              <div className="field-photo-grid">
                {jobPhotos.length === 0 ? <div className="field-soft-empty">No photos on this job yet.</div> : jobPhotos.map(photo => (
                  <img key={photo.id} src={photo.url} alt={photo.description || photo.category} />
                ))}
              </div>
            </section>
          </main>
        </>
      )}

      {workers.length === 0 && (
        <section className="field-empty small">
          <UserRound size={24} />
          <p>Add workers or subcontractors to make assignment and crew filtering useful.</p>
          <Link className="btn btn-secondary" to="/workers">Open Workers</Link>
        </section>
      )}
    </div>
  );
}

function FieldMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="field-metric">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
