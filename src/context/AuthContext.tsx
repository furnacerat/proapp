import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { dataService } from '../services/dataService';

type AuthResult = { error?: string; message?: string };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const friendlyAuthError = (message?: string) => {
  const text = (message || '').toLowerCase();
  if (text.includes('invalid login')) return 'Invalid email or password.';
  if (text.includes('already registered') || text.includes('already exists')) return 'That email is already registered.';
  if (text.includes('session')) return 'Your session expired. Please log in again.';
  if (text.includes('password')) return message || 'Please check the password and try again.';
  return message || 'Something went wrong. Please try again.';
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(dataService.mode === 'supabase' && isSupabaseConfigured);

  useEffect(() => {
    if (dataService.mode !== 'supabase' || !supabase) {
      dataService.setUserId(null);
      setLoading(false);
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user || null);
      dataService.setUserId(data.session?.user?.id || null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user || null);
      dataService.setUserId(nextSession?.user?.id || null);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    loading,
    async signIn(email, password) {
      if (!supabase) return { error: 'Supabase is not configured.' };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: friendlyAuthError(error.message) } : { message: 'Signed in.' };
    },
    async signUp(email, password) {
      if (!supabase) return { error: 'Supabase is not configured.' };
      const { error } = await supabase.auth.signUp({ email, password });
      return error ? { error: friendlyAuthError(error.message) } : { message: 'Account created. Check your email if confirmation is required.' };
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut();
      dataService.setUserId(null);
    },
    async resetPassword(email) {
      if (!supabase) return { error: 'Supabase is not configured.' };
      const redirectTo = `${window.location.origin}/login`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      return error ? { error: friendlyAuthError(error.message) } : { message: 'Password reset sent. Check your email.' };
    },
  }), [loading, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
