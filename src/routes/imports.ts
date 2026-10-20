import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, normalizePhone } from '../lib/http.js';
import { supabaseAdmin } from '../lib/supabase.js';
const router=Router();
const rowSchema=z.object({name:z.string().trim().min(1).max(200),company:z.string().max(200).optional().default(''),phone:z.string().trim().min(5).max(40),email:z.string().trim().optional().default(''),source:z.string().max(100).optional().default('Spreadsheet')});
router.post('/',asyncHandler(async(req,res)=>{
  if(req.user!.role!=='admin') return res.status(403).json({error:'Only admin can import leads.'});
  const bodySchema=z.object({fileName:z.string().min(1).max(255),assignedTo:z.string().uuid(),rows:z.array(z.unknown()).min(1)}); const parsed=bodySchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Provide a filename and at least one valid row.'});
  const maxRows=Number(process.env.MAX_IMPORT_ROWS)||2000; if(parsed.data.rows.length>maxRows) return res.status(413).json({error:`Import limit is ${maxRows} rows per file.`});
  const telecallerId=parsed.data.assignedTo;
  const {data:assignee,error:assigneeError}=await supabaseAdmin.from('profiles').select('id,role,is_active').eq('id',telecallerId).single(); if(assigneeError||!assignee||assignee.role!=='telecaller'||!assignee.is_active) return res.status(400).json({error:'Choose an active telecaller before importing leads.'});
  const normalized=parsed.data.rows.map(r=>rowSchema.safeParse(r)); const valid=normalized.filter(r=>r.success).map(r=>(r as {success:true;data:z.infer<typeof rowSchema>}).data); const rejected=normalized.length-valid.length;
  if(!valid.length) return res.status(400).json({error:'No rows passed validation.',imported:0,skipped:0,rejected});
  const phones=[...new Set(valid.map(r=>normalizePhone(r.phone)))]; const {data:existing,error:existingError}=await supabaseAdmin.from('leads').select('phone'); if(existingError) throw existingError; const known=new Set((existing||[]).map(l=>normalizePhone(l.phone)));
  const seen=new Set<string>(); const unique=valid.filter(r=>{const phone=normalizePhone(r.phone);if(known.has(phone)||seen.has(phone))return false;seen.add(phone);return true;}); const skipped=valid.length-unique.length;
  const importId=crypto.randomUUID(); const {error:batchError}=await supabaseAdmin.from('lead_imports').insert({id:importId,file_name:parsed.data.fileName,uploaded_by:req.user!.id,assigned_to:telecallerId,total_rows:parsed.data.rows.length,valid_rows:valid.length,imported_rows:0,skipped_rows:skipped,rejected_rows:rejected,status:'processing'}); if(batchError) throw batchError;
  let imported=0;
  try {
    for(let i=0;i<unique.length;i+=250){ const batch=unique.slice(i,i+250).map((r,index)=>({lead_code:`LD-${Date.now().toString().slice(-6)}-${i+index+1}`,name:r.name,company:r.company||null,phone:normalizePhone(r.phone),email:r.email||null,source:r.source||parsed.data.fileName,assigned_to:telecallerId,created_by:req.user!.id,import_batch_id:importId,sales_stage:'New',call_outcome:null,priority:'medium'})); const {data,error}=await supabaseAdmin.from('leads').insert(batch).select('id'); if(error) throw error; imported+=(data||[]).length; }
    await supabaseAdmin.from('lead_imports').update({imported_rows:imported,status:'completed',completed_at:new Date().toISOString()}).eq('id',importId);
  } catch(e) { await supabaseAdmin.from('lead_imports').update({imported_rows:imported,status:'failed',error_message:e instanceof Error?e.message:'Import failed',completed_at:new Date().toISOString()}).eq('id',importId); throw e; }
  res.status(201).json({importId,imported,skipped,rejected});
}));
export default router;
