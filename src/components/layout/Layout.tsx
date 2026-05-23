import React, { ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { GlobalVoiceAssistant } from '../voice/GlobalVoiceAssistant';
import { APP_LOGO_SRC, APP_NAME } from '../../config/appIdentity';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { branding } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const shellName = APP_NAME;

  // Close sidebar automatically on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.title = shellName;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor && branding.primaryColor) themeColor.content = branding.primaryColor;
    const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) appleTitle.content = shellName;
  }, [branding.primaryColor, shellName]);

  return (
    <div className="app-layout">
      {/* Mobile / Tablet Topbar */}
      <header className="mobile-topbar hidden-desktop">
        <button 
          className="btn btn-icon btn-menu" 
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <div className="mobile-brand">
          <img src={APP_LOGO_SRC} alt="" className="app-logo" />
          <strong>{shellName}</strong>
        </div>
      </header>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="main-content">
        {children}
      </main>
      <GlobalVoiceAssistant />
    </div>
  );
}
