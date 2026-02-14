import type { Database } from '@crispy-streaming/supabase-contract';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Fallback values for development; ideally these come from process.env or Expo Constants
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Authentication will not work.');
}

const secureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            return await SecureStore.getItemAsync(key);
        } catch (error) {
            console.error('[Supabase] Failed to read auth session from secure storage:', error);
            return null;
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            await SecureStore.setItemAsync(key, value);
        } catch (error) {
            console.error('[Supabase] Failed to persist auth session to secure storage:', error);
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (error) {
            console.error('[Supabase] Failed to clear auth session from secure storage:', error);
        }
    },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: secureStoreAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    },
});
