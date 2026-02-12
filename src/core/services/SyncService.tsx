import debounce from 'lodash.debounce';
import type { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../AuthContext';
import { useProfiles } from '../ProfileContext';
import {
    Addon,
    AppSettings,
    CatalogPreferences,
    TraktAuth,
    UserState,
    useUserStore,
} from '../stores/userStore';
import { TraktService } from './TraktService';
import { supabase } from './supabase';

interface ProfileSyncSnapshot {
    settings: AppSettings;
    catalogPrefs: CatalogPreferences;
    traktAuth: TraktAuth;
}

function getProfileSnapshot(state: UserState): ProfileSyncSnapshot {
    return {
        settings: state.settings,
        catalogPrefs: state.catalogPrefs,
        traktAuth: state.traktAuth,
    };
}

export function SyncService() {
    const { user } = useAuth();
    const { activeProfileId } = useProfiles();
    const hydrate = useUserStore((state) => state.hydrate);

    const userRef = useRef<User | null>(null);
    const activeProfileIdRef = useRef<string | null>(null);
    userRef.current = user;
    activeProfileIdRef.current = activeProfileId;

    const accountReadyRef = useRef<string | null>(null);
    const profileReadyRef = useRef<string | null>(null);

    const lastSyncedAddons = useRef<Addon[] | null>(null);
    const lastSyncedProfile = useRef<ProfileSyncSnapshot | null>(null);

    const lastAccountCloudUpdatedAt = useRef<string | null>(null);
    const lastProfileCloudUpdatedAt = useRef<string | null>(null);

    const isApplyingRemote = useRef(false);
    const hasUnsyncedAccountChanges = useRef(false);
    const hasUnsyncedProfileChanges = useRef(false);

    const accountRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const profileRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const saveAccount = useRef(
        debounce(async (addons: Addon[]) => {
            const currentUser = userRef.current;
            if (!currentUser || accountReadyRef.current !== currentUser.id || isApplyingRemote.current) {
                return;
            }

            if (lastSyncedAddons.current === addons) {
                return;
            }

            hasUnsyncedAccountChanges.current = true;
            const nowIso = new Date().toISOString();
            const payload = {
                account_id: currentUser.id,
                addons,
                updated_at: nowIso,
            };

            const { error } = await supabase
                .from('account_data')
                .upsert(payload, { onConflict: 'account_id' });

            if (error) {
                console.error('[SyncService] Failed syncing account data:', error);
                return;
            }

            lastSyncedAddons.current = addons;
            lastAccountCloudUpdatedAt.current = nowIso;
            hasUnsyncedAccountChanges.current = false;
        }, 2000)
    ).current;

    const saveProfile = useRef(
        debounce(async (snapshot: ProfileSyncSnapshot, profileId: string) => {
            const currentUser = userRef.current;
            const currentProfileId = activeProfileIdRef.current;

            if (!currentUser || !currentProfileId || isApplyingRemote.current) {
                return;
            }

            if (profileReadyRef.current !== currentProfileId || profileId !== currentProfileId) {
                return;
            }

            const previous = lastSyncedProfile.current;
            if (
                previous &&
                previous.settings === snapshot.settings &&
                previous.catalogPrefs === snapshot.catalogPrefs &&
                previous.traktAuth === snapshot.traktAuth
            ) {
                return;
            }

            hasUnsyncedProfileChanges.current = true;
            const nowIso = new Date().toISOString();
            const payload = {
                profile_id: profileId,
                settings: snapshot.settings,
                catalog_prefs: snapshot.catalogPrefs,
                trakt_auth: snapshot.traktAuth,
                updated_at: nowIso,
            };

            const { error } = await supabase
                .from('profile_data')
                .upsert(payload, { onConflict: 'profile_id' });

            if (error) {
                console.error('[SyncService] Failed syncing profile data:', error);
                return;
            }

            lastSyncedProfile.current = snapshot;
            lastProfileCloudUpdatedAt.current = nowIso;
            hasUnsyncedProfileChanges.current = false;
        }, 2000)
    ).current;

    const resetSyncRefs = useCallback(() => {
        accountReadyRef.current = null;
        profileReadyRef.current = null;
        lastSyncedAddons.current = null;
        lastSyncedProfile.current = null;
        lastAccountCloudUpdatedAt.current = null;
        lastProfileCloudUpdatedAt.current = null;
        hasUnsyncedAccountChanges.current = false;
        hasUnsyncedProfileChanges.current = false;
    }, []);

    const applyRemoteProfilePayload = useCallback((payload: Partial<UserState>) => {
        isApplyingRemote.current = true;
        try {
            hydrate(payload);
            TraktService.getInstance().reset();
        } finally {
            isApplyingRemote.current = false;
        }
    }, [hydrate]);

    const loadAccountData = useCallback(async (accountId: string) => {
        const localState = useUserStore.getState();

        const { data, error } = await supabase
            .from('account_data')
            .select('*')
            .eq('account_id', accountId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            const nowIso = new Date().toISOString();
            const { error: seedError } = await supabase
                .from('account_data')
                .upsert(
                    {
                        account_id: accountId,
                        addons: localState.addons,
                        updated_at: nowIso,
                    },
                    { onConflict: 'account_id' }
                );

            if (seedError) {
                throw seedError;
            }

            lastSyncedAddons.current = localState.addons;
            lastAccountCloudUpdatedAt.current = nowIso;
            accountReadyRef.current = accountId;
            hasUnsyncedAccountChanges.current = false;
            return;
        }

        const remoteAddons = Array.isArray(data.addons) ? (data.addons as Addon[]) : null;
        if (remoteAddons) {
            isApplyingRemote.current = true;
            try {
                hydrate({ addons: remoteAddons });
            } finally {
                isApplyingRemote.current = false;
            }
        }

        const state = useUserStore.getState();
        lastSyncedAddons.current = state.addons;
        lastAccountCloudUpdatedAt.current = typeof data.updated_at === 'string' ? data.updated_at : null;
        accountReadyRef.current = accountId;
        hasUnsyncedAccountChanges.current = false;
    }, [hydrate]);

    const loadProfileData = useCallback(async (profileId: string) => {
        const localState = useUserStore.getState();

        const { data, error } = await supabase
            .from('profile_data')
            .select('*')
            .eq('profile_id', profileId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            const nowIso = new Date().toISOString();
            const snapshot = getProfileSnapshot(localState);
            const { error: seedError } = await supabase
                .from('profile_data')
                .upsert(
                    {
                        profile_id: profileId,
                        settings: snapshot.settings,
                        catalog_prefs: snapshot.catalogPrefs,
                        trakt_auth: snapshot.traktAuth,
                        updated_at: nowIso,
                    },
                    { onConflict: 'profile_id' }
                );

            if (seedError) {
                throw seedError;
            }

            lastSyncedProfile.current = snapshot;
            lastProfileCloudUpdatedAt.current = nowIso;
            profileReadyRef.current = profileId;
            hasUnsyncedProfileChanges.current = false;
            return;
        }

        const payload: Partial<UserState> = {};
        if (data.settings !== undefined && data.settings !== null) {
            payload.settings = data.settings as AppSettings;
        }
        if (data.catalog_prefs !== undefined && data.catalog_prefs !== null) {
            payload.catalogPrefs = data.catalog_prefs as CatalogPreferences;
        }
        if (data.trakt_auth !== undefined && data.trakt_auth !== null) {
            payload.traktAuth = data.trakt_auth as TraktAuth;
        }

        if (Object.keys(payload).length > 0) {
            applyRemoteProfilePayload(payload);
        }

        const state = useUserStore.getState();
        lastSyncedProfile.current = getProfileSnapshot(state);
        lastProfileCloudUpdatedAt.current = typeof data.updated_at === 'string' ? data.updated_at : null;
        profileReadyRef.current = profileId;
        hasUnsyncedProfileChanges.current = false;
    }, [applyRemoteProfilePayload]);

    const refreshAccountFromCloud = useCallback(async () => {
        const currentUser = userRef.current;
        if (!currentUser || accountReadyRef.current !== currentUser.id || isApplyingRemote.current) {
            return;
        }

        if (hasUnsyncedAccountChanges.current) {
            saveAccount(useUserStore.getState().addons);
            if (saveAccount.flush) saveAccount.flush();
            return;
        }

        const { data, error } = await supabase
            .from('account_data')
            .select('*')
            .eq('account_id', currentUser.id)
            .maybeSingle();

        if (error) {
            console.error('[SyncService] Failed refreshing account data:', error);
            return;
        }

        if (!data) {
            await loadAccountData(currentUser.id);
            return;
        }

        const remoteUpdatedAt = typeof data.updated_at === 'string' ? data.updated_at : null;
        if (remoteUpdatedAt && remoteUpdatedAt === lastAccountCloudUpdatedAt.current) {
            return;
        }

        const remoteAddons = Array.isArray(data.addons) ? (data.addons as Addon[]) : null;
        if (remoteAddons) {
            isApplyingRemote.current = true;
            try {
                hydrate({ addons: remoteAddons });
            } finally {
                isApplyingRemote.current = false;
            }
        }

        lastSyncedAddons.current = useUserStore.getState().addons;
        lastAccountCloudUpdatedAt.current = remoteUpdatedAt;
    }, [hydrate, loadAccountData, saveAccount]);

    const refreshProfileFromCloud = useCallback(async () => {
        const profileId = activeProfileIdRef.current;
        if (!profileId || profileReadyRef.current !== profileId || isApplyingRemote.current) {
            return;
        }

        if (hasUnsyncedProfileChanges.current) {
            saveProfile(getProfileSnapshot(useUserStore.getState()), profileId);
            if (saveProfile.flush) saveProfile.flush();
            return;
        }

        const { data, error } = await supabase
            .from('profile_data')
            .select('*')
            .eq('profile_id', profileId)
            .maybeSingle();

        if (error) {
            console.error('[SyncService] Failed refreshing profile data:', error);
            return;
        }

        if (!data) {
            await loadProfileData(profileId);
            return;
        }

        const remoteUpdatedAt = typeof data.updated_at === 'string' ? data.updated_at : null;
        if (remoteUpdatedAt && remoteUpdatedAt === lastProfileCloudUpdatedAt.current) {
            return;
        }

        const payload: Partial<UserState> = {};
        if (data.settings !== undefined && data.settings !== null) {
            payload.settings = data.settings as AppSettings;
        }
        if (data.catalog_prefs !== undefined && data.catalog_prefs !== null) {
            payload.catalogPrefs = data.catalog_prefs as CatalogPreferences;
        }
        if (data.trakt_auth !== undefined && data.trakt_auth !== null) {
            payload.traktAuth = data.trakt_auth as TraktAuth;
        }

        if (Object.keys(payload).length > 0) {
            applyRemoteProfilePayload(payload);
        }

        lastSyncedProfile.current = getProfileSnapshot(useUserStore.getState());
        lastProfileCloudUpdatedAt.current = remoteUpdatedAt;
    }, [applyRemoteProfilePayload, loadProfileData, saveProfile]);

    useEffect(() => {
        if (accountRetryTimer.current) {
            clearTimeout(accountRetryTimer.current);
            accountRetryTimer.current = null;
        }

        if (!user) {
            resetSyncRefs();
            return;
        }

        if (accountReadyRef.current === user.id) {
            return;
        }

        const load = async () => {
            try {
                await loadAccountData(user.id);
            } catch (error) {
                console.error('[SyncService] Failed loading account data:', error);
                accountRetryTimer.current = setTimeout(() => {
                    if (userRef.current?.id === user.id && accountReadyRef.current !== user.id) {
                        void load();
                    }
                }, 5000);
            }
        };

        void load();
    }, [loadAccountData, resetSyncRefs, user]);

    useEffect(() => {
        if (profileRetryTimer.current) {
            clearTimeout(profileRetryTimer.current);
            profileRetryTimer.current = null;
        }

        if (!user || !activeProfileId) {
            profileReadyRef.current = null;
            lastSyncedProfile.current = null;
            lastProfileCloudUpdatedAt.current = null;
            hasUnsyncedProfileChanges.current = false;
            return;
        }

        if (profileReadyRef.current === activeProfileId) {
            return;
        }

        const load = async () => {
            try {
                await loadProfileData(activeProfileId);
            } catch (error) {
                console.error('[SyncService] Failed loading profile data:', error);
                profileRetryTimer.current = setTimeout(() => {
                    if (activeProfileIdRef.current === activeProfileId && profileReadyRef.current !== activeProfileId) {
                        void load();
                    }
                }, 5000);
            }
        };

        void load();
    }, [activeProfileId, loadProfileData, user]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                void refreshAccountFromCloud();
                void refreshProfileFromCloud();
                return;
            }

            if (saveAccount.flush) saveAccount.flush();
            if (saveProfile.flush) saveProfile.flush();
        });

        return () => {
            sub.remove();
        };
    }, [refreshAccountFromCloud, refreshProfileFromCloud, saveAccount, saveProfile]);

    useEffect(() => {
        const unsubscribe = useUserStore.subscribe((state) => {
            if (isApplyingRemote.current) return;

            const currentUser = userRef.current;
            if (currentUser && accountReadyRef.current === currentUser.id) {
                saveAccount(state.addons);
            }

            const profileId = activeProfileIdRef.current;
            if (currentUser && profileId && profileReadyRef.current === profileId) {
                saveProfile(getProfileSnapshot(state), profileId);
            }
        });

        return () => {
            unsubscribe();
            if (saveAccount.flush) saveAccount.flush();
            if (saveProfile.flush) saveProfile.flush();
            saveAccount.cancel();
            saveProfile.cancel();
            if (accountRetryTimer.current) clearTimeout(accountRetryTimer.current);
            if (profileRetryTimer.current) clearTimeout(profileRetryTimer.current);
        };
    }, [saveAccount, saveProfile]);

    return null;
}
