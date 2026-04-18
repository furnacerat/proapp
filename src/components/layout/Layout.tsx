import React, { ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { branding } = useApp();
  return (
    <div className="app-layout" style={{ minHeight: '100vh' }}>
      <div style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 16px', background: 'var(--surface)', borderBottom: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {branding?.logoDataUrl ? (
            <img src={branding.logoDataUrl} alt="logo" style={{ height: 28 }} />
          ) : branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="logo" style={{ height: 28 }} />
          ) : null}
          <strong style={{ fontSize: 16 }}>{branding?.brandName || 'Allens Hub'}</strong>
        </div>
      </div>
      <Sidebar />
      <main className="main-content" style={{ paddingTop: 16 }}>
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
