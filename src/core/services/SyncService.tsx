import debounce from 'lodash.debounce';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import type { Json } from '@crispy-streaming/supabase-contract';
import { useAuth } from '../AuthContext';
import { useHousehold } from '../HouseholdContext';
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

function normalizeAddons(addons: Addon[]): Addon[] {
    const normalized = addons
        .filter((addon) => typeof addon?.url === 'string')
        .map((addon) => {
            const url = addon.url.trim();
            return {
                url,
                enabled: Boolean(addon.enabled),
                ...(typeof addon.name === 'string' && addon.name.trim().length > 0 ? { name: addon.name.trim() } : {}),
            } satisfies Addon;
        })
        .filter((addon) => addon.url.length > 0)
        .sort((a, b) => a.url.localeCompare(b.url));

    return normalized;
}

function addonsFingerprint(addons: Addon[]): string {
    return JSON.stringify(normalizeAddons(addons));
}

function parseRemoteAddons(payload: unknown): Addon[] | null {
    if (!Array.isArray(payload)) return null;

    const out: Addon[] = [];
    for (const item of payload) {
        if (!item || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;

        const url = typeof obj.url === 'string' ? obj.url.trim() : '';
        if (!url) continue;

        const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : true;
        const name = typeof obj.name === 'string' && obj.name.trim().length > 0 ? obj.name.trim() : undefined;

        out.push({ url, enabled, ...(name ? { name } : {}) });
    }

    return normalizeAddons(out);
}

export function SyncService() {
    const { user } = useAuth();
    const { householdId, role } = useHousehold();
    const { activeProfileId } = useProfiles();
    const hydrate = useUserStore((state) => state.hydrate);

    const userRef = useRef(user);
    const activeProfileIdRef = useRef<string | null>(null);
    const householdIdRef = useRef<string | null>(null);
    const householdRoleRef = useRef<typeof role>(null);

    userRef.current = user;
    activeProfileIdRef.current = activeProfileId;
    householdIdRef.current = householdId;
    householdRoleRef.current = role;

    const householdReadyRef = useRef<string | null>(null);
    const profileReadyRef = useRef<string | null>(null);

    const lastSyncedAddonsFingerprintRef = useRef<string | null>(null);
    const lastSyncedProfile = useRef<ProfileSyncSnapshot | null>(null);

    const lastProfileCloudUpdatedAt = useRef<string | null>(null);

    const isApplyingRemote = useRef(false);
    const hasUnsyncedHouseholdChanges = useRef(false);
    const hasUnsyncedProfileChanges = useRef(false);

    const householdRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const profileRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const saveHouseholdAddons = useRef(
        debounce(async (addons: Addon[], forHouseholdId: string) => {
            const currentHouseholdId = householdIdRef.current;
            if (!currentHouseholdId || currentHouseholdId !== forHouseholdId) return;
            if (householdReadyRef.current !== currentHouseholdId || isApplyingRemote.current) return;
            if (householdRoleRef.current !== 'owner') return;

            const normalized = normalizeAddons(addons);
            const fp = JSON.stringify(normalized);
            if (lastSyncedAddonsFingerprintRef.current === fp) return;

            hasUnsyncedHouseholdChanges.current = true;
            const { error } = await supabase.rpc('replace_household_addons', { p_addons: normalized as unknown as Json });
            if (error) {
                console.error('[SyncService] Failed syncing household addons:', error);
                return;
            }

            lastSyncedAddonsFingerprintRef.current = fp;
            hasUnsyncedHouseholdChanges.current = false;
        }, 2000)
    ).current;

    const saveProfile = useRef(
        debounce(async (snapshot: ProfileSyncSnapshot, profileId: string) => {
            const currentProfileId = activeProfileIdRef.current;

            if (!currentProfileId || isApplyingRemote.current) {
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
            const { error } = await supabase.rpc('upsert_profile_data', {
                p_profile_id: profileId,
                p_settings: snapshot.settings as unknown as Json,
                p_catalog_prefs: snapshot.catalogPrefs as unknown as Json,
                p_trakt_auth: snapshot.traktAuth as unknown as Json,
            });

            if (error) {
                console.error('[SyncService] Failed syncing profile data:', error);
                return;
            }

            lastSyncedProfile.current = snapshot;
            lastProfileCloudUpdatedAt.current = null;
            hasUnsyncedProfileChanges.current = false;
        }, 2000)
    ).current;

    const resetSyncRefs = useCallback(() => {
        householdReadyRef.current = null;
        profileReadyRef.current = null;
        lastSyncedAddonsFingerprintRef.current = null;
        lastSyncedProfile.current = null;
        lastProfileCloudUpdatedAt.current = null;
        hasUnsyncedHouseholdChanges.current = false;
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

    const applyRemoteAddons = useCallback((remoteAddons: Addon[]) => {
        isApplyingRemote.current = true;
        try {
            hydrate({ addons: remoteAddons });
        } finally {
            isApplyingRemote.current = false;
        }
    }, [hydrate]);

    const loadHouseholdAddons = useCallback(async (activeHouseholdId: string) => {
        const { data, error } = await supabase.rpc('get_household_addons');
        if (error) throw error;

        const remoteAddons = parseRemoteAddons(data);
        if (remoteAddons) {
            applyRemoteAddons(remoteAddons);
        }

        const state = useUserStore.getState();
        lastSyncedAddonsFingerprintRef.current = addonsFingerprint(state.addons);
        householdReadyRef.current = activeHouseholdId;
        hasUnsyncedHouseholdChanges.current = false;
    }, [applyRemoteAddons]);

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
            const snapshot = getProfileSnapshot(localState);
            const { error: seedError } = await supabase.rpc('upsert_profile_data', {
                p_profile_id: profileId,
                p_settings: snapshot.settings as unknown as Json,
                p_catalog_prefs: snapshot.catalogPrefs as unknown as Json,
                p_trakt_auth: snapshot.traktAuth as unknown as Json,
            });

            if (seedError) {
                throw seedError;
            }

            lastSyncedProfile.current = snapshot;
            lastProfileCloudUpdatedAt.current = null;
            profileReadyRef.current = profileId;
            hasUnsyncedProfileChanges.current = false;
            return;
        }

        const payload: Partial<UserState> = {};
        if (data.settings !== undefined && data.settings !== null) {
            payload.settings = data.settings as unknown as AppSettings;
        }
        if (data.catalog_prefs !== undefined && data.catalog_prefs !== null) {
            payload.catalogPrefs = data.catalog_prefs as unknown as CatalogPreferences;
        }
        if (data.trakt_auth !== undefined && data.trakt_auth !== null) {
            payload.traktAuth = data.trakt_auth as unknown as TraktAuth;
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

    const refreshHouseholdFromCloud = useCallback(async () => {
        const currentHouseholdId = householdIdRef.current;
        if (!currentHouseholdId || householdReadyRef.current !== currentHouseholdId || isApplyingRemote.current) {
            return;
        }

        if (hasUnsyncedHouseholdChanges.current) {
            saveHouseholdAddons(useUserStore.getState().addons, currentHouseholdId);
            if (saveHouseholdAddons.flush) saveHouseholdAddons.flush();
            return;
        }

        const { data, error } = await supabase.rpc('get_household_addons');
        if (error) {
            console.error('[SyncService] Failed refreshing household addons:', error);
            return;
        }

        const remoteAddons = parseRemoteAddons(data);
        if (!remoteAddons) return;

        const remoteFp = JSON.stringify(remoteAddons);
        if (remoteFp === lastSyncedAddonsFingerprintRef.current) return;

        applyRemoteAddons(remoteAddons);
        lastSyncedAddonsFingerprintRef.current = addonsFingerprint(useUserStore.getState().addons);
    }, [applyRemoteAddons, saveHouseholdAddons]);

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
            payload.settings = data.settings as unknown as AppSettings;
        }
        if (data.catalog_prefs !== undefined && data.catalog_prefs !== null) {
            payload.catalogPrefs = data.catalog_prefs as unknown as CatalogPreferences;
        }
        if (data.trakt_auth !== undefined && data.trakt_auth !== null) {
            payload.traktAuth = data.trakt_auth as unknown as TraktAuth;
        }

        if (Object.keys(payload).length > 0) {
            applyRemoteProfilePayload(payload);
        }

        lastSyncedProfile.current = getProfileSnapshot(useUserStore.getState());
        lastProfileCloudUpdatedAt.current = remoteUpdatedAt;
    }, [applyRemoteProfilePayload, loadProfileData, saveProfile]);

    useEffect(() => {
        if (householdRetryTimer.current) {
            clearTimeout(householdRetryTimer.current);
            householdRetryTimer.current = null;
        }

        if (!user || !householdId) {
            resetSyncRefs();
            return;
        }

        if (householdReadyRef.current === householdId) {
            return;
        }

        const load = async () => {
            try {
                await loadHouseholdAddons(householdId);
            } catch (error) {
                console.error('[SyncService] Failed loading household addons:', error);
                householdRetryTimer.current = setTimeout(() => {
                    if (householdIdRef.current === householdId && householdReadyRef.current !== householdId) {
                        void load();
                    }
                }, 5000);
            }
        };

        void load();
    }, [householdId, loadHouseholdAddons, resetSyncRefs, user]);

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
                void refreshHouseholdFromCloud();
                void refreshProfileFromCloud();
                return;
            }

            if (saveHouseholdAddons.flush) saveHouseholdAddons.flush();
            if (saveProfile.flush) saveProfile.flush();
        });

        return () => {
            sub.remove();
        };
    }, [refreshHouseholdFromCloud, refreshProfileFromCloud, saveHouseholdAddons, saveProfile]);

    useEffect(() => {
        const unsubscribe = useUserStore.subscribe((state) => {
            if (isApplyingRemote.current) return;

            const currentHouseholdId = householdIdRef.current;
            if (currentHouseholdId && householdReadyRef.current === currentHouseholdId && householdRoleRef.current === 'owner') {
                saveHouseholdAddons(state.addons, currentHouseholdId);
            }

            const profileId = activeProfileIdRef.current;
            if (profileId && profileReadyRef.current === profileId) {
                saveProfile(getProfileSnapshot(state), profileId);
            }
        });

        return () => {
            unsubscribe();
            if (saveHouseholdAddons.flush) saveHouseholdAddons.flush();
            if (saveProfile.flush) saveProfile.flush();
            saveHouseholdAddons.cancel();
            saveProfile.cancel();
            if (householdRetryTimer.current) clearTimeout(householdRetryTimer.current);
            if (profileRetryTimer.current) clearTimeout(profileRetryTimer.current);
        };
    }, [saveHouseholdAddons, saveProfile]);

    return null;
}
