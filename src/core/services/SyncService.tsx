import debounce from 'lodash.debounce';
import { useEffect, useRef } from 'react';
import { AppSettings, TraktAuth, UserState, useUserStore } from '../../features/trakt/stores/userStore';
import { useAuth } from '../AuthContext';
import { supabase } from './supabase';

export function SyncService() {
    const { user } = useAuth();
    const { hydrate, reset } = useUserStore();
    const initialLoadDone = useRef<string | null>(null);

    // Save data on change (debounced)
    const saveData = useRef(debounce(async (newState: UserState) => {
        if (!user || initialLoadDone.current !== user.id) {
            console.log('[SyncService] ⏳ Skipping sync (not yet hydrated)');
            return;
        }

        console.log('[SyncService] ☁️ Atomic Sync to Supabase...');

        const updates = {
            addons: newState.addons,
            catalog_prefs: newState.catalogPrefs,
            trakt_auth: newState.traktAuth,
            settings: newState.settings,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('user_data')
            .update(updates)
            .eq('user_id', user.id);

        if (error) {
            console.error('[SyncService] Sync failed:', error);
        } else {
            console.log('[SyncService] Sync successful');
        }
    }, 2000)).current;

    // Load data when user becomes available
    useEffect(() => {
        if (!user) return;
        if (initialLoadDone.current === user.id) return;

        const loadUserData = async () => {
            console.log('[SyncService] 🔄 Fetching profile for:', user.email);

            // Fetch profile
            const { data: profile, error } = await supabase
                .from('user_data')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error) {
                console.error('[SyncService] Fetch failed:', error.message);
                // If profile doesn't exist, we might want to create it, 
                // but usually the auth trigger does that. 
                // If it's just missing, we'll sync UP what we have locally later.
                initialLoadDone.current = user.id; // Mark loaded so we can start syncing up
                return;
            }

            if (profile) {
                console.log('[SyncService] 🔄 Hydrating store from cloud...');

                // Construct hydration payload
                const payload: Partial<UserState> = {};

                if (profile.settings && Object.keys(profile.settings).length > 0) payload.settings = profile.settings as AppSettings;
                if (profile.addons && Array.isArray(profile.addons) && profile.addons.length > 0) payload.addons = profile.addons;
                if (profile.trakt_auth && Object.keys(profile.trakt_auth).length > 0) payload.traktAuth = profile.trakt_auth as TraktAuth;
                if (profile.catalog_prefs) payload.catalogPrefs = profile.catalog_prefs;

                // Hydrate the store
                hydrate(payload);

                // Reset TraktService to re-read tokens from namespaced storage
                TraktService.getInstance().reset();
            }

            initialLoadDone.current = user.id;
        };

        loadUserData();
    }, [user, hydrate]);

    // Listen to store changes
    useEffect(() => {
        const unsub = useUserStore.subscribe((state) => {
            if (user && initialLoadDone.current === user.id) {
                saveData(state);
            }
        });

        return () => {
            unsub();
            saveData.cancel();
        };
    }, [user, saveData]);

    return null;
}
