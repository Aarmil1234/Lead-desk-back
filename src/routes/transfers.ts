
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, normalizePhone } from '../lib/http.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

const transferSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  leadIds: z.array(z.string().uuid()).min(1).max(500)
});

router.post('/', asyncHandler(async (req, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can transfer leads.' });
  }

  const parsed = transferSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Invalid transfer request.'
    });
  }

  const { sourceId, targetId, leadIds } = parsed.data;
  const uniqueIds = [...new Set(leadIds)];

  if (sourceId === targetId) {
    return res.status(400).json({
      error: 'Source and destination telecallers must be different.'
    });
  }

  const { data: users, error: usersError } = await supabaseAdmin
    .from('profiles')
    .select('id,role,is_active')
    .in('id', [sourceId, targetId]);

  if (usersError) throw usersError;

  const source = users?.find(user => user.id === sourceId);
  const target = users?.find(user => user.id === targetId);

  if (!source || source.role !== 'telecaller' || !source.is_active) {
    return res.status(400).json({
      error: 'The source must be an active telecaller.'
    });
  }

  if (!target || target.role !== 'telecaller' || !target.is_active) {
    return res.status(400).json({
      error: 'The destination must be an active telecaller.'
    });
  }

  const { data: sourceLeads, error: sourceError } = await supabaseAdmin
    .from('leads')
    .select('id,phone')
    .in('id', uniqueIds)
    .eq('assigned_to', sourceId);

  if (sourceError) throw sourceError;

  if (!sourceLeads || sourceLeads.length !== uniqueIds.length) {
    return res.status(409).json({
      error: 'Some selected leads are no longer assigned to the source telecaller. Refresh and try again.'
    });
  }

  const phones = [...new Set(
    sourceLeads.map(lead => normalizePhone(lead.phone)).filter(Boolean)
  )];

  if (phones.length) {
    const { data: targetLeads, error: targetError } = await supabaseAdmin
      .from('leads')
      .select('phone')
      .eq('assigned_to', targetId);

    if (targetError) throw targetError;

    const targetPhones = new Set(
      (targetLeads || []).map(lead => normalizePhone(lead.phone))
    );

    const duplicates = phones.filter(phone => targetPhones.has(phone));

    if (duplicates.length) {
      return res.status(409).json({
        error: `${duplicates.length} selected lead(s) already exist for the destination telecaller. No leads were transferred.`
      });
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('leads')
    .update({ assigned_to: targetId, updated_at: new Date().toISOString() })
    .in('id', uniqueIds)
    .eq('assigned_to', sourceId)
    .select('id');

  if (updateError) throw updateError;

  if (!updated || updated.length !== uniqueIds.length) {
    return res.status(409).json({
      error: 'Not all leads could be transferred. Refresh the page and verify the assignments.'
    });
  }

  return res.json({ transferred: updated.length });
}));

export default router;
