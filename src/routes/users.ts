
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(10).max(128),
  role: z.enum(['admin', 'telecaller']).default('telecaller'),
});

async function countReferences(
  table: string,
  column: string,
  userId: string,
) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, userId);

  if (error) throw error;
  return count ?? 0;
}

router.get('/', asyncHandler(async (req, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can manage users.' });
  }

  const role = typeof req.query.role === 'string'
    ? req.query.role
    : undefined;

  let query = supabaseAdmin
    .from('profiles')
    .select('id,full_name,role,is_active,created_at')
    .order('created_at', { ascending: false });

  if (role === 'telecaller' || role === 'admin') {
    query = query.eq('role', role);
  }

  if (req.query.active === 'true') query = query.eq('is_active', true);
  if (req.query.active === 'false') query = query.eq('is_active', false);

  const { data, error } = await query;
  if (error) throw error;

  const ids = (data ?? []).map(user => user.id);
  const emails = new Map<string, string>();

  if (ids.length) {
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authError) throw authError;

    for (const user of authData.users) {
      if (ids.includes(user.id)) {
        emails.set(user.id, user.email ?? '');
      }
    }
  }

  return res.json({
    items: (data ?? []).map(user => ({
      ...user,
      email: emails.get(user.id) ?? '',
    })),
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create users.' });
  }

  const parsed = createSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message ?? 'Check the user details.',
    });
  }

  const { fullName, email, password, role } = parsed.data;

  const { data: created, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

  if (createError || !created.user) {
    return res.status(400).json({
      error: createError?.message ?? 'Unable to create the account.',
    });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: created.user.id,
      full_name: fullName,
      role,
      is_active: true,
    })
    .select('id,full_name,role,is_active,created_at')
    .single();

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    throw profileError;
  }

  return res.status(201).json({
    user: { ...profile, email: created.user.email ?? email },
  });
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can update user status.' });
  }

  if (req.params.id === req.user!.id) {
    return res.status(400).json({
      error: 'You cannot change your own account status here.',
    });
  }

  const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Provide a valid active status.' });
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from('profiles')
    .select('id,role,is_active')
    .eq('id', req.params.id)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) return res.status(404).json({ error: 'User not found.' });

  if (target.role !== 'telecaller') {
    return res.status(403).json({
      error: 'Only telecaller accounts can be managed from this screen.',
    });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      is_active: parsed.data.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select('id,full_name,role,is_active,created_at')
    .single();

  if (error) throw error;

  return res.json({ user: data });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can delete users.' });
  }

  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from('profiles')
    .select('id,full_name,role')
    .eq('id', req.params.id)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) return res.status(404).json({ error: 'User not found.' });

  if (target.role !== 'telecaller') {
    return res.status(403).json({
      error: 'Only telecaller accounts can be permanently deleted here.',
    });
  }

  const references = [
    { table: 'leads', column: 'assigned_to', label: 'assigned leads' },
    { table: 'leads', column: 'created_by', label: 'created leads' },
    { table: 'lead_activities', column: 'created_by', label: 'call history entries' },
    { table: 'follow_ups', column: 'assigned_to', label: 'follow-ups' },
    { table: 'follow_ups', column: 'created_by', label: 'created follow-ups' },
    { table: 'lead_imports', column: 'assigned_to', label: 'lead import batches' },
    { table: 'lead_imports', column: 'uploaded_by', label: 'uploaded import batches' },
  ];

  const blockers: string[] = [];

  for (const reference of references) {
    const count = await countReferences(
      reference.table,
      reference.column,
      req.params.id,
    );

    if (count > 0) {
      blockers.push(`${count} ${reference.label}`);
    }
  }

  if (blockers.length) {
    return res.status(409).json({
      error: `This telecaller's history must be preserved. Reassign their leads and retain historical attribution before deletion. Records found: ${blockers.join(', ')}. Deactivate the account instead.`,
      blockers,
    });
  }

  const { error: deleteError } =
    await supabaseAdmin.auth.admin.deleteUser(req.params.id);

  if (deleteError) throw deleteError;

  return res.json({
    message: `${target.full_name} was permanently deleted.`,
    id: target.id,
  });
}));

export default router;
