import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Hammer,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  PackagePlus,
  Plus,
  StickyNote,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import { formatDate } from '../utils/formatters';
import type { Photo, ShoppingListItemCategory, Task, Worker } from '../data/types';
import type { UserProfile, UserRole } from '../auth/rbac';

const todayString = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toTimeString().slice(0, 5);

type FieldVoiceIntent = 'log_time' | 'add_daily_log' | 'add_note' | 'request_materials' | 'add_punch_item' | 'complete_task' | 'unknown';

interface FieldVoiceMaterial {
  name: string;
  quantity: number;
  unit: string;
  category: ShoppingListItemCategory;
  urgent: boolean;
  notes: string;
}

interface FieldVoiceDraft {
  intent: FieldVoiceIntent;
  jobId: string;
  taskId: string;
  title: string;
  content: string;
  hours: number;
  startTime: string;
  endTime: string;
  materials: FieldVoiceMaterial[];
  punchItem: string;
  missingFields: string[];
  confidence: number;
  message: string;
  transcript: string;
}

const fieldIntentLabels: Record<FieldVoiceIntent, string> = {
  log_time: 'Log Time',
  add_daily_log: 'Daily Log',
  add_note: 'Field Note',
  request_materials: 'Material Request',
  add_punch_item: 'Punch Item',
  complete_task: 'Complete Task',
  unknown: 'Field Command',
};

const chooseAudioMimeType = () => {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
};

export const workerMatchesProfile = (worker: Worker, profile?: UserProfile | null) =>
  worker.id === profile?.worker_id ||
  Boolean(profile?.email && worker.email?.toLowerCase() === profile.email.toLowerCase()) ||
  Boolean(profile?.user_id && (
    (worker as Worker & { userId?: string; user_id?: string }).userId === profile.user_id ||
    (worker as Worker & { userId?: string; user_id?: string }).user_id === profile.user_id
  ));

export const getFieldModeWorkerId = (workers: Worker[], matchedWorker: Worker | undefined, role: UserRole, selectedWorkerId = '') => {
  if (role === 'crew') return matchedWorker?.id || '';
  if (selectedWorkerId && workers.some(worker => worker.id === selectedWorkerId)) return selectedWorkerId;
  return matchedWorker?.id || workers[0]?.id || '';
};

export function FieldMode() {
  const {
    branding,
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
  const { profile, role, session } = useAuth();
  const { showToast } = useToast();
  const today = todayString();

  const matchedWorker = workers.find(worker => workerMatchesProfile(worker, profile));
  const [selectedWorkerId, setSelectedWorkerId] = useState(() => getFieldModeWorkerId(workers, matchedWorker, role));
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
  const [voiceDraft, setVoiceDraft] = useState<FieldVoiceDraft | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceWorking, setIsVoiceWorking] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setSelectedWorkerId(current => getFieldModeWorkerId(workers, matchedWorker, role, current));
  }, [matchedWorker?.id, role, workers]);

  const selectedJob = jobs.find(job => job.id === selectedJobId);
  const crewNeedsWorkerMatch = role === 'crew' && !matchedWorker;
  const workerTaskJobIds = new Set(tasks.filter(task => task.assignedTo === selectedWorkerId).map(task => task.jobId).filter(Boolean));
  const fieldJobs = useMemo(() => {
    if (crewNeedsWorkerMatch) return [];
    const activeStatuses = ['approved', 'scheduled', 'active', 'awaiting_materials'];
    return jobs
      .filter(job => activeStatuses.includes(job.status) || workerTaskJobIds.has(job.id))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [crewNeedsWorkerMatch, jobs, workerTaskJobIds]);

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
  const canRecordVoice = typeof window !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined';
  const canUseFieldVoice = branding.smartFeaturesEnabled !== false;
  const authHeader = (): Record<string, string> => session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

  const stopVoiceStream = () => {
    voiceStreamRef.current?.getTracks().forEach(track => track.stop());
    voiceStreamRef.current = null;
  };

  useEffect(() => () => stopVoiceStream(), []);

  const completeTask = (task: Task) => {
    updateTask(task.id, { status: 'done' });
    showToast('Task marked complete');
  };

  const logTime = () => {
    if (crewNeedsWorkerMatch) {
      showToast('Your user profile is not linked to a worker. Ask an admin to connect your crew account before logging time.', 'error');
      return;
    }
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

  const parseFieldCommand = async (transcript: string) => {
    const response = await fetch('/api/field/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        transcript,
        activeJobId,
        jobs: fieldJobs.map(job => ({
          id: job.id,
          name: job.name,
          customer: job.customer || '',
          address: job.address || '',
          status: job.status,
        })),
        tasks: visibleTasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description || '',
          jobId: task.jobId || '',
          priority: task.priority,
          dueDate: task.dueDate || '',
        })),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Field command parsing failed');
    setVoiceDraft({ ...(data as Omit<FieldVoiceDraft, 'transcript'>), transcript });
    setVoiceError('');
  };

  const transcribeVoiceBlob = async (blob: Blob) => {
    setIsVoiceWorking(true);
    setVoiceError('');
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm', ...authHeader() },
        body: blob,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Transcription failed');
      if (!data.text?.trim()) throw new Error('I did not catch any speech. Try again closer to the mic.');
      await parseFieldCommand(data.text);
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Voice command failed');
    } finally {
      setIsVoiceWorking(false);
    }
  };

  const startFieldVoice = async () => {
    if (!canUseFieldVoice) {
      setVoiceError('Turn Smart Mode on in Settings to use Field Voice Assistant.');
      return;
    }
    if (crewNeedsWorkerMatch) {
      setVoiceError('Your crew account is not linked to a worker record yet.');
      return;
    }
    if (!canRecordVoice) {
      setVoiceError('Audio recording is not available in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mimeType = chooseAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        setIsVoiceRecording(false);
        stopVoiceStream();
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 1000) void transcribeVoiceBlob(blob);
        else setVoiceError('I did not get enough audio. Hold the mic, speak, then stop.');
      };
      recorder.onerror = () => {
        setIsVoiceRecording(false);
        stopVoiceStream();
        setVoiceError('Recording stopped unexpectedly.');
      };
      mediaRecorderRef.current = recorder;
      voiceStreamRef.current = stream;
      setVoiceDraft(null);
      setVoiceError('');
      setIsVoiceRecording(true);
      recorder.start();
    } catch (error) {
      setIsVoiceRecording(false);
      stopVoiceStream();
      setVoiceError(error instanceof Error ? error.message : 'Microphone access was blocked or unavailable.');
    }
  };

  const stopFieldVoice = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData();
      } catch {
        // Some browsers emit the final data chunk during stop.
      }
      recorder.stop();
    }
  };

  const selectedDraftJob = voiceDraft?.jobId ? jobs.find(job => job.id === voiceDraft.jobId) : activeJob;
  const selectedDraftTask = voiceDraft?.taskId ? tasks.find(task => task.id === voiceDraft.taskId) : undefined;

  const applyVoiceDraft = () => {
    if (!voiceDraft || voiceDraft.intent === 'unknown') {
      setVoiceError('Record a supported field command first.');
      return;
    }
    const draftJob = voiceDraft.jobId ? jobs.find(job => job.id === voiceDraft.jobId) : activeJob;
    const draftWorker = selectedWorker;

    if (['log_time', 'add_daily_log', 'add_note', 'request_materials', 'add_punch_item', 'complete_task'].includes(voiceDraft.intent) && !draftJob) {
      setVoiceError('Choose a job before applying this command.');
      return;
    }

    if (voiceDraft.intent === 'log_time') {
      if (!draftWorker) {
        setVoiceError('Choose a worker before logging time.');
        return;
      }
      const hours = Number(voiceDraft.hours || timeHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        setVoiceError('Add valid hours before logging time.');
        return;
      }
      addTimeEntry({
        jobId: draftJob!.id,
        workerId: draftWorker.id,
        workerName: draftWorker.name,
        date: today,
        startTime: voiceDraft.startTime || timeStart || nowTime(),
        endTime: voiceDraft.endTime || timeEnd || undefined,
        totalHours: hours,
        hours,
        overtime: hours > 8,
        notes: `Logged by Field Voice Assistant from: ${voiceDraft.transcript}`,
      });
      showToast('Voice time logged');
    }

    if (voiceDraft.intent === 'add_daily_log') {
      const content = voiceDraft.content.trim() || voiceDraft.transcript;
      addJobLog({
        jobId: draftJob!.id,
        date: today,
        workCompleted: content,
        workers: draftWorker ? [draftWorker.name] : [],
        issues: '',
        notes: `Created by Field Voice Assistant from: ${voiceDraft.transcript}`,
        hoursWorked: 0,
      });
      addNote({ jobId: draftJob!.id, content });
      showToast('Voice daily log added');
    }

    if (voiceDraft.intent === 'add_note') {
      addNote({ jobId: draftJob!.id, content: voiceDraft.content.trim() || voiceDraft.transcript });
      showToast('Voice note added');
    }

    if (voiceDraft.intent === 'request_materials') {
      if (voiceDraft.materials.length === 0) {
        setVoiceError('Add at least one material before applying this command.');
        return;
      }
      const openList = shoppingLists.find(list => list.jobId === draftJob!.id && ['open', 'shopping'].includes(list.status));
      const listId = openList?.id || addShoppingList({
        jobId: draftJob!.id,
        jobName: draftJob!.name,
        title: `${draftJob!.name} field needs`,
        status: 'open',
        notes: `Created by Field Voice Assistant from: ${voiceDraft.transcript}`,
        items: [],
      });
      voiceDraft.materials.forEach(item => addShoppingListItem(listId, {
        name: item.name,
        category: item.category || 'material',
        quantity: item.quantity || 1,
        unit: item.unit || 'ea',
        purchased: false,
        urgent: item.urgent,
        notes: item.notes || 'Requested by Field Voice Assistant',
      }));
      showToast(`Voice material request added (${voiceDraft.materials.length})`);
    }

    if (voiceDraft.intent === 'add_punch_item') {
      const description = voiceDraft.punchItem.trim() || voiceDraft.content.trim();
      if (!description) {
        setVoiceError('Add a punch item description before applying this command.');
        return;
      }
      addPunchListItem({ jobId: draftJob!.id, description, status: 'open' });
      showToast('Voice punch item added');
    }

    if (voiceDraft.intent === 'complete_task') {
      const task = voiceDraft.taskId ? tasks.find(item => item.id === voiceDraft.taskId) : undefined;
      if (!task) {
        setVoiceError('Choose a task before completing it.');
        return;
      }
      updateTask(task.id, { status: 'done' });
      showToast('Voice task completed');
    }

    if (draftJob?.id && draftJob.id !== activeJobId) setSelectedJobId(draftJob.id);
    setVoiceDraft(null);
    setVoiceError('');
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

      <section className="field-voice-panel">
        <div className="field-voice-main">
          <button
            className={`field-voice-button ${isVoiceRecording ? 'recording' : ''}`}
            onClick={isVoiceRecording ? stopFieldVoice : startFieldVoice}
            disabled={!canUseFieldVoice || isVoiceWorking || crewNeedsWorkerMatch}
          >
            {isVoiceRecording ? <MicOff size={22} /> : isVoiceWorking ? <Loader2 size={22} /> : <Mic size={22} />}
            <span>{isVoiceRecording ? 'Stop Assistant' : isVoiceWorking ? 'Working...' : canUseFieldVoice ? 'Field Voice Assistant' : 'Smart Mode Off'}</span>
          </button>
          <div>
            <h2>{voiceDraft ? fieldIntentLabels[voiceDraft.intent] : 'Run field work by voice'}</h2>
            <p>Log time, save job notes, request materials, add punch items, or complete a visible task for the active job.</p>
          </div>
        </div>

        {!canUseFieldVoice && <div className="field-voice-notice">Turn Smart Mode on in Settings to use Field Voice Assistant.</div>}
        {voiceError && <div className="field-voice-notice">{voiceError}</div>}

        {voiceDraft && (
          <div className="field-voice-draft">
            <div className="field-voice-draft-head">
              <div>
                <span>{Math.round((voiceDraft.confidence || 0) * 100)}% confidence</span>
                <strong>{voiceDraft.message || fieldIntentLabels[voiceDraft.intent]}</strong>
              </div>
              <button className="field-voice-clear" onClick={() => { setVoiceDraft(null); setVoiceError(''); }} aria-label="Clear voice draft">
                <X size={17} />
              </button>
            </div>

            <textarea
              value={voiceDraft.transcript}
              onChange={event => setVoiceDraft({ ...voiceDraft, transcript: event.target.value })}
              aria-label="Voice transcript"
            />

            <div className="field-voice-review-grid">
              <label>
                <span>Job</span>
                <select value={voiceDraft.jobId || activeJobId} onChange={event => setVoiceDraft({ ...voiceDraft, jobId: event.target.value })}>
                  <option value="">Choose job...</option>
                  {fieldJobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
                </select>
              </label>

              {voiceDraft.intent === 'complete_task' && (
                <label>
                  <span>Task</span>
                  <select value={voiceDraft.taskId} onChange={event => setVoiceDraft({ ...voiceDraft, taskId: event.target.value })}>
                    <option value="">Choose task...</option>
                    {visibleTasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}
                  </select>
                </label>
              )}

              {voiceDraft.intent === 'log_time' && (
                <>
                  <label><span>Hours</span><input inputMode="decimal" value={voiceDraft.hours || ''} onChange={event => setVoiceDraft({ ...voiceDraft, hours: Number(event.target.value) || 0 })} /></label>
                  <label><span>Start</span><input type="time" value={voiceDraft.startTime || timeStart} onChange={event => setVoiceDraft({ ...voiceDraft, startTime: event.target.value })} /></label>
                  <label><span>End</span><input type="time" value={voiceDraft.endTime || timeEnd} onChange={event => setVoiceDraft({ ...voiceDraft, endTime: event.target.value })} /></label>
                </>
              )}
            </div>

            {['add_daily_log', 'add_note'].includes(voiceDraft.intent) && (
              <label className="field-voice-full">
                <span>Content</span>
                <textarea value={voiceDraft.content} onChange={event => setVoiceDraft({ ...voiceDraft, content: event.target.value })} />
              </label>
            )}

            {voiceDraft.intent === 'add_punch_item' && (
              <label className="field-voice-full">
                <span>Punch item</span>
                <input value={voiceDraft.punchItem} onChange={event => setVoiceDraft({ ...voiceDraft, punchItem: event.target.value })} />
              </label>
            )}

            {voiceDraft.intent === 'request_materials' && (
              <div className="field-voice-items">
                {voiceDraft.materials.length === 0 ? (
                  <div className="field-soft-empty">No material items detected.</div>
                ) : voiceDraft.materials.map((item, index) => (
                  <div key={`${item.name}-${index}`}>
                    <strong>{item.name}</strong>
                    <span>{item.quantity || 1} {item.unit || 'ea'} / {item.category}</span>
                  </div>
                ))}
              </div>
            )}

            {voiceDraft.missingFields.length > 0 && (
              <div className="field-voice-notice">Needs: {voiceDraft.missingFields.join(', ')}</div>
            )}

            <div className="field-voice-summary">
              <span>{selectedDraftJob?.name || 'No job selected'}</span>
              {selectedDraftTask && <span>{selectedDraftTask.title}</span>}
            </div>
            <button className="field-primary-action" onClick={applyVoiceDraft} disabled={voiceDraft.intent === 'unknown'}>
              Apply {fieldIntentLabels[voiceDraft.intent]}
            </button>
          </div>
        )}
      </section>

      {crewNeedsWorkerMatch && (
        <section className="field-empty small">
          <UserRound size={24} />
          <p>Your crew account is not linked to a worker record yet. Ask an admin to connect your profile before logging time.</p>
          <Link className="btn btn-secondary" to="/tasks">Open Tasks</Link>
        </section>
      )}

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
