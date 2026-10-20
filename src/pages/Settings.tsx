
import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

export default function Settings({ profile }: { profile: Profile }) {
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setEmail(data.user?.email || '');
    });

    return () => {
      active = false;
    };
  }, []);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 10) {
      setError('Your new password must contain at least 10 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('The new password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('Choose a password different from your current password.');
      return;
    }

    setSaving(true);

    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (verifyError) throw new Error('Your current password is incorrect.');

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Your password has been updated successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update your password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <div className="eyebrow">WORKSPACE CONFIGURATION</div>
          <h1>Settings</h1>
          <p>Manage your account security and workspace access.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && (
        <div className="alert alert-success d-flex align-items-center">
          <CheckCircle2 size={17} className="me-2" />
          {success}
        </div>
      )}

      <div className="row g-4">
        <div className="col-xl-5">
          <section className="surface-card h-100">
            <div className="section-heading">
              <div>
                <h2><UserRound size={18} className="me-2" /> Account profile</h2>
                <p>Your current LeadDesk account details.</p>
              </div>
            </div>

            <div className="settings-profile">
              <div className="settings-avatar">
                {profile.full_name?.slice(0, 1).toUpperCase() || 'U'}
              </div>
              <div>
                <strong>{profile.full_name}</strong>
                <div className="table-sub">{email || 'Loading email...'}</div>
                <span className="soft-badge soft-neutral mt-2">
                  {profile.role === 'admin' ? 'Administrator' : 'Telecaller'}
                </span>
              </div>
            </div>

            <div className="settings-security-note">
              <ShieldCheck size={19} />
              <div>
                <strong>Protected account</strong>
                <p>Your account access is managed through Supabase Authentication.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="col-xl-7">
          <section className="surface-card">
            <div className="section-heading">
              <div>
                <h2><LockKeyhole size={18} className="me-2" /> Change password</h2>
                <p>Use your current password to authorize a password change.</p>
              </div>
            </div>

            <form onSubmit={changePassword}>
              <div className="mb-3">
                <label className="form-label">Current password</label>
                <input
                  className="form-control"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">New password</label>
                <input
                  className="form-control"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
                <div className="form-text">Use at least 10 characters.</div>
              </div>

              <div className="mb-4">
                <label className="form-label">Confirm new password</label>
                <input
                  className="form-control"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={saving || !email}>
                {saving ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
