import React, { useRef } from 'react';
import { useApp } from '../context/AppContext';

// Simple branding settings page
export function Settings() {
  const { branding, updateBranding } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportBranding = () => {
    const blob = new Blob([JSON.stringify(branding, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'branding.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const importBranding = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(String(fr.result));
        updateBranding(data as any);
        alert('Branding imported');
      } catch {
        alert('Invalid branding JSON');
      }
    };
    fr.readAsText(file);
  };

  // Branding presets
  const brandingPresets = [
    {
      id: 'premium-blue',
      name: 'Premium Blue',
      branding: {
        brandName: 'Allen\'s Hub',
        primaryColor: '#1f3a8a',
        secondaryColor: '#2563eb',
        fontFamily: 'Inter, system-ui, Arial',
        logoUrl: '',
        logoDataUrl: '',
        termsText: 'All rights reserved. See Terms',
        termsUrl: '#',
        signature: 'Best regards, Allen\'s Hub',
      }
    },
    {
      id: 'emerald',
      name: 'Emerald Prestige',
      branding: {
        brandName: 'Allen\'s Hub',
        primaryColor: '#064e3b',
        secondaryColor: '#10b981',
        fontFamily: 'Inter, system-ui, Arial',
        logoUrl: '',
        logoDataUrl: '',
        termsText: 'All rights reserved. See Terms',
        termsUrl: '#',
        signature: 'Cheers, Allen\'s Hub',
      }
    },
    {
      id: 'twilight',
      name: 'Twilight Premium',
      branding: {
        brandName: 'Allen\'s Hub',
        primaryColor: '#111827',
        secondaryColor: '#374151',
        fontFamily: 'Inter, system-ui, Arial',
        logoUrl: '',
        logoDataUrl: '',
        termsText: 'All rights reserved. See Terms',
        termsUrl: '#',
        signature: '— The Team',
      }
    }
  ];

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      updateBranding({ logoDataUrl: dataUrl, logoUrl: '' });
    };
    reader.readAsDataURL(file);
  };

  const setBrand = (key: keyof typeof branding, value: any) => {
    updateBranding({ [key]: value } as any);
  };

  // SMTP settings from app context
  const { smtpSettings, updateSmtpSettings } = useApp();

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <div className="card">
        <div className="card-header"><h3 className="card-title">Branding</h3></div>
        <div className="card-body grid-2">
          <div>
            <div className="form-group">
              <label className="form-label">Brand Name</label>
              <input className="form-input" value={branding.brandName} onChange={e => setBrand('brandName', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Font Family</label>
              <select className="form-select" value={branding.fontFamily} onChange={e => setBrand('fontFamily', e.target.value)}>
                <option value="Inter, system-ui">Inter</option>
                <option value="Arial, Helvetica, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Times New Roman, serif">Times</option>
                <option value="Roboto, sans-serif">Roboto</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Primary Color</label>
              <input className="form-input" type="color" value={branding.primaryColor || '#1f3a8a'} onChange={e => setBrand('primaryColor', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Secondary Color</label>
              <input className="form-input" type="color" value={branding.secondaryColor || '#2563eb'} onChange={e => setBrand('secondaryColor', e.target.value)} />
            </div>
          </div>
          <div>
            <div className="form-group">
              <label className="form-label">Logo</label>
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onLogoFile} />
              </div>
              {branding.logoDataUrl ? (
                <img src={branding.logoDataUrl} alt="logo" style={{ maxWidth: '200px', marginTop: '8px' }} />
              ) : branding.logoUrl ? (
                <img src={branding.logoUrl} alt="logo" style={{ maxWidth: '200px', marginTop: '8px' }} />
              ) : null}
            </div>
            <div className="form-group">
              <label className="form-label">Logo URL</label>
              <input className="form-input" value={branding.logoUrl || ''} onChange={e => setBrand('logoUrl', e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </div>
        <div className="card-body border-t"></div>
      </div>

      <div className="card mt-4">
        <div className="card-header"><h3 className="card-title">Email & Documents</h3></div>
        <div className="card-body grid-2">
          <div className="form-group">
            <label className="form-label">Email Signature</label>
            <textarea className="form-textarea" value={branding.signature || ''} onChange={e => setBrand('signature', e.target.value)} placeholder="Signature to append to emails" />
          </div>
          <div className="form-group">
            <label className="form-label">Terms & Conditions (URL or Text)</label>
            <textarea className="form-textarea" value={branding.termsText || ''} onChange={e => setBrand('termsText', e.target.value)} placeholder="Terms text" />
          </div>
        </div>
        <div className="card-body">
          <label className="form-label">Terms URL</label>
          <input className="form-input" value={branding.termsUrl || ''} onChange={e => setBrand('termsUrl', e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <div className="card mt-4" style={{ padding: 12 }}>
        <div className="form-group">
          <label className="form-label">Enable SMTP</label>
          <input type="checkbox" checked={smtpSettings?.enabled ?? false} onChange={e => updateSmtpSettings({ enabled: e.target.checked })} />
        </div>
        {smtpSettings?.enabled && (
          <>
            <div className="form-group">
              <label className="form-label">SMTP Host</label>
              <input className="form-input" value={smtpSettings.host} onChange={e => updateSmtpSettings({ host: e.target.value })} placeholder="smtp.example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">SMTP Port</label>
              <input className="form-input" type="number" value={smtpSettings.port} onChange={e => updateSmtpSettings({ port: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label className="form-label">SMTP User</label>
              <input className="form-input" value={smtpSettings.user} onChange={e => updateSmtpSettings({ user: e.target.value })} placeholder="username" />
            </div>
            <div className="form-group">
              <label className="form-label">SMTP Password</label>
              <input className="form-input" type="password" value={smtpSettings.password || ''} onChange={e => updateSmtpSettings({ password: e.target.value })} placeholder="password" />
            </div>
            <div className="form-group">
              <label className="form-label">From Name</label>
              <input className="form-input" value={smtpSettings.fromName || ''} onChange={e => updateSmtpSettings({ fromName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">From Email</label>
              <input className="form-input" value={smtpSettings.fromEmail || ''} onChange={e => updateSmtpSettings({ fromEmail: e.target.value })} />
            </div>
          </>
        )}
      </div>
      <div className="card mt-4" style={{ padding: 12 }}>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={exportBranding}>Export Branding</button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            Import Branding
            <input type="file" accept="application/json" onChange={importBranding} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
      <div className="card mt-4" style={{ padding: 12 }}>
        <div className="form-group">
          <label className="form-label">Branding Preset</label>
          <select className="form-select" onChange={e => {
            const preset = brandingPresets.find(p => p.id === e.target.value);
            if (preset) updateBranding(preset.branding as any);
          }}>
            <option value="">Choose preset</option>
            {brandingPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

export default Settings;
