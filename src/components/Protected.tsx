import { Navigate, Outlet } from 'react-router-dom';
import type { Profile } from '../types';
export default function Protected({ profile, roles }: { profile: Profile | null; roles?: Array<'admin' | 'telecaller'> }) {
  if (!profile) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
