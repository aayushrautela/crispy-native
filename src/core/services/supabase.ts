import { createClient } from '@supabase/supabase-js';

// Fallback values for development; ideally these come from process.env or Expo Constants
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Authentication will not work.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SupabaseJson =
    | string
    | number
    | boolean
    | null
    | { [key: string]: SupabaseJson }
    | SupabaseJson[];

export interface ProfileRecord {
    id: string;
    account_id: string;
    name: string;
    avatar: string | null;
    order_index: number;
    last_active_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface AccountDataRecord {
    id: string;
    account_id: string;
    created_at: string;
    updated_at: string;
    addons: SupabaseJson;
}

export interface ProfileDataRecord {
    id: string;
    profile_id: string;
    created_at: string;
    updated_at: string;
    settings: SupabaseJson;
    catalog_prefs: SupabaseJson;
    trakt_auth: SupabaseJson;
}
