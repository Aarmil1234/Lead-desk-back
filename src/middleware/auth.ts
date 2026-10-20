import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin, supabaseAuth } from '../lib/supabase.js';

export type AuthUser = { id: string; email?: string; role: 'admin' | 'telecaller'; full_name: string };
declare global { namespace Express { interface Request { user?: AuthUser } } }

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required.' });
    const token = header.slice(7);
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !authData.user) return res.status(401).json({ error: 'Session is invalid or expired. Please sign in again.' });
    const { data: profile, error } = await supabaseAdmin.from('profiles').select('id,full_name,role,is_active').eq('id', authData.user.id).single();
    if (error || !profile || !profile.is_active) return res.status(403).json({ error: 'Your account is not active or does not have a CRM profile.' });
    if (profile.role !== 'admin' && profile.role !== 'telecaller') return res.status(403).json({ error: 'Your account has an invalid CRM role.' });
    req.user = { id: profile.id, full_name: profile.full_name, role: profile.role, email: authData.user.email };
    next();
  } catch { res.status(500).json({ error: 'Unable to verify session.' }); }
}

export function requireRole(...roles: Array<'admin' | 'telecaller'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    next();
  };
}
