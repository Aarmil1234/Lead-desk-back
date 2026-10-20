
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

const stages = [
  'New',
  'Follow-up',
  'Interested',
  'Meeting Scheduled',
  'Admin Callback',
  'Won',
  'Lost',
  'Not Interested',
] as const;

function getStats(leads: any[]) {
  const now = Date.now();

  const activeLeads = leads.filter(
    lead => !['Won', 'Lost', 'Not Interested'].includes(lead.sales_stage)
  );

  const contacted = leads.filter(lead => lead.last_contacted_at).length;

  const stats: Record<string, number> = {};

  for (const stage of stages) {
    stats[stage] = leads.filter(lead => lead.sales_stage === stage).length;
  }

  const overdue = activeLeads.filter(lead =>
    lead.next_follow_up_at &&
    new Date(lead.next_follow_up_at).getTime() < now
  ).length;

  const dueToday = activeLeads.filter(lead => {
    if (!lead.next_follow_up_at) return false;

    const due = new Date(lead.next_follow_up_at);
    const today = new Date();

    return due.getFullYear() === today.getFullYear() &&
      due.getMonth() === today.getMonth() &&
      due.getDate() === today.getDate();
  }).length;

  return {
    assigned: leads.length,
    contacted,
    notContacted: leads.length - contacted,
    contactRate: leads.length
      ? Math.round((contacted / leads.length) * 100)
      : 0,
    overdue,
    dueToday,
    won: stats.Won,
    lost: stats.Lost,
    interested: stats.Interested,
    followUps: stats['Follow-up'],
    adminCallbacks: stats['Admin Callback'],
    stages: stats,
  };
}

async function loadAssignedLeads(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select(`
      id,
      lead_code,
      name,
      company,
      phone,
      email,
      sales_stage,
      call_outcome,
      priority,
      last_contacted_at,
      next_follow_up_at,
      created_at
    `)
    .eq('assigned_to', userId)
    .order('next_follow_up_at', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data ?? [];
}

router.get('/', asyncHandler(async (req, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select('id,full_name,role,is_active,created_at')
    .eq('role', 'telecaller')
    .order('full_name');

  if (error) throw error;

  const items = await Promise.all(
    (users ?? []).map(async user => {
      const leads = await loadAssignedLeads(user.id);

      return {
        ...user,
        stats: getStats(leads),
      };
    })
  );

  return res.json({ items });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  const parsed = z.string().uuid().safeParse(req.params.id);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid telecaller ID.' });
  }

  const { data: telecaller, error } = await supabaseAdmin
    .from('profiles')
    .select('id,full_name,role,is_active,created_at')
    .eq('id', parsed.data)
    .eq('role', 'telecaller')
    .maybeSingle();

  if (error) throw error;

  if (!telecaller) {
    return res.status(404).json({ error: 'Telecaller not found.' });
  }

  const leads = await loadAssignedLeads(telecaller.id);

  return res.json({
    telecaller,
    stats: getStats(leads),
    leads,
  });
}));

export default router;
