
import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Profile lookup failed:', error.message);
      return res.status(500).json({
        error: 'Unable to load your CRM profile.',
      });
    }

    if (!data) {
      return res.status(404).json({
        error: 'No CRM profile exists for this account.',
      });
    }

    if (!data.is_active) {
      return res.status(403).json({
        error: 'Your CRM account is inactive.',
      });
    }

    if (data.role !== 'admin' && data.role !== 'telecaller') {
      return res.status(403).json({
        error: 'Your account has an invalid CRM role.',
      });
    }

    return res.json({
      profile: {
        id: data.id,
        full_name: data.full_name,
        role: data.role,
        email: req.user!.email,
      },
    });
  })
);

export default router;
