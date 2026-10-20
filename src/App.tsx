import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { api } from './lib/api';
import type { Profile } from './types';
import Layout from './components/Layout';
import Protected from './components/Protected';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import ImportLeads from './pages/ImportLeads';
import FollowUps from './pages/FollowUps';
import Placeholder from './pages/Placeholder';
import Users from './pages/Users';
import Telecallers from './pages/telecallers';
import TelecallerDetail from './pages/telecallerDetails';
import Reports from './pages/Reports';
import ProgressReport from './pages/progressReport';
import LeadReport from './pages/LeadReport';
import Settings from './pages/Settings';
import CallLogs from './pages/CallLog';

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null); const [loading, setLoading] = useState(true); const [authError, setAuthError] = useState('');
  useEffect(() => {
    let live = true; async function resolve(sessionUser?: { id: string; email?: string }) { if (!sessionUser) { if (live) { setProfile(null); setLoading(false) } return; } try { const result = await api<{ profile: Profile }>('/auth/me'); if (live) setProfile({ ...result.profile, email: sessionUser.email }); } catch (e) { if (live) { setProfile(null); setAuthError(e instanceof Error ? e.message : 'Unable to load profile') } } finally { if (live) setLoading(false) } }
    supabase.auth.getSession().then(({ data }) => resolve(data.session?.user)); const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setLoading(true); setTimeout(() => { void resolve(session?.user) }, 0) }); return () => { live = false; subscription.unsubscribe() };
  }, []);
  if (loading) return <div className="app-loading"><div className="loading-brand">LeadDesk</div><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading…</span></div></div>;
  return <BrowserRouter><Routes>
    <Route path="/login" element={profile ? <Navigate to="/" replace /> : <Login />} />
    <Route element={<Protected profile={profile} />}>
      <Route element={<Layout profile={profile!} />}>
    <Route path="/telecallers" element={<Telecallers />} />
    <Route path="/telecallers/:id" element={<TelecallerDetail />} />
        <Route index element={<Dashboard profile={profile!} />} />
        <Route path="leads" element={<Leads profile={profile!} />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="follow-ups" element={<FollowUps />} />
        <Route element={<Protected profile={profile} roles={['admin']} />}>
        <Route path="import" element={<ImportLeads />} />
        <Route path="callbacks" element={<Navigate to="/leads?stage=Admin%20Callback" replace />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="/reports/progress" element={<ProgressReport />} />
        <Route
  path="/settings"
  element={profile ? <Settings profile={profile} /> : <Navigate to="/login" replace />}
/>

<Route
  path="/call-logs"
  element={<CallLogs />}
/>
<Route path="/reports/leads" element={<LeadReport />} />
        <Route path="settings" element={<Placeholder title="Settings" />} />
        </Route>
        <Route element={<Protected profile={profile} roles={['telecaller']} />}>
        <Route path="activity" element={<Placeholder title="My activity" />} />
        </Route>
        </Route></Route><Route path="*" element={<Navigate to={profile ? '/' : '/login'} replace />} />
        </Routes>{authError && <div className="auth-toast" role="alert">{authError}</div>}
        </BrowserRouter>;
}
