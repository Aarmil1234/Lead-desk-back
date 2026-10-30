import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, normalizePhone } from '../lib/http.js';
import { supabaseAdmin } from '../lib/supabase.js';
const router = Router();
const activitySchema = z.object({ callDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), callTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), durationMinutes: z.number().min(0).max(1440).nullable().optional(), outcome: z.enum(['Not Received','Busy','Switched Off','Connected']), notes: z.string().trim().min(1).max(10000), questions: z.string().max(5000).optional().default(''), salesStage: z.enum(['New','Follow-up','Interested','Meeting Scheduled','Admin Callback','Won','Lost','Not Interested']), nextAction: z.enum(['Call again','Send quotation','Schedule meeting','Admin callback','No further action']), followupDate: z.string().nullable().optional(), priority: z.enum(['low','medium','high']).default('medium') });
async function assertLeadAccess(id: string, user: Express.Request['user']) {
  let q = supabaseAdmin.from('leads').select('*').eq('id',id);
  if (user?.role !== 'admin') q = q.eq('assigned_to', user!.id);
  return q.maybeSingle();
}
router.get('/', asyncHandler(async (req,res) => {
  const user = req.user!; let query = supabaseAdmin.from('leads').select('*').order('next_follow_up_at',{ascending:true,nullsFirst:false}).limit(Math.min(Number(req.query.limit)||500,1000));
  if (user.role !== 'admin') query = query.eq('assigned_to',user.id);
  if (typeof req.query.q === 'string' && req.query.q.trim()) { const q = req.query.q.trim().replace(/[(),]/g,' '); query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`); }
  if (typeof req.query.stage === 'string' && req.query.stage) query = query.eq('sales_stage',req.query.stage);
  if (typeof req.query.outcome === 'string' && req.query.outcome) query = query.eq('call_outcome',req.query.outcome);
  const {data,error}=await query; if(error) throw error;
  let items = data || [];
  if (typeof req.query.stage === 'string' && req.query.stage === 'Admin Callback' && user.role === 'admin') items = items.filter(l => l.sales_stage === 'Admin Callback');
  res.json({items});
}));
router.get('/:id', asyncHandler(async (req,res) => { const {data,error}=await assertLeadAccess(req.params.id,req.user); if(error) throw error; if(!data) return res.status(404).json({error:'Lead not found or you do not have access.'}); res.json({lead:data}); }));
router.get('/:id/activities', asyncHandler(async (req,res) => {
  const {data:lead,error:leadError}=await assertLeadAccess(req.params.id,req.user); if(leadError) throw leadError; if(!lead) return res.status(404).json({error:'Lead not found or you do not have access.'});
  const {data,error}=await supabaseAdmin.from('lead_activities').select('*').eq('lead_id',req.params.id).order('created_at',{ascending:false}); if(error) throw error;
  const ids=[...new Set((data||[]).map(a=>a.created_by))]; const {data:profiles}=ids.length?await supabaseAdmin.from('profiles').select('id,full_name').in('id',ids):{data:[] as {id:string;full_name:string}[]}; const names=new Map((profiles||[]).map(p=>[p.id,p.full_name]));
  res.json({items:(data||[]).map(a=>({...a,actor_name:names.get(a.created_by)||'Team member'}))});
}));
router.post('/:id/activities', asyncHandler(async (req,res) => {
  const parsed=activitySchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:parsed.error.issues[0]?.message||'Invalid call update.'});
  const {data:lead,error:leadError}=await assertLeadAccess(req.params.id,req.user); if(leadError) throw leadError; if(!lead) return res.status(404).json({error:'Lead not found or you do not have access.'});
  const body=parsed.data;
  if (['Won','Lost','Not Interested'].includes(body.salesStage) && body.nextAction !== 'No further action') return res.status(400).json({error:'Closed leads must use No further action.'});
  if (body.followupDate && body.followupDate < body.callDate) return res.status(400).json({error:'Follow-up date cannot be before the call date.'});
  const {data,error}=await supabaseAdmin.rpc('save_call_update',{p_lead_id:req.params.id,p_user_id:req.user!.id,p_call_datetime:`${body.callDate}T${body.callTime}:00+05:30`,p_duration_seconds:body.durationMinutes == null ? null : Math.round(body.durationMinutes*60),p_outcome:body.outcome,p_notes:body.notes,p_questions:body.questions,p_sales_stage:body.salesStage,p_next_action:body.nextAction,p_followup_date:body.nextAction==='No further action'?null:body.followupDate||null,p_priority:body.priority});
  if(error) throw error; res.status(201).json({activity:data,message:'Call update saved.'});
}));
router.patch('/:id', asyncHandler(async (req,res) => {
  if(req.user!.role!=='admin') return res.status(403).json({error:'Only admin can edit lead master details.'});
  const schema=z.object({name:z.string().trim().min(1).max(200).optional(),company:z.string().max(200).nullable().optional(),phone:z.string().trim().min(5).max(40).optional(),email:z.string().email().nullable().optional(),source:z.string().max(100).nullable().optional(),priority:z.enum(['low','medium','high']).optional()});
  const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:parsed.error.issues[0]?.message});
  const updates={...parsed.data,...(parsed.data.phone?{phone:normalizePhone(parsed.data.phone)}:{}),updated_at:new Date().toISOString()}; const {data,error}=await supabaseAdmin.from('leads').update(updates).eq('id',req.params.id).select().single(); if(error) throw error; res.json({lead:data});
}));
export default router;
