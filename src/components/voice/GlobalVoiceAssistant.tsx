import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Mic, MicOff, ShoppingCart, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../common/Toast';
import type { Job, ShoppingListItemCategory } from '../../data/types';

interface ShoppingDraft {
  jobId: string;
  title: string;
  itemsText: string;
  sourceText: string;
}

const commandIncludesShoppingList = (text: string) =>
  /\b(shopping\s+list|shopping|material\s+list|supply\s+list|hardware\s+list|buy\s+list)\b/i.test(text);

const normalizeText = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();

const findJobFromCommand = (text: string, jobs: Job[]) => {
  const normalized = normalizeText(text);
  const ranked = jobs
    .map(job => {
      const name = normalizeText(job.name);
      const address = normalizeText(job.address || '');
      const customer = normalizeText(job.customer || '');
      const tokens = [name, address, customer].filter(Boolean);
      const score = tokens.reduce((best, token) => {
        if (!token) return best;
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

const chooseAudioMimeType = () => {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
};

export function GlobalVoiceAssistant() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { jobs, shoppingLists, addShoppingList, addShoppingListItem } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<ShoppingDraft | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canRecord = typeof window !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined';

  const openJobs = useMemo(() => jobs.filter(job => !['completed', 'closed'].includes(job.status)), [jobs]);
  const selectedJob = draft?.jobId ? jobs.find(job => job.id === draft.jobId) || null : null;
  const parsedItems = useMemo(() => parseShoppingItems(draft?.itemsText || ''), [draft?.itemsText]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  const updateDraftFromText = (text: string) => {
    if (!commandIncludesShoppingList(text)) {
      setDraft({ jobId: '', title: 'Builder Assistant Command', itemsText: '', sourceText: text });
      setError('I can create shopping lists right now. Try "create a shopping list for [job] with [items]."');
      return;
    }
    const job = findJobFromCommand(text, jobs);
    const itemsText = extractItemsText(text, job);
    setError('');
    setDraft({
      jobId: job?.id || '',
      title: job ? `${job.name} Shopping List` : 'Job Shopping List',
      itemsText,
      sourceText: text,
    });
  };

  const transcribeBlob = async (blob: Blob) => {
    setIsTranscribing(true);
    setError('');
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Transcription failed');
      if (!data.text?.trim()) throw new Error('I did not catch any speech. Try again a little closer to the mic.');
      updateDraftFromText(data.text || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    setIsOpen(true);
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

  const createShoppingListFromDraft = () => {
    if (!draft) return;
    const job = jobs.find(item => item.id === draft.jobId);
    if (!job) {
      setError('Choose a job first.');
      return;
    }
    const items = parseShoppingItems(draft.itemsText);
    const existingOpenList = shoppingLists.find(list => list.jobId === job.id && ['open', 'shopping'].includes(list.status));
    const listId = existingOpenList?.id || addShoppingList({
      jobId: job.id,
      jobName: job.name,
      title: draft.title.trim() || `${job.name} Shopping List`,
      status: 'open',
      notes: `Created by Builder Assistant from: ${draft.sourceText}`,
      items: [],
    });
    items.forEach(rawItem => {
      const parsed = parseQuantity(rawItem);
      addShoppingListItem(listId, {
        name: parsed.name,
        category: inferCategory(parsed.name),
        quantity: parsed.quantity,
        unit: parsed.unit,
        purchased: false,
        urgent: false,
        notes: 'Added by Builder Assistant',
        addOnStatus: 'included_expense',
      });
    });
    showToast(items.length ? `Shopping list updated with ${items.length} item${items.length === 1 ? '' : 's'}` : 'Shopping list created');
    setIsOpen(false);
    navigate(`/shopping-lists?jobId=${encodeURIComponent(job.id)}`);
  };

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
                <strong>{isRecording ? 'Listening...' : isTranscribing ? 'Transcribing...' : 'Voice Command'}</strong>
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

                  <label>
                    <span>Job</span>
                    <select value={draft.jobId} onChange={event => setDraft({ ...draft, jobId: event.target.value, title: `${jobs.find(job => job.id === event.target.value)?.name || 'Job'} Shopping List` })}>
                      <option value="">Choose job...</option>
                      {openJobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
                    </select>
                  </label>

                  <label>
                    <span>Shopping Items</span>
                    <textarea
                      value={draft.itemsText}
                      onChange={event => setDraft({ ...draft, itemsText: event.target.value })}
                      placeholder="Drywall screws, tile spacers, two tubes caulk"
                    />
                  </label>

                  <div className="assistant-preview">
                    <ShoppingCart size={16} />
                    <span>{selectedJob?.name || 'No job selected'} - {parsedItems.length} item{parsedItems.length === 1 ? '' : 's'}</span>
                  </div>

                  {parsedItems.length > 0 && (
                    <div className="assistant-item-chips">
                      {parsedItems.slice(0, 8).map(item => <span key={item}>{item}</span>)}
                    </div>
                  )}

                  <button className="assistant-create" onClick={createShoppingListFromDraft}>
                    <Check size={17} />
                    <span>Create Shopping List</span>
                  </button>
                </div>
              )}

              {!draft && !error && !isRecording && !isTranscribing && (
                <p className="assistant-hint">Say "Create a shopping list for Smith kitchen with drywall screws and tile spacers."</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
