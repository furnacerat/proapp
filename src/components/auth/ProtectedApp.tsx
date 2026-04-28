import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';

export function ProtectedApp({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (dataService.mode !== 'supabase') return <>{children}</>;

  if (loading) {
    return (
      <main className="auth-page">
        <section className="auth-panel auth-panel-compact">
          <p className="auth-eyebrow">Checking session</p>
          <h1>Loading workspace...</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
