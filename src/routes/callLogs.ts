
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const querySchema = z.object({
    search: z.string().trim().max(150).optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    outcome: z.string().optional(),
    telecallerId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  });

  const parsed = querySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid call log filters.' });
  }

  const { search, from, to, outcome, telecallerId, page, limit } = parsed.data;
  const isAdmin = req.user!.role === 'admin';

  let query = supabaseAdmin
    .from('lead_activities')
    .select('id,lead_id,activity_type,call_outcome,call_datetime,duration_seconds,notes,questions,sales_stage_after,next_action,created_by,created_at', { count: 'exact' })
    .eq('activity_type', 'call')
    .order('call_datetime', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (!isAdmin) {
    query = query.eq('created_by', req.user!.id);
  } else if (telecallerId) {
    query = query.eq('created_by', telecallerId);
  }

  if (from) query = query.gte('call_datetime', `${from}T00:00:00+05:30`);
  if (to) query = query.lte('call_datetime', `${to}T23:59:59.999+05:30`);
  if (outcome) query = query.eq('call_outcome', outcome);

  const { data: activities, error, count } = await query;

  if (error) throw error;

  const activityRows = activities || [];
  const leadIds = [...new Set(activityRows.map(item => item.lead_id))];
  const userIds = [...new Set(activityRows.map(item => item.created_by))];

  const [leadResult, userResult] = await Promise.all([
    leadIds.length
      ? supabaseAdmin.from('leads').select('id,lead_code,name,company,phone,assigned_to').in('id', leadIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabaseAdmin.from('profiles').select('id,full_name,role').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (leadResult.error) throw leadResult.error;
  if (userResult.error) throw userResult.error;

  const leads = new Map((leadResult.data || []).map(item => [item.id, item]));
  const users = new Map((userResult.data || []).map(item => [item.id, item]));

  let items = activityRows.map(activity => ({
    ...activity,
    lead: leads.get(activity.lead_id) || null,
    telecaller: users.get(activity.created_by) || null,
  }));

  if (search) {
    const term = search.toLowerCase();

    items = items.filter(item =>
      item.lead?.name?.toLowerCase().includes(term) ||
      item.lead?.company?.toLowerCase().includes(term) ||
      item.lead?.phone?.toLowerCase().includes(term) ||
      item.lead?.lead_code?.toLowerCase().includes(term) ||
      item.telecaller?.full_name?.toLowerCase().includes(term)
    );
  }

  res.json({
    items,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}));

export default router;
