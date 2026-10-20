import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const options = {
  realtime: {
    transport: WebSocket,
  },
};

export const supabaseAuth = createClient(
  supabaseUrl,
  supabaseAnonKey,
  options
);

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  options
);

export const supabase = supabaseAdmin;