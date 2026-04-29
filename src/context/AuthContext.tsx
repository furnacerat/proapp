import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { dataService } from '../services/dataService';
import type { UserProfile, UserRole } from '../auth/rbac';

type AuthResult = { error?: string; message?: string };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(dataService.mode === 'supabase' && isSupabaseConfigured);

  const loadProfile = async (nextUser: User | null) => {
    if (dataService.mode !== 'supabase' || !supabase || !nextUser) {
      setProfile(null);
      dataService.setRole('owner');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id,user_id,role,display_name,email,job_title,active')
      .eq('user_id', nextUser.id)
      .maybeSingle();

    if (error || !data) {
      const fallbackRole = (nextUser.user_metadata?.role as UserRole) || 'crew';
      await supabase.from('profiles').upsert({
        user_id: nextUser.id,
        email: nextUser.email || '',
        display_name: nextUser.user_metadata?.display_name || nextUser.email || '',
        job_title: nextUser.user_metadata?.job_title || '',
        role: fallbackRole,
        active: true,
      }, { onConflict: 'user_id' });
      dataService.setRole(fallbackRole);
      setProfile({
        id: nextUser.id,
        user_id: nextUser.id,
        role: fallbackRole,
        display_name: nextUser.user_metadata?.display_name || nextUser.email || '',
        email: nextUser.email || '',
        job_title: nextUser.user_metadata?.job_title || '',
        active: true,
      });
      return;
    }

    dataService.setRole(data.role);
    setProfile({
      id: data.id,
      user_id: data.user_id,
      role: data.role,
      display_name: data.display_name || data.email || nextUser.email || '',
      email: data.email || nextUser.email || '',
      job_title: data.job_title || '',
      active: data.active !== false,
    });
  };

  useEffect(() => {
    if (dataService.mode !== 'supabase' || !supabase) {
      dataService.setUserId(null);
      dataService.setRole('owner');
      setLoading(false);
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user || null);
      dataService.setUserId(data.session?.user?.id || null);
      loadProfile(data.session?.user || null).finally(() => {
        if (active) setLoading(false);
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user || null);
      dataService.setUserId(nextSession?.user?.id || null);
      setLoading(true);
      loadProfile(nextSession?.user || null).finally(() => setLoading(false));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    profile,
    role: profile?.role || 'owner',
    loading,
    async signIn(email, password) {
      if (!supabase) return { error: 'Supabase is not configured.' };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: friendlyAuthError(error.message) } : { message: 'Signed in.' };
    },
    async signUp(email, password) {
      if (!supabase) return { error: 'Supabase is not configured.' };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: 'crew' } },
      });
      if (error) return { error: friendlyAuthError(error.message) };
      if (data.user) {
        await supabase.from('profiles').upsert({
          user_id: data.user.id,
          email,
          display_name: email,
          role: 'crew',
          active: true,
        }, { onConflict: 'user_id' });
      }
      return { message: 'Account created. Check your email if confirmation is required.' };
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut();
      dataService.setUserId(null);
      dataService.setRole('owner');
    },
    async resetPassword(email) {
      if (!supabase) return { error: 'Supabase is not configured.' };
      const redirectTo = `${window.location.origin}/login`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      return error ? { error: friendlyAuthError(error.message) } : { message: 'Password reset sent. Check your email.' };
    },
    async refreshProfile() {
      await loadProfile(user);
    },
  }), [loading, profile, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
