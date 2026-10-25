
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, normalizePhone } from '../lib/http.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

const rowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().max(200).optional().default(''),
  phone: z.string().trim().min(5).max(40),
  email: z.string().trim().optional().default(''),
  source: z.string().max(100).optional().default('Spreadsheet')
});

router.post('/', asyncHandler(async (req, res) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can import leads.' });
  }

  const bodySchema = z.object({
    fileName: z.string().min(1).max(255),
    assignedTo: z.string().uuid(),
    rows: z.array(z.unknown()).min(1)
  });

  const parsed = bodySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Provide a filename and at least one valid row.'
    });
  }

  const maxRows = Number(process.env.MAX_IMPORT_ROWS) || 2000;

  if (parsed.data.rows.length > maxRows) {
    return res.status(413).json({
      error: `Import limit is ${maxRows} rows per file.`
    });
  }

  const telecallerId = parsed.data.assignedTo;

  const { data: assignee, error: assigneeError } = await supabaseAdmin
    .from('profiles')
    .select('id,role,is_active')
    .eq('id', telecallerId)
    .single();

  if (
    assigneeError ||
    !assignee ||
    assignee.role !== 'telecaller' ||
    !assignee.is_active
  ) {
    return res.status(400).json({
      error: 'Choose an active telecaller before importing leads.'
    });
  }

  const normalized = parsed.data.rows.map(row => rowSchema.safeParse(row));
  const valid = normalized
    .filter(row => row.success)
    .map(row => (row as { success: true; data: z.infer<typeof rowSchema> }).data);

  const rejected = normalized.length - valid.length;

  if (!valid.length) {
    return res.status(400).json({
      error: 'No rows passed validation.',
      imported: 0,
      reassigned: 0,
      skipped: 0,
      rejected
    });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('leads')
    .select('id,phone,assigned_to');

  if (existingError) throw existingError;

  const existingAssignments = new Set(
    (existing || []).map(lead =>
      `${normalizePhone(lead.phone)}:${lead.assigned_to || ''}`
    )
  );

  const seenInFile = new Set<string>();
  const toInsert: z.infer<typeof rowSchema>[] = [];
  let skipped = 0;

  for (const row of valid) {
    const phone = normalizePhone(row.phone);

    if (!phone || seenInFile.has(phone)) {
      skipped++;
      continue;
    }

    seenInFile.add(phone);

    const assignmentKey = `${phone}:${telecallerId}`;

    if (existingAssignments.has(assignmentKey)) {
      skipped++;
      continue;
    }

    toInsert.push(row);
    existingAssignments.add(assignmentKey);
  }

  const importId = crypto.randomUUID();

  const { error: batchError } = await supabaseAdmin
    .from('lead_imports')
    .insert({
      id: importId,
      file_name: parsed.data.fileName,
      uploaded_by: req.user!.id,
      assigned_to: telecallerId,
      total_rows: parsed.data.rows.length,
      valid_rows: valid.length,
      imported_rows: 0,
      skipped_rows: skipped,
      rejected_rows: rejected,
      status: 'processing'
    });

  if (batchError) throw batchError;

  let imported = 0;

  try {
    for (let i = 0; i < toInsert.length; i += 250) {
      const batch = toInsert.slice(i, i + 250).map(row => ({
        lead_code: `LD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        name: row.name,
        company: row.company || null,
        phone: normalizePhone(row.phone),
        email: row.email || null,
        source: row.source || parsed.data.fileName,
        assigned_to: telecallerId,
        created_by: req.user!.id,
        import_batch_id: importId,
        sales_stage: 'New',
        call_outcome: null,
        priority: 'medium',
        last_contacted_at: null,
        next_follow_up_at: null
      }));

      const { data, error } = await supabaseAdmin
        .from('leads')
        .insert(batch)
        .select('id');

      if (error) throw error;

      imported += (data || []).length;
    }

    const { error: completionError } = await supabaseAdmin
      .from('lead_imports')
      .update({
        imported_rows: imported,
        skipped_rows: skipped,
        rejected_rows: rejected,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', importId);

    if (completionError) throw completionError;
  } catch (error) {
    await supabaseAdmin
      .from('lead_imports')
      .update({
        imported_rows: imported,
        skipped_rows: skipped,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Import failed',
        completed_at: new Date().toISOString()
      })
      .eq('id', importId);

    throw error;
  }

  res.status(201).json({
    importId,
    imported,
    reassigned: 0,
    skipped,
    rejected
  });
}));

export default router;
