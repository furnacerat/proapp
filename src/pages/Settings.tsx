import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { dataService } from '../services/dataService';
import { useToast } from '../components/common/Toast';

type SettingsTab = 'branding' | 'smart' | 'markups' | 'email' | 'smtp' | 'database' | 'import';

export function Settings() {
  const {
    branding,
    updateBranding,
    smtpSettings,
    updateSmtpSettings,
    dataServiceStatus,
    syncCoreDataToSupabase,
    importLocalDataToSupabase,
    data,
  } = useApp();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('branding');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [databaseMessage, setDatabaseMessage] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [brandingDraft, setBrandingDraft] = useState(branding);
  const [brandingSavedAt, setBrandingSavedAt] = useState('');
  const migrationPreview = dataService.previewLocalMigration(data);
  const hasBrandingChanges = JSON.stringify(brandingDraft) !== JSON.stringify(branding);

  useEffect(() => {
    setBrandingDraft(branding);
  }, [branding]);

  const setBrand = (key: keyof typeof branding, value: any) => {
    updateBranding({ [key]: value } as any);
  };

  const setBrandingField = (key: keyof typeof brandingDraft, value: any) => {
    setBrandingDraft(prev => ({ ...prev, [key]: value }));
  };

  const saveBranding = () => {
    updateBranding(brandingDraft);
    setBrandingSavedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    showToast('Branding saved');
  };

  const discardBrandingChanges = () => {
    setBrandingDraft(branding);
    setBrandingSavedAt('');
    showToast('Branding changes discarded', 'info');
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(brandingDraft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(String(fr.result));
        updateBranding(data as any);
        setBrandingDraft(prev => ({ ...prev, ...data }));
        showToast('Settings imported');
      } catch {
        showToast('Invalid settings JSON', 'error');
      }
    };
    fr.readAsText(file);
  };

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setBrandingDraft(prev => ({ ...prev, logoDataUrl: dataUrl, logoUrl: '' }));
    };
    reader.readAsDataURL(file);
  };

  const tabs = [
    { id: 'branding', label: 'Branding' },
    { id: 'smart', label: 'Smart Mode' },
    { id: 'markups', label: 'Default Markups' },
    { id: 'email', label: 'Email & Terms' },
    { id: 'smtp', label: 'SMTP' },
    { id: 'database', label: 'Database' },
    { id: 'import', label: 'Import/Export' },
  ];

  const runCoreSync = async () => {
    const ok = await syncCoreDataToSupabase();
    setDatabaseMessage(ok ? 'Customers, estimates, and jobs were synced to Supabase.' : 'Supabase sync failed. Check configuration and schema.');
  };

  const runFullImport = async () => {
    const ok = await importLocalDataToSupabase();
    setDatabaseMessage(ok ? 'Local app data was imported to Supabase. Local storage was left untouched.' : 'Supabase import failed. Check configuration and schema.');
  };

  const testDatabaseConnection = async () => {
    const result = await dataService.testConnection();
    setConnectionMessage(result.message);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="tabs mb-4">
        {tabs.map(tab => (
          <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id as SettingsTab)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'branding' && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">Company Branding</h3></div>
          <div className="card-body grid-2">
            <div>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input className="form-input" value={brandingDraft.brandName} onChange={e => setBrandingField('brandName', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email From Name</label>
                <input className="form-input" value={brandingDraft.emailFromName || ''} onChange={e => setBrandingField('emailFromName', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email From Address</label>
                <input className="form-input" value={brandingDraft.emailFromAddress || ''} onChange={e => setBrandingField('emailFromAddress', e.target.value)} placeholder="info@company.com" />
              </div>
            </div>
            <div>
              <div className="form-group">
                <label className="form-label">Font Family</label>
                <select className="form-select" value={brandingDraft.fontFamily} onChange={e => setBrandingField('fontFamily', e.target.value)}>
                  <option value="Inter, system-ui">Inter</option>
                  <option value="Arial, Helvetica, sans-serif">Arial</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Times New Roman, serif">Times</option>
                  <option value="Roboto, sans-serif">Roboto</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Primary Color</label>
                <input className="form-input" type="color" value={brandingDraft.primaryColor || '#1f3a8a'} onChange={e => setBrandingField('primaryColor', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Secondary Color</label>
                <input className="form-input" type="color" value={brandingDraft.secondaryColor || '#2563eb'} onChange={e => setBrandingField('secondaryColor', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="card-body border-t">
            <div className="form-group">
              <label className="form-label">Company Logo</label>
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onLogoFile} />
              </div>
              {brandingDraft.logoDataUrl ? (
                <img src={brandingDraft.logoDataUrl} alt="logo" style={{ maxWidth: '200px', marginTop: '8px' }} />
              ) : brandingDraft.logoUrl ? (
                <img src={brandingDraft.logoUrl} alt="logo" style={{ maxWidth: '200px', marginTop: '8px' }} />
              ) : null}
            </div>
          </div>
          <div className="card-body border-t">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted">
                {brandingSavedAt ? `Last saved at ${brandingSavedAt}.` : 'Save branding changes to keep them after refresh or sign-in.'}
              </p>
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={discardBrandingChanges} disabled={!hasBrandingChanges}>
                  Discard
                </button>
                <button className="btn btn-primary" onClick={saveBranding} disabled={!hasBrandingChanges}>
                  Save Branding
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'smart' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Smart Features</h3>
              <p className="text-sm text-muted">Enable the Intelligence Engine for recommendations, alerts, and estimate assistance.</p>
            </div>
            <span className={`badge ${branding.smartFeaturesEnabled !== false ? 'badge-green' : 'badge-gray'}`}>
              {branding.smartFeaturesEnabled !== false ? 'On' : 'Off'}
            </span>
          </div>
          <div className="card-body">
            <label className="smart-toggle-row">
              <div>
                <div className="font-bold">Smart Mode</div>
                <div className="text-sm text-muted">Show priority next actions, profit intelligence, delay detection, cash-flow alerts, and estimate suggestions.</div>
              </div>
              <input
                type="checkbox"
                checked={branding.smartFeaturesEnabled !== false}
                onChange={e => setBrand('smartFeaturesEnabled', e.target.checked)}
              />
            </label>
            <div className="smart-settings-grid mt-4">
              <div className="smart-setting-tile">
                <strong>Next Actions</strong>
                <span>Follow-ups, job actions, and payment reminders.</span>
              </div>
              <div className="smart-setting-tile">
                <strong>Profit Intelligence</strong>
                <span>Underpricing, margin, and over-budget warnings.</span>
              </div>
              <div className="smart-setting-tile">
                <strong>Estimate Assistance</strong>
                <span>Project-type suggestions from templates and historical work.</span>
              </div>
              <div className="smart-setting-tile">
                <strong>Delay & Cash Flow</strong>
                <span>Inactive jobs, overdue tasks, and payment shortfall alerts.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'markups' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Default Markups</h3>
            <p className="text-sm text-muted">Applied to new estimates and invoices</p>
          </div>
          <div className="card-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Labor Markup (%)</label>
                <input className="form-input" type="number" value={branding.defaultLaborMarkup || 30} onChange={e => setBrand('defaultLaborMarkup', Number(e.target.value))} />
                <p className="text-xs text-muted mt-1">Added to labor costs</p>
              </div>
              <div className="form-group">
                <label className="form-label">Material Markup (%)</label>
                <input className="form-input" type="number" value={branding.defaultMaterialMarkup || 20} onChange={e => setBrand('defaultMaterialMarkup', Number(e.target.value))} />
                <p className="text-xs text-muted mt-1">Added to material costs</p>
              </div>
            </div>
            <div className="grid-2 mt-4">
              <div className="form-group">
                <label className="form-label">Equipment Markup (%)</label>
                <input className="form-input" type="number" value={branding.defaultEquipmentMarkup || 15} onChange={e => setBrand('defaultEquipmentMarkup', Number(e.target.value))} />
                <p className="text-xs text-muted mt-1">Added to equipment costs</p>
              </div>
              <div className="form-group">
                <label className="form-label">Subcontractor Markup (%)</label>
                <input className="form-input" type="number" value={branding.defaultSubcontractorMarkup || 15} onChange={e => setBrand('defaultSubcontractorMarkup', Number(e.target.value))} />
                <p className="text-xs text-muted mt-1">Added to subcontractor costs</p>
              </div>
            </div>
          </div>
          <div className="card-body border-t">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Default Tax Rate (%)</label>
                <input className="form-input" type="number" step="0.01" value={branding.defaultTaxRate || 0} onChange={e => setBrand('defaultTaxRate', Number(e.target.value))} />
                <p className="text-xs text-muted mt-1">Applied to taxable line items</p>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Terms</label>
                <select className="form-select" value={branding.paymentTerms || 'net30'} onChange={e => setBrand('paymentTerms', e.target.value)}>
                  <option value="due_on_receipt">Due on Receipt</option>
                  <option value="net15">Net 15</option>
                  <option value="net30">Net 30</option>
                  <option value="net45">Net 45</option>
                  <option value="net60">Net 60</option>
                  <option value="50_deposit">50% Deposit, 50% on Completion</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">Email & Document Settings</h3></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Email Signature</label>
              <textarea className="form-textarea" value={branding.signature || ''} onChange={e => setBrand('signature', e.target.value)} placeholder="Best regards, Your Company" />
            </div>
          </div>
          <div className="card-body border-t">
            <div className="form-group">
              <label className="form-label">Terms & Conditions (shown on invoices)</label>
              <textarea className="form-textarea" value={branding.termsText || ''} onChange={e => setBrand('termsText', e.target.value)} placeholder="Payment is due within 30 days..." rows={3} />
            </div>
            <div className="form-group">
              <label className="form-label">Terms URL</label>
              <input className="form-input" value={branding.termsUrl || ''} onChange={e => setBrand('termsUrl', e.target.value)} placeholder="https://yourcompany.com/terms" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'smtp' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">SMTP Email Settings</h3>
            <p className="text-sm text-muted">Enable SMTP to send invoices/estimates via email instead of mailto links</p>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={smtpSettings?.enabled ?? false} onChange={e => updateSmtpSettings({ enabled: e.target.checked })} />
                <span>Enable SMTP</span>
              </label>
            </div>
            {smtpSettings?.enabled && (
              <div className="grid-2 mt-4">
                <div className="form-group">
                  <label className="form-label">SMTP Host</label>
                  <input className="form-input" value={smtpSettings.host} onChange={e => updateSmtpSettings({ host: e.target.value })} placeholder="smtp.example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">SMTP Port</label>
                  <input className="form-input" type="number" value={smtpSettings.port} onChange={e => updateSmtpSettings({ port: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">SMTP Username</label>
                  <input className="form-input" value={smtpSettings.user} onChange={e => updateSmtpSettings({ user: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">SMTP Password</label>
                  <input className="form-input" type="password" value={smtpSettings.password || ''} onChange={e => updateSmtpSettings({ password: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">From Name</label>
                  <input className="form-input" value={smtpSettings.fromName || ''} onChange={e => updateSmtpSettings({ fromName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">From Email</label>
                  <input className="form-input" value={smtpSettings.fromEmail || ''} onChange={e => updateSmtpSettings({ fromEmail: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'database' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Supabase Data Service</h3>
              <p className="text-sm text-muted">Supabase is the active shared database. Use the import button only on a device that still has older local-only records.</p>
            </div>
            <span className={`badge ${dataServiceStatus.supabaseConfigured ? 'badge-green' : 'badge-gray'}`}>
              {dataServiceStatus.supabaseConfigured ? 'Configured' : 'Local Only'}
            </span>
          </div>
          <div className="card-body">
            <div className="grid-2">
              <div className="smart-setting-tile">
                <strong>Current Storage</strong>
                <span>{dataServiceStatus.mode === 'supabase' ? 'Supabase shared database' : 'Local storage only'}</span>
              </div>
              <div className="smart-setting-tile">
                <strong>Last Sync</strong>
                <span>{dataServiceStatus.lastSyncAt ? new Date(dataServiceStatus.lastSyncAt).toLocaleString() : 'Not synced yet'}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-secondary" onClick={testDatabaseConnection}>
                Test Connection
              </button>
              <button className="btn btn-primary" onClick={runCoreSync} disabled={!dataServiceStatus.supabaseConfigured || dataServiceStatus.isSyncing}>
                {dataServiceStatus.isSyncing ? 'Syncing...' : 'Sync Current Data'}
              </button>
              <button className="btn btn-secondary" onClick={runFullImport} disabled={!dataServiceStatus.supabaseConfigured || dataServiceStatus.isSyncing}>
                Rescue This Device's Local Data
              </button>
            </div>
            <p className="text-sm text-muted mt-2">
              If records were entered before Supabase sharing was active, open this page on that same device and import them once.
            </p>
            {connectionMessage && <p className="text-sm mt-2">{connectionMessage}</p>}
            {databaseMessage && <p className="text-sm mt-2">{databaseMessage}</p>}
            {dataServiceStatus.syncError && <p className="text-sm text-danger mt-2">{dataServiceStatus.syncError}</p>}
            <div className="smart-settings-grid mt-4">
              {migrationPreview.map(item => (
                <div className="smart-setting-tile" key={item.table}>
                  <strong>{item.table}</strong>
                  <span>{item.count} record{item.count === 1 ? '' : 's'} ready</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">Import / Export Settings</h3></div>
          <div className="card-body">
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={exportData}>
                Export Settings
              </button>
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                Import Settings
                <input type="file" accept="application/json" onChange={importData} style={{ display: 'none' }} />
              </label>
            </div>
            <p className="text-sm text-muted mt-2">Export your branding and settings to back them up or import to another device.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
