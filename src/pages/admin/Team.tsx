import { useEffect, useMemo, useState } from 'react';
import { Mail, RefreshCw, Shield, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { roleLabels, type UserProfile, type UserRole } from '../../auth/rbac';

const roles: UserRole[] = ['owner', 'admin', 'project_manager', 'estimator', 'crew', 'viewer'];

export function Team() {
  const { role, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const canManageTeam = role === 'owner' || role === 'admin';
  const sortedProfiles = useMemo(() => [...profiles].sort((a, b) => (a.email || '').localeCompare(b.email || '')), [profiles]);

  const loadProfiles = async () => {
    if (!supabase || !canManageTeam) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id,user_id,email,display_name,job_title,role,active')
      .order('email', { ascending: true });
    setLoading(false);
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    setProfiles((data || []) as UserProfile[]);
  };

  useEffect(() => {
    void loadProfiles();
  }, [canManageTeam]);

  const updateProfile = async (profile: UserProfile, updates: Partial<UserProfile>) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (error) {
      showToast(error.message, 'error');
      return;
    }
    setProfiles(items => items.map(item => item.id === profile.id ? { ...item, ...updates } : item));
    await refreshProfile();
    showToast('Team member updated');
  };

  const inviteUser = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!supabase || !email) {
      showToast('Enter an email address', 'error');
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { role: 'crew' },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    setInviteEmail('');
    showToast('Invite sent. New users start as crew until changed here.');
  };

  if (!canManageTeam) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <Shield size={36} />
          <h3>Team access restricted</h3>
          <p>Only owners and admins can manage user roles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Admin</div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">Invite users, assign roles, set job titles, and deactivate access.</p>
        </div>
        <button className="btn btn-secondary" onClick={loadProfiles} disabled={loading}>
          <RefreshCw size={18} /> Refresh
        </button>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">Invite User</h3>
        </div>
        <div className="card-body">
          <div className="flex items-center gap-2">
            <div className="search-bar flex-1">
              <Mail size={18} />
              <input className="form-input" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="name@company.com" />
            </div>
            <button className="btn btn-primary" onClick={inviteUser}><UserPlus size={18} /> Invite</button>
          </div>
          <p className="text-sm text-muted mt-2">Invited users are created as crew by default. Assign another role after their profile appears.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Users</h3>
        </div>
        <div className="card-body">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display Name</th>
                  <th>Job Title</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedProfiles.map(profile => (
                  <tr key={profile.id}>
                    <td>{profile.email || '-'}</td>
                    <td>
                      <input className="form-input" value={profile.display_name || ''} onChange={event => updateProfile(profile, { display_name: event.target.value })} />
                    </td>
                    <td>
                      <input className="form-input" value={profile.job_title || ''} onChange={event => updateProfile(profile, { job_title: event.target.value })} />
                    </td>
                    <td>
                      <select className="form-select" value={profile.role} onChange={event => updateProfile(profile, { role: event.target.value as UserRole })}>
                        {roles.map(item => <option key={item} value={item}>{roleLabels[item]}</option>)}
                      </select>
                    </td>
                    <td>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={profile.active} onChange={event => updateProfile(profile, { active: event.target.checked })} />
                        {profile.active ? 'Active' : 'Inactive'}
                      </label>
                    </td>
                  </tr>
                ))}
                {sortedProfiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted">No profiles found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
