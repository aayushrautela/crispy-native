import debounce from 'lodash.debounce';
import type { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../AuthContext';
import { AppSettings, TraktAuth, UserState, useUserStore } from '../stores/userStore';
import { TraktService } from './TraktService';
import { supabase } from './supabase';

export function SyncService() {
    const { user } = useAuth();
    const userRef = useRef<User | null>(null);
    userRef.current = user;

    const hydrate = useUserStore((state) => state.hydrate);
    const reset = useUserStore((state) => state.reset);
    const initialLoadDone = useRef<string | null>(null);
    const lastSynced = useRef<Pick<UserState, 'settings' | 'addons' | 'catalogPrefs' | 'traktAuth'> | null>(null);
    const lastCloudUpdatedAt = useRef<string | null>(null);
    const isApplyingRemote = useRef(false);
    const fetchRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasUnsyncedLocalChanges = useRef(false);

    // Save data on change (debounced)
    const saveData = useRef(debounce(async (newState: UserState) => {
        const currentUser = userRef.current;
        if (!currentUser || initialLoadDone.current !== currentUser.id || isApplyingRemote.current) {
            console.log('[SyncService] ⏳ Skipping sync (not yet hydrated)');
            return;
        }

        const prev = lastSynced.current;

        const updates: Record<string, any> = {};
        if (!prev || prev.addons !== newState.addons) updates.addons = newState.addons;
        if (!prev || prev.catalogPrefs !== newState.catalogPrefs) updates.catalog_prefs = newState.catalogPrefs;
        if (!prev || prev.traktAuth !== newState.traktAuth) updates.trakt_auth = newState.traktAuth;
        if (!prev || prev.settings !== newState.settings) updates.settings = newState.settings;

        const keys = Object.keys(updates);
        if (keys.length === 0) return;

        console.log('[SyncService] ☁️ Sync to Supabase:', keys.join(', '));
        hasUnsyncedLocalChanges.current = true;

        const nowIso = new Date().toISOString();
        const payload = {
            user_id: currentUser.id,
            updated_at: nowIso,
            ...updates
        };

        const { error } = await supabase
            .from('user_data')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) {
            console.error('[SyncService] Sync failed:', error);
        } else {
            console.log('[SyncService] Sync successful');
            lastSynced.current = {
                addons: newState.addons,
                catalogPrefs: newState.catalogPrefs,
                traktAuth: newState.traktAuth,
                settings: newState.settings,
            };
            lastCloudUpdatedAt.current = nowIso;
            hasUnsyncedLocalChanges.current = false;
        }
    }, 2000)).current;

    const refreshFromCloud = useCallback(async () => {
        const currentUser = userRef.current;
        if (!currentUser || initialLoadDone.current !== currentUser.id) return;
        if (isApplyingRemote.current) return;
        if (hasUnsyncedLocalChanges.current) {
            // Try pushing local changes first; do not pull remote over unsynced state.
            saveData(useUserStore.getState());
            if (saveData.flush) saveData.flush();
            return;
        }

        const { data: profile, error } = await supabase
            .from('user_data')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (error) {
            console.error('[SyncService] Refresh failed:', error);
            return;
        }

        if (!profile) {
            // Cloud row missing; recreate it from local state.
            const localState = useUserStore.getState();
            const nowIso = new Date().toISOString();
            const seed = {
                user_id: currentUser.id,
                addons: localState.addons,
                catalog_prefs: localState.catalogPrefs,
                trakt_auth: localState.traktAuth,
                settings: localState.settings,
                updated_at: nowIso,
            };

            const { error: seedError } = await supabase
                .from('user_data')
                .upsert(seed, { onConflict: 'user_id' });

            if (seedError) {
                console.error('[SyncService] Failed to recreate cloud row:', seedError);
                return;
            }

            lastCloudUpdatedAt.current = nowIso;
            lastSynced.current = {
                addons: localState.addons,
                catalogPrefs: localState.catalogPrefs,
                traktAuth: localState.traktAuth,
                settings: localState.settings,
            };
            return;
        }

        const remoteUpdatedAt = typeof profile.updated_at === 'string' ? profile.updated_at : null;
        if (remoteUpdatedAt && lastCloudUpdatedAt.current === remoteUpdatedAt) return;

        isApplyingRemote.current = true;
        try {
            const payload: Partial<UserState> = {};
            if (profile.settings !== undefined && profile.settings !== null) payload.settings = profile.settings as AppSettings;
            if (Array.isArray(profile.addons)) payload.addons = profile.addons;
            if (profile.trakt_auth !== undefined && profile.trakt_auth !== null) payload.traktAuth = profile.trakt_auth as TraktAuth;
            if (profile.catalog_prefs !== undefined && profile.catalog_prefs !== null) payload.catalogPrefs = profile.catalog_prefs;

            hydrate(payload);
            TraktService.getInstance().reset();

            const stateAfterHydrate = useUserStore.getState();
            lastSynced.current = {
                addons: stateAfterHydrate.addons,
                catalogPrefs: stateAfterHydrate.catalogPrefs,
                traktAuth: stateAfterHydrate.traktAuth,
                settings: stateAfterHydrate.settings,
            };
            lastCloudUpdatedAt.current = remoteUpdatedAt;
        } finally {
            isApplyingRemote.current = false;
        }
    }, [hydrate, saveData]);

    // Load data when user becomes available
    useEffect(() => {
        if (fetchRetryTimer.current) {
            clearTimeout(fetchRetryTimer.current);
            fetchRetryTimer.current = null;
        }

        if (!user) {
            initialLoadDone.current = null;
            lastSynced.current = null;
            lastCloudUpdatedAt.current = null;
            hasUnsyncedLocalChanges.current = false;
            return;
        }
        if (initialLoadDone.current === user.id) return;

        const loadUserData = async () => {
            console.log('[SyncService] 🔄 Fetching profile for:', user.email);

            // Ensure local store is scoped to the active user before applying cloud.
            reset();
            lastSynced.current = null;
            lastCloudUpdatedAt.current = null;
            hasUnsyncedLocalChanges.current = false;

            // Fetch profile
            const { data: profile, error } = await supabase
                .from('user_data')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) {
                console.error('[SyncService] Fetch failed:', error);
                // Do not start syncing if we couldn't read the cloud state.
                fetchRetryTimer.current = setTimeout(() => {
                    if (initialLoadDone.current !== user.id) {
                        loadUserData();
                    }
                }, 5000);
                return;
            }

            if (!profile) {
                console.log('[SyncService] 🧱 No cloud row. Seeding Supabase with local state...');
                const localState = useUserStore.getState();
                const nowIso = new Date().toISOString();

                const seed = {
                    user_id: user.id,
                    addons: localState.addons,
                    catalog_prefs: localState.catalogPrefs,
                    trakt_auth: localState.traktAuth,
                    settings: localState.settings,
                    updated_at: nowIso
                };

                const { error: seedError } = await supabase
                    .from('user_data')
                    .upsert(seed, { onConflict: 'user_id' });

                if (seedError) {
                    console.error('[SyncService] Seed failed:', seedError);
                    fetchRetryTimer.current = setTimeout(() => {
                        if (initialLoadDone.current !== user.id) {
                            loadUserData();
                        }
                    }, 5000);
                    return;
                }

                lastSynced.current = {
                    addons: localState.addons,
                    catalogPrefs: localState.catalogPrefs,
                    traktAuth: localState.traktAuth,
                    settings: localState.settings,
                };
                lastCloudUpdatedAt.current = nowIso;
                TraktService.getInstance().reset();
                initialLoadDone.current = user.id;
                return;
            }

            if (profile) {
                console.log('[SyncService] 🔄 Hydrating store from cloud...');

                // Construct hydration payload
                isApplyingRemote.current = true;
                try {
                    const payload: Partial<UserState> = {};

                    // Cloud wins when the key exists (including explicit empty values)
                    if (profile.settings !== undefined && profile.settings !== null) payload.settings = profile.settings as AppSettings;
                    if (Array.isArray(profile.addons)) payload.addons = profile.addons;
                    if (profile.trakt_auth !== undefined && profile.trakt_auth !== null) payload.traktAuth = profile.trakt_auth as TraktAuth;
                    if (profile.catalog_prefs !== undefined && profile.catalog_prefs !== null) payload.catalogPrefs = profile.catalog_prefs;

                    // Hydrate the store
                    hydrate(payload);

                    // Reset TraktService to re-read tokens from namespaced storage
                    TraktService.getInstance().reset();
                } finally {
                    isApplyingRemote.current = false;
                }
            }

            initialLoadDone.current = user.id;

            const stateAfterHydrate = useUserStore.getState();
            lastSynced.current = {
                addons: stateAfterHydrate.addons,
                catalogPrefs: stateAfterHydrate.catalogPrefs,
                traktAuth: stateAfterHydrate.traktAuth,
                settings: stateAfterHydrate.settings,
            };
            lastCloudUpdatedAt.current = typeof profile.updated_at === 'string' ? profile.updated_at : null;
        };

        loadUserData();
    }, [user, hydrate, reset]);

    // Flush pending sync on app background; refresh on resume.
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                refreshFromCloud().catch((e) => console.error('[SyncService] Refresh crashed:', e));
                return;
            }
            if (saveData.flush) {
                saveData.flush();
            }
        });

        return () => {
            sub.remove();
        };
    }, [refreshFromCloud, saveData]);

    // Listen to store changes
    useEffect(() => {
        const unsub = useUserStore.subscribe((state) => {
            if (isApplyingRemote.current) return;
            if (user && initialLoadDone.current === user.id) {
                saveData(state);
            }
        });

        return () => {
            unsub();
            if (saveData.flush) {
                saveData.flush();
            }
            saveData.cancel();
        };
    }, [user, saveData]);

    return null;
}
