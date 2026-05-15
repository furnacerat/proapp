import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle,
  Copy,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Mail,
  Megaphone,
  MessageSquare,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';
import { formatDate } from '../utils/formatters';
import type { Job, Photo } from '../data/types';

type MarketingTemplate = 'Before & After Reveal' | 'Project Spotlight' | 'Customer Testimonial' | 'Limited Time Offer' | 'Seasonal Maintenance Reminder';
type MarketingChannel = 'Facebook post' | 'Instagram caption' | 'Google Business Profile post' | 'Email marketing message' | 'SMS/text message' | 'Website portfolio blurb';
type ImageMode = 'side-by-side' | 'carousel';

type MarketingDraft = {
  id: string;
  jobId: string;
  jobName: string;
  template: MarketingTemplate;
  channel: MarketingChannel;
  imageMode: ImageMode;
  copy: string;
  status: 'draft' | 'posted';
  createdAt: string;
  postedAt?: string;
};

const DRAFTS_KEY = 'buildops_marketing_drafts';

const templates: MarketingTemplate[] = [
  'Before & After Reveal',
  'Project Spotlight',
  'Customer Testimonial',
  'Limited Time Offer',
  'Seasonal Maintenance Reminder',
];

const channels: MarketingChannel[] = [
  'Facebook post',
  'Instagram caption',
  'Google Business Profile post',
  'Email marketing message',
  'SMS/text message',
  'Website portfolio blurb',
];

const getCityFromAddress = (address?: string) => {
  const parts = (address || '').split(',').map(part => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : '';
};

const firstName = (name?: string) => (name || '').trim().split(/\s+/)[0] || '';

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const loadDrafts = (): MarketingDraft[] => {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveDrafts = (drafts: MarketingDraft[]) => {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
};

const buildCopy = ({
  channel,
  template,
  job,
  city,
  customerName,
  scope,
  materials,
  completionDate,
  cta,
  testimonial,
  brandName,
}: {
  channel: MarketingChannel;
  template: MarketingTemplate;
  job?: Job;
  city: string;
  customerName: string;
  scope: string;
  materials: string;
  completionDate: string;
  cta: string;
  testimonial: string;
  brandName: string;
}) => {
  const projectType = (job?.type || 'remodel').replace('_', ' ');
  const location = city ? ` in ${city}` : '';
  const customerLine = customerName ? ` for ${customerName}` : '';
  const completed = completionDate ? ` Completed ${formatDate(completionDate)}.` : '';
  const materialLine = materials ? ` Materials and finishes included ${materials}.` : '';
  const scopeLine = scope || job?.notes || `${projectType} project`;
  const callToAction = cta || 'Message us to talk through your next project.';

  if (channel === 'SMS/text message') {
    if (template === 'Customer Testimonial') return `Hi ${customerName || 'there'}, thank you again for trusting ${brandName}. Would you be open to sharing a quick review or referral? ${callToAction}`;
    return `${brandName} just wrapped a ${projectType}${location}. ${callToAction}`;
  }

  if (channel === 'Email marketing message') {
    return [
      `Subject: Recent ${projectType} project${location}`,
      '',
      `We just completed ${job?.name || `a ${projectType}`}${customerLine}${location}.`,
      '',
      scopeLine,
      materialLine.trim(),
      testimonial ? `"${testimonial}"` : '',
      completed.trim(),
      '',
      callToAction,
    ].filter(Boolean).join('\n');
  }

  if (channel === 'Website portfolio blurb') {
    return `${job?.name || `Completed ${projectType}`} showcases ${scopeLine.toLowerCase()}${location}.${materialLine}${completed} ${brandName} handled the details from planning through final cleanup.`;
  }

  if (template === 'Before & After Reveal') {
    return `Before and after: ${job?.name || `this ${projectType}`}${location} came a long way. ${scopeLine}.${materialLine}${completed}\n\n${callToAction}`;
  }

  if (template === 'Customer Testimonial') {
    return `${testimonial ? `"${testimonial}"` : `Another finished ${projectType}${location}.`} We appreciate${customerLine || ' every customer who trusts us'} with the details that make a project feel complete.\n\n${callToAction}`;
  }

  if (template === 'Limited Time Offer') {
    return `Planning a ${projectType}, repair, or seasonal update${location ? ` around ${city}` : ''}? We are opening a few schedule slots and can help you price the work clearly before it starts.\n\n${callToAction}`;
  }

  if (template === 'Seasonal Maintenance Reminder') {
    return `Seasonal reminder from ${brandName}: small maintenance items are easier to handle before they become bigger repairs. If your home needs a punch list, repair, or update${location ? ` in ${city}` : ''}, we can help.\n\n${callToAction}`;
  }

  return `Project spotlight: ${job?.name || `completed ${projectType}`}${location}.${completed} ${scopeLine}.${materialLine}\n\n${callToAction}`;
};

export function MarketingStudio() {
  const { jobs, customers, photos, notes, branding, addTimelineEntry } = useApp();
  const { showToast } = useToast();
  const completedJobs = useMemo(() => jobs.filter(job => ['completed', 'closed'].includes(job.status)), [jobs]);
  const sourceJobs = completedJobs.length ? completedJobs : jobs;

  const [selectedJobId, setSelectedJobId] = useState(sourceJobs[0]?.id || '');
  const selectedJob = useMemo(() => sourceJobs.find(job => job.id === selectedJobId) || sourceJobs[0], [sourceJobs, selectedJobId]);
  const selectedCustomer = useMemo(() => customers.find(customer => customer.id === selectedJob?.customerId), [customers, selectedJob]);
  const jobPhotos = useMemo(() => photos.filter(photo => photo.jobId === selectedJob?.id), [photos, selectedJob]);
  const jobNotes = useMemo(() => notes.filter(note => note.jobId === selectedJob?.id), [notes, selectedJob]);
  const brandName = branding.brandName || 'Your Company';

  const [template, setTemplate] = useState<MarketingTemplate>('Before & After Reveal');
  const [channel, setChannel] = useState<MarketingChannel>('Facebook post');
  const [imageMode, setImageMode] = useState<ImageMode>('side-by-side');
  const [beforePhotoId, setBeforePhotoId] = useState('');
  const [afterPhotoId, setAfterPhotoId] = useState('');
  const [projectLabel, setProjectLabel] = useState('');
  const [city, setCity] = useState('');
  const [scope, setScope] = useState('');
  const [materials, setMaterials] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [testimonial, setTestimonial] = useState('');
  const [cta, setCta] = useState('Message us to schedule an estimate.');
  const [copyText, setCopyText] = useState('');
  const [drafts, setDrafts] = useState<MarketingDraft[]>(loadDrafts);

  const beforePhoto = jobPhotos.find(photo => photo.id === beforePhotoId) || jobPhotos.find(photo => photo.category === 'before') || jobPhotos[0];
  const afterPhoto = jobPhotos.find(photo => photo.id === afterPhotoId) || jobPhotos.find(photo => photo.category === 'after') || jobPhotos[1] || jobPhotos[0];
  const recentDrafts = drafts.filter(draft => draft.jobId === selectedJob?.id).slice(0, 6);

  useEffect(() => {
    if (!selectedJob) return;
    setSelectedJobId(selectedJob.id);
    setProjectLabel(selectedJob.name);
    setCity(getCityFromAddress(selectedJob.address));
    setCompletionDate(selectedJob.dueDate || selectedJob.updatedAt?.split('T')[0] || '');
    setCustomerFirstName(firstName(selectedCustomer?.name || selectedJob.customer));
    setScope(selectedJob.notes || `${selectedJob.type.replace('_', ' ')} completed with a clean, durable finish`);
    setBeforePhotoId(jobPhotos.find(photo => photo.category === 'before')?.id || jobPhotos[0]?.id || '');
    setAfterPhotoId(jobPhotos.find(photo => photo.category === 'after')?.id || jobPhotos[1]?.id || jobPhotos[0]?.id || '');
  }, [selectedJob?.id]);

  useEffect(() => {
    if (!selectedJob) return;
    setCopyText(buildCopy({
      channel,
      template,
      job: selectedJob,
      city,
      customerName: customerFirstName,
      scope,
      materials,
      completionDate,
      cta,
      testimonial,
      brandName,
    }));
  }, [brandName, channel, template, selectedJob?.id]);

  const generated = () => buildCopy({
    channel,
    template,
    job: selectedJob,
    city,
    customerName: customerFirstName,
    scope,
    materials,
    completionDate,
    cta,
    testimonial,
    brandName,
  });

  const handleGenerate = () => {
    setCopyText(generated());
    showToast('Marketing copy generated');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    showToast('Caption copied');
  };

  const handleSaveDraft = () => {
    if (!selectedJob) return;
    const draft: MarketingDraft = {
      id: crypto.randomUUID(),
      jobId: selectedJob.id,
      jobName: selectedJob.name,
      template,
      channel,
      imageMode,
      copy: copyText || generated(),
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    const nextDrafts = [draft, ...drafts];
    setDrafts(nextDrafts);
    saveDrafts(nextDrafts);
    addTimelineEntry({
      jobId: selectedJob.id,
      type: 'update',
      title: `Marketing draft saved: ${template}`,
      description: `${channel}\n\n${draft.copy}`,
      timestamp: new Date().toISOString(),
    });
    showToast('Marketing draft saved');
  };

  const markPosted = (draftId?: string) => {
    const id = draftId || recentDrafts[0]?.id;
    if (!id) {
      handleSaveDraft();
      return;
    }
    const nextDrafts = drafts.map(draft => draft.id === id ? { ...draft, status: 'posted' as const, postedAt: new Date().toISOString() } : draft);
    setDrafts(nextDrafts);
    saveDrafts(nextDrafts);
    const postedDraft = nextDrafts.find(draft => draft.id === id);
    if (postedDraft) {
      addTimelineEntry({
        jobId: postedDraft.jobId,
        type: 'update',
        title: `Marketing marked posted: ${postedDraft.template}`,
        description: postedDraft.channel,
        timestamp: new Date().toISOString(),
      });
    }
    showToast('Marked as posted');
  };

  const downloadImage = () => {
    const svg = marketingSvg({ brandingName: brandName, projectLabel, city, beforePhoto, afterPhoto, imageMode, logo: branding.logoDataUrl || branding.logoUrl });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(projectLabel || 'marketing-post').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const prepareEmail = () => {
    const subject = encodeURIComponent(`${brandName} project update`);
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(copyText)}`;
  };

  const prepareSms = () => {
    window.location.href = `sms:?&body=${encodeURIComponent(copyText)}`;
  };

  if (!sourceJobs.length) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <Megaphone size={36} />
          <h3>No jobs ready for marketing</h3>
          <p>Complete a job and add before/after photos to build polished posts and follow-ups.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="marketing-studio page-content">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Business Growth</div>
          <h1 className="page-title">Marketing Studio</h1>
          <p className="page-subtitle">Turn finished work into before-and-after posts, follow-ups, and portfolio copy.</p>
        </div>
        <div className="marketing-header-actions">
          <button className="btn btn-secondary" onClick={handleCopy}><Copy size={18} /> Copy Caption</button>
          <button className="btn btn-primary" onClick={handleSaveDraft}><Save size={18} /> Save Draft</button>
        </div>
      </div>

      <div className="marketing-kpi-grid">
        <Metric icon={BadgeCheck} label="Completed Jobs" value={completedJobs.length.toString()} />
        <Metric icon={ImageIcon} label="Job Photos" value={jobPhotos.length.toString()} />
        <Metric icon={MessageSquare} label="Project Notes" value={jobNotes.length.toString()} />
        <Metric icon={Megaphone} label="Saved Drafts" value={drafts.length.toString()} />
      </div>

      <div className="marketing-layout">
        <section className="marketing-main">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Source & Smart Fields</h3>
              <span className="badge badge-blue">Owner/Admin</span>
            </div>
            <div className="card-body">
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Completed Job</label>
                  <select className="form-select" value={selectedJob?.id || ''} onChange={event => setSelectedJobId(event.target.value)}>
                    {sourceJobs.map(job => <option key={job.id} value={job.id}>{job.name} - {job.status.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Template</label>
                  <select className="form-select" value={template} onChange={event => setTemplate(event.target.value as MarketingTemplate)}>
                    {templates.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row form-row-3">
                <div className="form-group">
                  <label className="form-label">Project Label</label>
                  <input className="form-input" value={projectLabel} onChange={event => setProjectLabel(event.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" value={city} onChange={event => setCity(event.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Completion Date</label>
                  <input className="form-input" type="date" value={completionDate} onChange={event => setCompletionDate(event.target.value)} />
                </div>
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Customer First Name</label>
                  <input className="form-input" value={customerFirstName} onChange={event => setCustomerFirstName(event.target.value)} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Materials Used</label>
                  <input className="form-input" value={materials} onChange={event => setMaterials(event.target.value)} placeholder="Cabinets, LVP flooring, tile..." />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Scope Summary</label>
                <textarea className="form-textarea" value={scope} onChange={event => setScope(event.target.value)} />
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Customer Testimonial</label>
                  <textarea className="form-textarea" value={testimonial} onChange={event => setTestimonial(event.target.value)} placeholder="Paste a review or customer quote..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Call To Action</label>
                  <textarea className="form-textarea" value={cta} onChange={event => setCta(event.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Before/After Builder</h3>
              <div className="marketing-segmented">
                <button className={imageMode === 'side-by-side' ? 'active' : ''} onClick={() => setImageMode('side-by-side')}>Side-by-side</button>
                <button className={imageMode === 'carousel' ? 'active' : ''} onClick={() => setImageMode('carousel')}>Carousel</button>
              </div>
            </div>
            <div className="card-body">
              <div className="form-row form-row-2">
                <PhotoPicker label="Before Photo" photos={jobPhotos} value={beforePhotoId} onChange={setBeforePhotoId} />
                <PhotoPicker label="After Photo" photos={jobPhotos} value={afterPhotoId} onChange={setAfterPhotoId} />
              </div>
              <MarketingPreview
                brandingName={brandName}
                logo={branding.logoDataUrl || branding.logoUrl}
                beforePhoto={beforePhoto}
                afterPhoto={afterPhoto}
                projectLabel={projectLabel}
                city={city}
                imageMode={imageMode}
              />
              <div className="marketing-actions">
                <button className="btn btn-secondary" onClick={downloadImage}><Download size={18} /> Download Image</button>
                <button className="btn btn-secondary" onClick={handleSaveDraft}><Save size={18} /> Save to Job History</button>
                <button className="btn btn-secondary" onClick={() => markPosted()}><CheckCircle size={18} /> Mark Posted</button>
              </div>
            </div>
          </div>
        </section>

        <aside className="marketing-side">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Content Generator</h3>
              <Sparkles size={18} />
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Output</label>
                <select className="form-select" value={channel} onChange={event => setChannel(event.target.value as MarketingChannel)}>
                  {channels.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleGenerate}><Sparkles size={18} /> Generate Editable Copy</button>
              <textarea className="form-textarea marketing-copy-editor" value={copyText} onChange={event => setCopyText(event.target.value)} />
              <div className="marketing-actions stacked">
                <button className="btn btn-secondary" onClick={handleCopy}><Copy size={18} /> Copy Caption</button>
                <button className="btn btn-secondary" onClick={prepareEmail}><Mail size={18} /> Prepare Email</button>
                <button className="btn btn-secondary" onClick={prepareSms}><MessageSquare size={18} /> Prepare Text</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">CRM Follow-ups</h3>
              <Send size={18} />
            </div>
            <div className="card-body marketing-crm-actions">
              <button onClick={() => setCopyText(`Hi ${customerFirstName || 'there'}, thanks again for trusting ${brandName} with ${selectedJob?.name || 'your project'}. If you know anyone planning a project, we would be grateful for the referral.`)}>
                <MessageSquare size={16} /> Referral request
              </button>
              <button onClick={() => setCopyText(`Hi ${customerFirstName || 'there'}, just checking in after ${selectedJob?.name || 'the project'}. Is everything still looking good, and is there anything you would like us to follow up on?`)}>
                <MessageSquare size={16} /> Past customer follow-up
              </button>
              <button onClick={() => setCopyText(buildCopy({ channel: 'Email marketing message', template: 'Project Spotlight', job: selectedJob, city, customerName: customerFirstName, scope, materials, completionDate, cta, testimonial, brandName }))}>
                <Mail size={16} /> Customer list email
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Job Marketing History</h3>
              <ExternalLink size={18} />
            </div>
            <div className="card-body">
              {recentDrafts.length ? recentDrafts.map(draft => (
                <div className="marketing-draft-row" key={draft.id}>
                  <div>
                    <strong>{draft.template}</strong>
                    <span>{draft.channel} - {formatDate(draft.createdAt)}</span>
                  </div>
                  <button className={`badge ${draft.status === 'posted' ? 'badge-green' : 'badge-gray'}`} onClick={() => markPosted(draft.id)}>
                    {draft.status}
                  </button>
                </div>
              )) : <p className="text-sm text-muted">No saved drafts for this job yet.</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof BadgeCheck; label: string; value: string }) {
  return (
    <div className="marketing-metric">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PhotoPicker({ label, photos, value, onChange }: { label: string; photos: Photo[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <select className="form-select" value={value} onChange={event => onChange(event.target.value)}>
        <option value="">Select photo</option>
        {photos.map(photo => <option key={photo.id} value={photo.id}>{photo.category} - {photo.description || photo.url.slice(0, 42)}</option>)}
      </select>
    </div>
  );
}

function MarketingPreview({ brandingName, logo, beforePhoto, afterPhoto, projectLabel, city, imageMode }: {
  brandingName: string;
  logo?: string;
  beforePhoto?: Photo;
  afterPhoto?: Photo;
  projectLabel: string;
  city: string;
  imageMode: ImageMode;
}) {
  return (
    <div className={`marketing-preview ${imageMode}`}>
      <div className="marketing-preview-brand">
        {logo ? <img src={logo} alt="" /> : <Megaphone size={20} />}
        <strong>{brandingName}</strong>
      </div>
      <div className="marketing-photo-grid">
        <PreviewPhoto label="Before" photo={beforePhoto} />
        <PreviewPhoto label="After" photo={afterPhoto} />
      </div>
      <div className="marketing-preview-footer">
        <strong>{projectLabel || 'Completed Project'}</strong>
        <span>{city || 'Local project'}</span>
      </div>
    </div>
  );
}

function PreviewPhoto({ label, photo }: { label: string; photo?: Photo }) {
  return (
    <div className="marketing-preview-photo">
      {photo?.url ? <img src={photo.url} alt={photo.description || label} /> : <div><ImageIcon size={28} /><span>No {label.toLowerCase()} photo</span></div>}
      <em>{label}</em>
    </div>
  );
}

function marketingSvg({ brandingName, projectLabel, city, beforePhoto, afterPhoto, imageMode, logo }: {
  brandingName: string;
  projectLabel: string;
  city: string;
  beforePhoto?: Photo;
  afterPhoto?: Photo;
  imageMode: ImageMode;
  logo?: string;
}) {
  const before = beforePhoto?.url ? `<image href="${escapeXml(beforePhoto.url)}" x="56" y="150" width="472" height="530" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="56" y="150" width="472" height="530" fill="#17324a"/><text x="292" y="420" fill="#d7e8ff" font-size="30" text-anchor="middle">Before</text>`;
  const after = afterPhoto?.url ? `<image href="${escapeXml(afterPhoto.url)}" x="552" y="150" width="472" height="530" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="552" y="150" width="472" height="530" fill="#17324a"/><text x="788" y="420" fill="#d7e8ff" font-size="30" text-anchor="middle">After</text>`;
  const logoImage = logo ? `<image href="${escapeXml(logo)}" x="56" y="48" width="46" height="46" preserveAspectRatio="xMidYMid meet"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="#071827"/>
  <rect x="28" y="28" width="1024" height="1024" rx="34" fill="#0d2238" stroke="#31506e" stroke-width="2"/>
  ${logoImage}
  <text x="${logo ? 118 : 56}" y="80" fill="#f8fbff" font-family="Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(brandingName)}</text>
  <text x="1024" y="80" fill="#90cdf4" font-family="Arial, sans-serif" font-size="24" text-anchor="end">${imageMode === 'carousel' ? 'Carousel Post' : 'Before / After'}</text>
  <clipPath id="beforeClip"><rect x="56" y="150" width="472" height="530" rx="20"/></clipPath>
  <clipPath id="afterClip"><rect x="552" y="150" width="472" height="530" rx="20"/></clipPath>
  <g clip-path="url(#beforeClip)">${before}</g>
  <g clip-path="url(#afterClip)">${after}</g>
  <rect x="56" y="150" width="472" height="530" rx="20" fill="none" stroke="#4a6b8c" stroke-width="2"/>
  <rect x="552" y="150" width="472" height="530" rx="20" fill="none" stroke="#4a6b8c" stroke-width="2"/>
  <rect x="76" y="172" width="132" height="46" rx="23" fill="#071827" opacity="0.82"/>
  <rect x="572" y="172" width="104" height="46" rx="23" fill="#0f766e" opacity="0.9"/>
  <text x="142" y="203" fill="#ffffff" font-family="Arial, sans-serif" font-size="24" font-weight="700" text-anchor="middle">Before</text>
  <text x="624" y="203" fill="#ffffff" font-family="Arial, sans-serif" font-size="24" font-weight="700" text-anchor="middle">After</text>
  <text x="56" y="768" fill="#ffffff" font-family="Arial, sans-serif" font-size="54" font-weight="800">${escapeXml(projectLabel || 'Completed Project')}</text>
  <text x="56" y="828" fill="#b8c7d9" font-family="Arial, sans-serif" font-size="34">${escapeXml(city || 'Local project')}</text>
  <text x="56" y="952" fill="#90cdf4" font-family="Arial, sans-serif" font-size="28">Built by ${escapeXml(brandingName)}</text>
</svg>`;
}
