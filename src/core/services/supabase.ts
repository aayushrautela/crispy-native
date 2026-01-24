import { createClient } from '@supabase/supabase-js';

// Fallback values for development; ideally these come from process.env or Expo Constants
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Authentication will not work.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserData {
    id: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    settings?: any;
    addons?: any;
    catalog_prefs?: any;
    trakt_auth?: any;
}
