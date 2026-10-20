import { FormEvent, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleUserRound,
  LoaderCircle,
  UserPlus,
  UserRoundX,
  UsersRound,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';

type TeamUser = { id: string; full_name: string; email: string; role: 'admin' | 'telecaller'; is_active: boolean; created_at: string };
export default function Users() {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [items, setItems] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function loadUsers() { setLoading(true); try { const result = await api<{items:TeamUser[]}>('/users'); setItems(result.items); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load users.'); } finally { setLoading(false); } }
  useEffect(() => { void loadUsers(); }, []);
  async function addTelecaller(event: FormEvent) { event.preventDefault(); setError(''); setSuccess(''); setSaving(true); try { const result = await api<{user:TeamUser}>('/users', { method: 'POST', body: JSON.stringify({ fullName, email, password, role: 'telecaller' }) }); setItems(current => [result.user, ...current]); setFullName(''); setEmail(''); setPassword(''); setSuccess(`${result.user.full_name} has been added as an active telecaller.`); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create telecaller.'); } finally { setSaving(false); } }
  async function toggleActive(user: TeamUser) { setError(''); setSuccess(''); try { const result = await api<{user:TeamUser}>(`/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.is_active }) }); setItems(current => current.map(item => item.id === user.id ? { ...item, ...result.user } : item)); setSuccess(`${user.full_name} is now ${result.user.is_active ? 'active' : 'inactive'}.`); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update user.'); } }
  async function deleteUser(user: TeamUser) {
  const confirmed = window.confirm(
    `Permanently delete ${user.full_name} (${user.email})?\n\n` +
    'This cannot be undone. Historical records will be preserved, ' +
    'and deletion will be blocked if records still reference this user.'
  );

  if (!confirmed) return;

  setError('');
  setSuccess('');
  setDeletingId(user.id);

  try {
    const result = await api<{ message: string }>(
      `/users/${user.id}`,
      { method: 'DELETE' }
    );

    setItems(current => current.filter(item => item.id !== user.id));
    setSuccess(result.message);
  } catch (e) {
    setError(
      e instanceof Error ? e.message : 'Unable to delete this user.'
    );
  } finally {
    setDeletingId(null);
  }
}
  const telecallers = items.filter(user => user.role === 'telecaller');
  return <div className="page-stack"><div className="page-heading"><div><div className="eyebrow">TEAM MANAGEMENT</div><h1>Telecaller management</h1><p>Add team members, control access and choose which active telecaller receives each lead import.</p></div><div className="heading-count"><UsersRound size={16}/><strong>{telecallers.length}</strong> telecallers</div></div>{error && <div className="alert alert-danger">{error}</div>}{success && <div className="alert alert-success"><CheckCircle2 size={17} className="me-2"/>{success}</div>}<div className="row g-4"><div className="col-xl-5"><section className="surface-card h-100"><div className="section-heading"><div><h2><UserPlus size={18} className="me-2"/>Add telecaller</h2><p>Create a login account and activate it immediately.</p></div></div><form onSubmit={addTelecaller}><div className="mb-3"><label className="form-label" htmlFor="fullName">Full name *</label><input id="fullName" className="form-control" value={fullName} onChange={e=>setFullName(e.target.value)} minLength={2} maxLength={120} required placeholder="e.g. Priya Patel"/></div><div className="mb-3"><label className="form-label" htmlFor="email">Email address *</label><input id="email" className="form-control" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={255} required placeholder="name@company.com"/></div><div className="mb-3"><label className="form-label" htmlFor="password">Temporary password *</label><input id="password" className="form-control" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={10} maxLength={128} required placeholder="At least 10 characters"/><div className="form-text">Share securely with the telecaller and ask them to change it after their first login.</div></div><button className="btn btn-primary w-100" type="submit" disabled={saving}>{saving ? <><LoaderCircle size={16} className="spin"/> Creating account…</> : <><UserPlus size={16}/> Create telecaller account</>}</button></form></section></div><div className="col-xl-7"><section className="surface-card"><div className="section-heading"><div><h2>Team members</h2><p>Inactive telecallers cannot receive new lead imports.</p></div><button className="btn btn-sm btn-outline-secondary" onClick={()=>void loadUsers()} disabled={loading}>Refresh</button></div>{loading ? <div className="loading-panel"><LoaderCircle className="spin" size={22}/> Loading team…</div> : items.length === 0 ? <div className="empty-state"><div className="empty-icon"><CircleUserRound size={22}/></div><strong>No team members found</strong><span>Create a telecaller account to get started.</span></div> : <div className="table-responsive"><table className="table crm-table align-middle"><thead><tr><th>Team member</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.map(user=><tr key={user.id}><td><div className="d-flex align-items-center gap-2"><div className="mini-avatar">{user.full_name.slice(0,1).toUpperCase()}</div><div><div className="lead-link">{user.full_name}</div><div className="table-sub">{user.email}</div></div></div></td><td><span className="soft-badge soft-neutral">{user.role === 'admin' ? 'Admin' : 'Telecaller'}</span></td><td><span className={`soft-badge ${user.is_active?'soft-green':'soft-red'}`}>{user.is_active?'Active':'Inactive'}</span></td>
<td>
  {user.role === 'telecaller' ? (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <button
        className={`btn btn-sm ${user.is_active ? 'btn-outline-success' : 'btn-outline-danger '}`}
        onClick={() => void toggleActive(user)}
        disabled={deletingId === user.id}
      >
        {user.is_active ? (
          <><CheckCircle2 size={14} /></>
        ) : (
          <><UserRoundX size={14} /></>
        )}
      </button>

      <button
        className="btn btn-sm btn-outline-danger"
        onClick={() => void deleteUser(user)}
        disabled={deletingId === user.id}
      >
        {deletingId === user.id ? (
          <><LoaderCircle size={14} className="spin" /></>
        ) : (
          <><Trash2 size={14} /></>
        )}
      </button>
    </div>
  ) : (
    <span className="text-muted small">Protected admin</span>
  )}
</td>
</tr>)}</tbody></table></div>}</section></div></div></div>;
}
