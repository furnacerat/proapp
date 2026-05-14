import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ClipboardList, Loader2, Mic, MicOff, ShoppingCart, X } from 'lucide-react';
import { canAccessRoute } from '../../auth/rbac';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { EstimateLineCategory, EstimateLineItem, Job, Priority, ShoppingListItemCategory } from '../../data/types';
import { useToast } from '../common/Toast';

type VoiceIntent =
  | 'create_shopping_list'
  | 'create_task'
  | 'add_daily_log'
  | 'add_note'
  | 'add_photo_note'
  | 'add_estimate_item'
  | 'open_job'
  | 'open_customer'
  | 'schedule_follow_up'
  | 'unknown';

interface AssistantDraft {
  intent: VoiceIntent;
  jobId: string;
  customerId: string;
  estimateId: string;
  title: string;
  content: string;
  dueDate: string;
  priority: Priority;
  shoppingListMode: 'new' | 'append' | 'ask';
  sourceText: string;
  itemsText: string;
  items: ParsedShoppingItem[];
  estimateItem: ParsedEstimateItem;
  missingFields: string[];
  message?: string;
  confidence?: number;
}

interface ParsedShoppingItem {
  name: string;
  quantity: number;
  unit: string;
  category: ShoppingListItemCategory;
  urgent: boolean;
  notes: string;
}

interface ParsedEstimateItem {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  category: EstimateLineCategory;
}

interface ParsedVoiceCommand {
  intent: VoiceIntent;
  jobId: string;
  jobName: string;
  customerId: string;
  customerName: string;
  estimateId: string;
  title: string;
  content: string;
  dueDate: string;
  priority: Priority;
  shoppingListMode: 'new' | 'append' | 'ask';
  items: ParsedShoppingItem[];
  estimateItem: ParsedEstimateItem;
  missingFields: string[];
  confidence: number;
  message: string;
}

const commandIncludesShoppingList = (text: string) =>
  /\b(shopping\s+list|shopping|material\s+list|supply\s+list|hardware\s+list|buy\s+list)\b/i.test(text);

const normalizeText = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();

const findJobFromCommand = (text: string, jobs: Job[]) => {
  const normalized = normalizeText(text);
  const ranked = jobs
    .map(job => {
      const tokens = [job.name, job.address || '', job.customer || ''].map(normalizeText).filter(Boolean);
      const score = tokens.reduce((best, token) => {
        if (normalized.includes(token)) return Math.max(best, token.length);
        const words = token.split(' ').filter(word => word.length > 2);
        const matched = words.filter(word => normalized.includes(word)).length;
        return Math.max(best, matched >= Math.min(2, words.length) ? matched * 4 : 0);
      }, 0);
      return { job, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.job || null;
};

const cleanItemText = (text: string) => text
  .replace(/\b(?:create|make|start|new|build|add|please|a|an|the|shopping list|shopping|material list|supply list|hardware list|buy list)\b/ig, ' ')
  .replace(/\b(?:for|on|at|to)\s+[a-z0-9\s-]+?\b(?:with|including|include|needs?|items?|materials?|supplies?)\b/ig, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const extractItemsText = (text: string, job?: Job | null) => {
  const markers = [
    /\b(?:with|including|include|add|needs?|materials?|supplies?|items?)\b\s*(.+)$/i,
    /\b(?:shopping\s+list|material\s+list|supply\s+list|hardware\s+list)\b\s*(?:for\s+.+?)?\s*(.+)$/i,
  ];
  const match = markers.map(pattern => text.match(pattern)?.[1]).find(Boolean);
  let items = match || text;
  if (job) {
    [job.name, job.address, job.customer].filter(Boolean).forEach(value => {
      items = items.replace(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
    });
  }
  return cleanItemText(items);
};

const parseShoppingItems = (itemsText: string) => itemsText
  .split(/\n|,|;|\band\b|\bplus\b|\bthen\b/i)
  .map(item => item.replace(/^\s*(?:and|plus|then|also|with)\s+/i, '').trim())
  .filter(item => item.length > 1 && !/^(for|with|including|include|items?|materials?|supplies?)$/i.test(item));

const inferCategory = (item: string): ShoppingListItemCategory => {
  const text = item.toLowerCase();
  if (/\b(screw|nail|bolt|washer|hinge|knob|pull|anchor|bracket|fastener|hardware)\b/.test(text)) return 'hardware';
  if (/\b(blade|bit|saw|drill|tool|brush|roller|ladder)\b/.test(text)) return 'tool';
  if (/\b(rent|rental|lift|scaffold|trailer|auger)\b/.test(text)) return 'rental';
  if (/\b(tape|plastic|drop cloth|caulk|glue|adhesive|cleaner|bags?)\b/.test(text)) return 'supply';
  return 'material';
};

const parseQuantity = (item: string) => {
  const match = item.match(/^\s*(\d+(?:\.\d+)?)\s*(bags?|boxes?|sheets?|pieces?|pcs|each|ea|ft|lf|sq\s*ft|gallons?|gal|tubes?|rolls?)?\s+(.+)$/i);
  if (!match) return { name: item.trim(), quantity: 1, unit: 'ea' };
  return {
    name: match[3].trim(),
    quantity: Number(match[1]) || 1,
    unit: match[2]?.toLowerCase().replace(/^each$/, 'ea') || 'ea',
  };
};

const itemToText = (item: ParsedShoppingItem) => {
  const quantity = item.quantity && item.quantity !== 1 ? `${item.quantity} ` : '';
  const unit = item.unit && item.unit !== 'ea' ? `${item.unit} ` : '';
  return `${quantity}${unit}${item.name}`.trim();
};

const chooseAudioMimeType = () => {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
};

const blankEstimateItem: ParsedEstimateItem = {
  name: '',
  description: '',
  quantity: 1,
  unit: 'ea',
  unitPrice: 0,
  category: 'material',
};

const intentLabels: Record<VoiceIntent, string> = {
  create_shopping_list: 'Shopping List',
  create_task: 'Task',
  add_daily_log: 'Daily Log',
  add_note: 'Job Note',
  add_photo_note: 'Photo Note',
  add_estimate_item: 'Estimate Item',
  open_job: 'Open Job',
  open_customer: 'Open Customer',
  schedule_follow_up: 'Follow-up',
  unknown: 'Voice Command',
};

export function GlobalVoiceAssistant() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { profile, role, session } = useAuth();
  const {
    jobs,
    customers,
    estimates,
    shoppingLists,
    addShoppingList,
    addShoppingListItem,
    addTask,
    addNote,
    addJobLog,
    updateEstimate,
  } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canRecord = typeof window !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined';
  const canUseAssistant = profile?.active !== false && [
    '/shopping-lists',
    '/tasks',
    '/jobs',
    '/customers',
    '/estimates',
    '/schedule',
  ].some(route => canAccessRoute(role, route));

  const openJobs = useMemo(() => jobs.filter(job => !['completed', 'closed'].includes(job.status)), [jobs]);
  const selectedJob = draft?.jobId ? jobs.find(job => job.id === draft.jobId) || null : null;
  const selectedCustomer = draft?.customerId ? customers.find(customer => customer.id === draft.customerId) || null : null;
  const selectedEstimate = draft?.estimateId ? estimates.find(estimate => estimate.id === draft.estimateId) || null : null;
  const openShoppingList = selectedJob
    ? shoppingLists.find(list => list.jobId === selectedJob.id && ['open', 'shopping'].includes(list.status))
    : undefined;
  const parsedItems = useMemo(
    () => draft?.items?.length ? draft.items.map(itemToText) : parseShoppingItems(draft?.itemsText || ''),
    [draft?.items, draft?.itemsText],
  );

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  const authHeader = () => session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

  const canRunIntent = (intent: VoiceIntent) => {
    if (intent === 'create_shopping_list') return canAccessRoute(role, '/shopping-lists');
    if (intent === 'create_task' || intent === 'schedule_follow_up') return canAccessRoute(role, '/tasks');
    if (intent === 'add_note' || intent === 'add_photo_note' || intent === 'add_daily_log' || intent === 'open_job') return canAccessRoute(role, '/jobs');
    if (intent === 'open_customer') return canAccessRoute(role, '/customers');
    if (intent === 'add_estimate_item') return canAccessRoute(role, '/estimates');
    return false;
  };

  const emptyDraft = (text: string, intent: VoiceIntent): AssistantDraft => {
    const job = findJobFromCommand(text, jobs);
    const linkedEstimate = job?.estimateId ? estimates.find(estimate => estimate.id === job.estimateId) : undefined;
    return {
      intent,
      jobId: job?.id || '',
      customerId: job?.customerId || '',
      estimateId: linkedEstimate?.id || '',
      title: intentLabels[intent],
      content: text,
      dueDate: '',
      priority: 'medium',
      shoppingListMode: 'ask',
      sourceText: text,
      itemsText: intent === 'create_shopping_list' ? extractItemsText(text, job) : '',
      items: [],
      estimateItem: blankEstimateItem,
      missingFields: [],
    };
  };

  const buildFallbackDraft = (text: string): AssistantDraft => {
    if (commandIncludesShoppingList(text)) {
      const fallback = emptyDraft(text, 'create_shopping_list');
      const job = fallback.jobId ? jobs.find(item => item.id === fallback.jobId) : undefined;
      return { ...fallback, title: job ? `${job.name} Shopping List` : 'Job Shopping List' };
    }
    return { ...emptyDraft(text, 'unknown'), message: 'Try a command like "create a task", "add a daily log", "open Smith job", or "create a shopping list".' };
  };

  const updateDraftFromText = (text: string) => {
    const fallbackDraft = buildFallbackDraft(text);
    setDraft(fallbackDraft);
    setError(fallbackDraft.intent === 'unknown' ? 'I could not match that to a supported assistant action yet.' : '');
  };

  const parseCommand = async (text: string): Promise<ParsedVoiceCommand | null> => {
    const response = await fetch('/api/voice/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        transcript: text,
        jobs: jobs.map(job => ({
          id: job.id,
          name: job.name,
          customer: job.customer || '',
          customerId: job.customerId || '',
          address: job.address || '',
          status: job.status,
          estimateId: job.estimateId || '',
        })),
        customers: customers.map(customer => ({
          id: customer.id,
          name: customer.name,
          company: customer.company || '',
          address: customer.address || '',
        })),
        estimates: estimates.map(estimate => ({
          id: estimate.id,
          estimateNumber: estimate.estimateNumber,
          name: estimate.name,
          customerId: estimate.customerId,
          status: estimate.status,
        })),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Command parsing failed');
    return data as ParsedVoiceCommand;
  };

  const updateDraftFromCommand = (text: string, command: ParsedVoiceCommand | null) => {
    if (!command || command.intent === 'unknown') {
      updateDraftFromText(text);
      return;
    }
    const fallbackDraft = buildFallbackDraft(text);
    const job = command.jobId ? jobs.find(item => item.id === command.jobId) : null;
    const jobEstimate = job?.estimateId ? estimates.find(estimate => estimate.id === job.estimateId) : undefined;
    const nextDraft: AssistantDraft = {
      ...fallbackDraft,
      intent: command.intent,
      jobId: command.jobId || fallbackDraft.jobId,
      customerId: command.customerId || job?.customerId || fallbackDraft.customerId,
      estimateId: command.estimateId || jobEstimate?.id || fallbackDraft.estimateId,
      title: command.title || fallbackDraft.title,
      content: command.content || fallbackDraft.content,
      dueDate: command.dueDate || '',
      priority: command.priority || 'medium',
      shoppingListMode: command.shoppingListMode || 'ask',
      itemsText: command.items.length ? command.items.map(itemToText).join(', ') : fallbackDraft.itemsText,
      items: command.items,
      estimateItem: command.estimateItem?.name ? command.estimateItem : fallbackDraft.estimateItem,
      missingFields: command.missingFields || [],
      message: command.message,
      confidence: command.confidence,
    };
    setDraft(nextDraft);
    if (!canRunIntent(command.intent)) setError('Your current role cannot run that assistant action.');
    else if (command.missingFields.includes('job')) setError('Choose a job before continuing.');
    else if (command.missingFields.includes('customer')) setError('Choose a customer before continuing.');
    else if (command.missingFields.includes('estimate')) setError('Choose an estimate before continuing.');
    else if (command.missingFields.includes('items')) setError('Add at least one shopping item before creating the list.');
    else setError('');
  };

  const transcribeBlob = async (blob: Blob) => {
    setIsTranscribing(true);
    setError('');
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm', ...authHeader() },
        body: blob,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Transcription failed');
      if (!data.text?.trim()) throw new Error('I did not catch any speech. Try again a little closer to the mic.');
      try {
        updateDraftFromCommand(data.text, await parseCommand(data.text));
      } catch {
        updateDraftFromText(data.text || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    setIsOpen(true);
    if (!canUseAssistant) {
      setError('Your current role cannot use Builder Assistant.');
      return;
    }
    if (!canRecord) {
      setError('Audio recording is not available in this browser.');
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
        setIsRecording(false);
        stopStream();
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 1000) void transcribeBlob(blob);
        else setError('I did not get enough audio. Hold the mic for a second, speak, then stop.');
      };
      recorder.onerror = () => {
        setIsRecording(false);
        stopStream();
        setError('Recording stopped unexpectedly.');
      };
      recorderRef.current = recorder;
      streamRef.current = stream;
      setDraft(null);
      setError('');
      setIsRecording(true);
      recorder.start();
    } catch (err) {
      setIsRecording(false);
      stopStream();
      setError(err instanceof Error ? err.message : 'Microphone access was blocked or unavailable.');
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData();
      } catch {
        // Some browsers already emitted the last chunk. Stopping still finalizes the recording.
      }
      recorder.stop();
    }
  };

  const closeAssistant = () => {
    if (isRecording) stopRecording();
    stopStream();
    setIsOpen(false);
  };

  const getShoppingItems = () => draft?.items.length
    ? draft.items
    : parseShoppingItems(draft?.itemsText || '').map(rawItem => {
      const parsed = parseQuantity(rawItem);
      return {
        name: parsed.name,
        quantity: parsed.quantity,
        unit: parsed.unit,
        category: inferCategory(parsed.name),
        urgent: false,
        notes: '',
      };
    });

  const runShoppingList = (mode: 'new' | 'append') => {
    if (!draft) return;
    const job = jobs.find(item => item.id === draft.jobId);
    if (!job) {
      setError('Choose a job first.');
      return;
    }
    const items = getShoppingItems();
    if (items.length === 0) {
      setError('Add at least one shopping item first.');
      return;
    }
    const listId = mode === 'append' && openShoppingList
      ? openShoppingList.id
      : addShoppingList({
        jobId: job.id,
        jobName: job.name,
        title: draft.title.trim() || `${job.name} Shopping List`,
        status: 'open',
        notes: `Created by Builder Assistant from: ${draft.sourceText}`,
        items: [],
      });
    items.forEach(item => {
      addShoppingListItem(listId, {
        name: item.name,
        category: item.category,
        quantity: item.quantity || 1,
        unit: item.unit || 'ea',
        purchased: false,
        urgent: item.urgent,
        notes: item.notes || 'Added by Builder Assistant',
        addOnStatus: 'included_expense',
      });
    });
    showToast(`${mode === 'append' ? 'Updated' : 'Created'} shopping list with ${items.length} item${items.length === 1 ? '' : 's'}`);
    setIsOpen(false);
    navigate(`/shopping-lists?jobId=${encodeURIComponent(job.id)}`);
  };

  const runDraft = () => {
    if (!draft || !canRunIntent(draft.intent)) return;
    const job = draft.jobId ? jobs.find(item => item.id === draft.jobId) : undefined;
    if (draft.intent === 'create_shopping_list') {
      if (openShoppingList && draft.shoppingListMode === 'ask') {
        setError('This job already has an open shopping list. Choose whether to append to it or create a new list.');
        return;
      }
      runShoppingList(draft.shoppingListMode === 'append' ? 'append' : 'new');
      return;
    }
    if ((draft.intent === 'create_task' || draft.intent === 'schedule_follow_up') && !draft.title.trim()) {
      setError('Add a task title first.');
      return;
    }
    if (['add_daily_log', 'add_note', 'add_photo_note'].includes(draft.intent) && !job) {
      setError('Choose a job first.');
      return;
    }
    if (draft.intent === 'create_task' || draft.intent === 'schedule_follow_up') {
      addTask({
        title: draft.title.trim(),
        description: draft.content.trim() || undefined,
        dueDate: draft.dueDate || undefined,
        jobId: draft.jobId || undefined,
        priority: draft.priority,
        status: 'open',
        taskType: draft.intent === 'schedule_follow_up' ? 'follow_up' : 'task',
        sourceType: 'manual',
      });
      showToast(draft.intent === 'schedule_follow_up' ? 'Follow-up scheduled' : 'Task created');
      setIsOpen(false);
      navigate('/tasks');
      return;
    }
    if (draft.intent === 'add_daily_log' && job) {
      addJobLog({
        jobId: job.id,
        date: new Date().toISOString().split('T')[0],
        workCompleted: draft.content.trim() || draft.title,
        workers: [],
        issues: '',
        notes: `Created by Builder Assistant from: ${draft.sourceText}`,
        hoursWorked: 0,
      });
      showToast('Daily log added');
      setIsOpen(false);
      navigate(`/jobs/${job.id}`);
      return;
    }
    if ((draft.intent === 'add_note' || draft.intent === 'add_photo_note') && job) {
      addNote({
        jobId: job.id,
        content: `${draft.intent === 'add_photo_note' ? 'Photo note: ' : ''}${draft.content.trim() || draft.title}`,
      });
      showToast(draft.intent === 'add_photo_note' ? 'Photo note added to job' : 'Note added to job');
      setIsOpen(false);
      navigate(`/jobs/${job.id}`);
      return;
    }
    if (draft.intent === 'add_estimate_item') {
      const estimate = estimates.find(item => item.id === draft.estimateId);
      const item = draft.estimateItem;
      if (!estimate || !item.name.trim()) {
        setError('Choose an estimate and name the item first.');
        return;
      }
      const quantity = item.quantity || 1;
      const unitPrice = item.unitPrice || 0;
      const category = item.category || 'material';
      const nextItem: EstimateLineItem = {
        id: crypto.randomUUID(),
        name: item.name.trim(),
        description: item.description || draft.content,
        quantity,
        unit: item.unit || 'ea',
        unitPrice,
        category,
        type: category === 'allowance' ? 'other' : category,
        isLabor: category === 'labor',
        total: quantity * unitPrice,
        priceTotal: quantity * unitPrice,
        costTotal: 0,
        sourceType: 'manual',
      };
      const sections = estimate.sections?.length ? estimate.sections : [{
        id: crypto.randomUUID(),
        name: 'Builder Assistant',
        lineItems: [],
        sortOrder: 0,
      }];
      updateEstimate(estimate.id, {
        sections: sections.map((section, index) => index === 0
          ? { ...section, lineItems: [...(section.lineItems || []), nextItem] }
          : section),
      });
      showToast('Estimate item added');
      setIsOpen(false);
      navigate('/estimates');
      return;
    }
    if (draft.intent === 'open_job' && job) {
      setIsOpen(false);
      navigate(`/jobs/${job.id}`);
      return;
    }
    if (draft.intent === 'open_customer') {
      const customer = customers.find(item => item.id === draft.customerId);
      if (!customer) {
        setError('Choose a customer first.');
        return;
      }
      setIsOpen(false);
      navigate('/customers');
    }
  };

  if (!canUseAssistant) return null;

  const primaryAction = draft?.intent === 'create_shopping_list'
    ? openShoppingList && draft.shoppingListMode === 'ask'
      ? 'Choose List Action'
      : draft.shoppingListMode === 'append'
        ? 'Append to Shopping List'
        : 'Create Shopping List'
    : draft ? `Confirm ${intentLabels[draft.intent]}` : 'Confirm';

  return (
    <>
      <button
        className={`global-voice-fab ${isRecording ? 'recording' : ''} ${isTranscribing ? 'transcribing' : ''}`}
        onClick={() => (isRecording ? stopRecording() : startRecording())}
        aria-label={isRecording ? 'Stop Builder Assistant recording' : 'Open Builder Assistant'}
        title={isRecording ? 'Stop Builder Assistant recording' : 'Builder Assistant'}
      >
        {isRecording ? <MicOff size={24} /> : isTranscribing ? <Loader2 size={24} /> : <Mic size={24} />}
      </button>

      {isOpen && (
        <div className="assistant-drawer" role="dialog" aria-modal="true" aria-label="Builder Assistant">
          <div className="assistant-panel">
            <div className="assistant-header">
              <div>
                <span>Builder Assistant</span>
                <strong>{isRecording ? 'Listening...' : isTranscribing ? 'Transcribing...' : draft ? intentLabels[draft.intent] : 'Voice Command'}</strong>
              </div>
              <button onClick={closeAssistant} aria-label="Close Builder Assistant"><X size={18} /></button>
            </div>

            <div className="assistant-body">
              <button className={`assistant-record ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopRecording : startRecording} disabled={isTranscribing}>
                {isRecording ? <MicOff size={20} /> : isTranscribing ? <Loader2 size={20} /> : <Mic size={20} />}
                <span>{isRecording ? 'Stop and Process' : isTranscribing ? 'Working...' : 'Record Command'}</span>
              </button>

              {error && <div className="assistant-notice warning">{error}</div>}

              {draft && (
                <div className="assistant-form">
                  <label>
                    <span>Command</span>
                    <textarea value={draft.sourceText} onChange={event => updateDraftFromText(event.target.value)} />
                  </label>

                  {['create_shopping_list', 'create_task', 'schedule_follow_up', 'add_daily_log', 'add_note', 'add_photo_note', 'open_job'].includes(draft.intent) && (
                    <label>
                      <span>Job</span>
                      <select value={draft.jobId} onChange={event => setDraft({ ...draft, jobId: event.target.value })}>
                        <option value="">Choose job...</option>
                        {openJobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
                      </select>
                    </label>
                  )}

                  {draft.intent === 'open_customer' && (
                    <label>
                      <span>Customer</span>
                      <select value={draft.customerId} onChange={event => setDraft({ ...draft, customerId: event.target.value })}>
                        <option value="">Choose customer...</option>
                        {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                      </select>
                    </label>
                  )}

                  {draft.intent === 'add_estimate_item' && (
                    <label>
                      <span>Estimate</span>
                      <select value={draft.estimateId} onChange={event => setDraft({ ...draft, estimateId: event.target.value })}>
                        <option value="">Choose estimate...</option>
                        {estimates.map(estimate => <option key={estimate.id} value={estimate.id}>{estimate.estimateNumber} - {estimate.name}</option>)}
                      </select>
                    </label>
                  )}

                  {draft.intent === 'create_shopping_list' && (
                    <label>
                      <span>Shopping Items</span>
                      <textarea
                        value={draft.itemsText}
                        onChange={event => setDraft({ ...draft, itemsText: event.target.value, items: [] })}
                        placeholder="Drywall screws, tile spacers, two tubes caulk"
                      />
                    </label>
                  )}

                  {['create_task', 'schedule_follow_up'].includes(draft.intent) && (
                    <>
                      <label>
                        <span>Title</span>
                        <textarea value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} />
                      </label>
                      <label>
                        <span>Details</span>
                        <textarea value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} />
                      </label>
                    </>
                  )}

                  {['add_daily_log', 'add_note', 'add_photo_note'].includes(draft.intent) && (
                    <label>
                      <span>Note</span>
                      <textarea value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} />
                    </label>
                  )}

                  {draft.intent === 'add_estimate_item' && (
                    <label>
                      <span>Estimate Item</span>
                      <textarea
                        value={draft.estimateItem.name}
                        onChange={event => setDraft({ ...draft, estimateItem: { ...draft.estimateItem, name: event.target.value } })}
                        placeholder="3 sheets drywall"
                      />
                    </label>
                  )}

                  {draft.message && <div className="assistant-notice">{draft.message}</div>}

                  <div className="assistant-preview">
                    {draft.intent === 'create_shopping_list' ? <ShoppingCart size={16} /> : <ClipboardList size={16} />}
                    <span>
                      {draft.intent === 'open_customer'
                        ? selectedCustomer?.name || 'No customer selected'
                        : draft.intent === 'add_estimate_item'
                          ? selectedEstimate?.name || 'No estimate selected'
                          : selectedJob?.name || 'No job selected'}
                      {draft.intent === 'create_shopping_list' ? ` - ${parsedItems.length} item${parsedItems.length === 1 ? '' : 's'}` : ''}
                      {draft.confidence !== undefined ? ` - ${Math.round(draft.confidence * 100)}% confidence` : ''}
                    </span>
                  </div>

                  {draft.intent === 'create_shopping_list' && openShoppingList && draft.shoppingListMode === 'ask' && (
                    <div className="assistant-choice-row">
                      <button className="assistant-secondary" onClick={() => runShoppingList('append')}>Append Open List</button>
                      <button className="assistant-secondary" onClick={() => runShoppingList('new')}>Create New List</button>
                    </div>
                  )}

                  {parsedItems.length > 0 && draft.intent === 'create_shopping_list' && (
                    <div className="assistant-item-chips">
                      {parsedItems.slice(0, 8).map(item => <span key={item}>{item}</span>)}
                    </div>
                  )}

                  <button className="assistant-create" onClick={runDraft} disabled={draft.intent === 'unknown'}>
                    <Check size={17} />
                    <span>{primaryAction}</span>
                  </button>
                </div>
              )}

              {!draft && !error && !isRecording && !isTranscribing && (
                <p className="assistant-hint">Say "Create a task for Smith kitchen", "add a daily log", "open Johnson customer", or "create a shopping list with drywall screws."</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
