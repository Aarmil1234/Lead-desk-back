export type Role = 'admin' | 'telecaller';
export type Profile = { id: string; full_name: string; role: Role; email?: string };
export type Lead = {
  id: string; lead_code: string; name: string; company: string | null; phone: string; email: string | null;
  source: string | null; assigned_to: string; call_outcome: string | null; sales_stage: string;
  priority: 'low' | 'medium' | 'high'; last_contacted_at: string | null; next_follow_up_at: string | null;
  created_at: string; latest_note?: string | null;
};
export type Activity = {
  id: string; lead_id: string; activity_type: string; call_outcome: string | null; call_datetime: string | null;
  duration_seconds: number | null; notes: string | null; questions: string | null; sales_stage_after: string | null;
  next_action: string | null; created_by: string; created_at: string; actor_name?: string;
};
export type FollowUp = { id: string; lead_id: string; assigned_to: string; due_at: string; action_type: string; status: string; leads?: Lead };
