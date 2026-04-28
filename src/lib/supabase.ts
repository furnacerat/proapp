import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function testSupabaseConnection() {
  if (!supabase) {
    return { ok: false, message: 'Supabase env vars are not configured.' };
  }

  const { error } = await supabase.from('customers').select('id').limit(1);
  return error
    ? { ok: false, message: error.message }
    : { ok: true, message: 'Supabase connection is working.' };
}
