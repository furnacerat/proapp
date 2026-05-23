import React, { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { APP_LOGO_SRC } from '../../config/appIdentity';

type AuthMode = 'login' | 'signup' | 'forgot';

interface AuthPageProps {
  mode: AuthMode;
}

const content = {
  login: {
    eyebrow: 'Secure workspace',
    title: 'Log in to your workspace',
    subtitle: 'Access your synced contractor operating system.',
    action: 'Log In',
  },
  signup: {
    eyebrow: 'Create account',
    title: 'Start your synced workspace',
    subtitle: 'Create a Supabase-backed account for your company data.',
    action: 'Create Account',
  },
  forgot: {
    eyebrow: 'Password reset',
    title: 'Reset your password',
    subtitle: 'We will send a reset link to your email.',
    action: 'Send Reset Link',
  },
};

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const copy = content[mode];

  if (dataService.mode === 'local') return <Navigate to="/" replace />;
  if (!loading && user) return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    const result = mode === 'login'
      ? await signIn(email, password)
      : mode === 'signup'
        ? await signUp(email, password)
        : await resetPassword(email);

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage(result.message || 'Done.');
    if (mode === 'login') navigate('/');
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="auth-logo"><img src={APP_LOGO_SRC} alt="" /></div>
          <div>
            <p className="auth-eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
          </div>
        </div>
        <p className="auth-subtitle">{copy.subtitle}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <div className="auth-input">
              <Mail size={18} />
              <input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" />
            </div>
          </label>

          {mode !== 'forgot' && (
            <label>
              <span>Password</span>
              <div className="auth-input">
                <Lock size={18} />
                <input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </div>
            </label>
          )}

          {error && <div className="auth-alert auth-alert-error">{error}</div>}
          {message && <div className="auth-alert auth-alert-success">{message}</div>}

          <button className="btn btn-primary auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Working...' : copy.action}
          </button>
        </form>

        <div className="auth-links">
          {mode !== 'login' && <Link to="/login">Back to login</Link>}
          {mode === 'login' && <Link to="/signup">Create account</Link>}
          {mode === 'login' && <Link to="/forgot-password">Forgot password?</Link>}
        </div>
      </section>
    </main>
  );
}
