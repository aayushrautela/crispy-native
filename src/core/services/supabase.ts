import type { Database } from '@crispy-streaming/supabase-contract';
import { createClient } from '@supabase/supabase-js';

import { supabaseAuthStorage } from './supabaseAuthStorage';

// Fallback values for development; ideally these come from process.env or Expo Constants
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Authentication will not work.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: supabaseAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    },
});
