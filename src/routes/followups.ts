import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { supabaseAdmin } from '../lib/supabase.js';
const router=Router();
router.get('/',asyncHandler(async(req,res)=>{
  const user=req.user!; const view=typeof req.query.view==='string'?req.query.view:'priority'; let query=supabaseAdmin.from('follow_ups').select('*,leads(id,lead_code,name,company,phone,sales_stage)').order('due_at',{ascending:view!=='priority'}).limit(500);
  if(user.role!=='admin') query=query.eq('assigned_to',user.id);
  if(view==='completed') query=query.eq('status','completed'); else query=query.eq('status','pending');
  if(view==='upcoming') query=query.gte('due_at',new Date().toISOString());
  if(view==='priority') query=query.lte('due_at',new Date(Date.now()+24*60*60*1000).toISOString());
  const {data,error}=await query; if(error) throw error; let items=data||[];
  if(view==='priority') items=items.sort((a,b)=>new Date(a.due_at).getTime()-new Date(b.due_at).getTime());
  res.json({items});
}));
router.post('/',asyncHandler(async(req,res)=>{
  const schema=z.object({leadId:z.string().uuid(),dueAt:z.string().datetime(),actionType:z.string().min(1).max(100)}); const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Provide a valid lead, due date and action.'});
  let leadQuery=supabaseAdmin.from('leads').select('id,assigned_to').eq('id',parsed.data.leadId); if(req.user!.role!=='admin') leadQuery=leadQuery.eq('assigned_to',req.user!.id); const {data:lead,error:leadError}=await leadQuery.single(); if(leadError||!lead) return res.status(404).json({error:'Lead not found or you do not have access.'});
  const {data,error}=await supabaseAdmin.from('follow_ups').insert({lead_id:lead.id,assigned_to:lead.assigned_to,due_at:parsed.data.dueAt,action_type:parsed.data.actionType,status:'pending',created_by:req.user!.id}).select().single(); if(error) throw error; res.status(201).json({followUp:data});
}));
router.patch('/:id',asyncHandler(async(req,res)=>{
  const schema=z.object({status:z.enum(['pending','completed','cancelled'])}); const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Invalid follow-up status.'});
  let query=supabaseAdmin.from('follow_ups').update({status:parsed.data.status,completed_at:parsed.data.status==='completed'?new Date().toISOString():null}).eq('id',req.params.id); if(req.user!.role!=='admin') query=query.eq('assigned_to',req.user!.id); const {data,error}=await query.select().maybeSingle(); if(error) throw error; if(!data) return res.status(404).json({error:'Follow-up not found or you do not have access.'}); res.json({followUp:data});
}));
export default router;
