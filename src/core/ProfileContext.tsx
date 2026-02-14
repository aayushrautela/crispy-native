import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { ProfileRow } from '@crispy-streaming/supabase-contract';

import { supabase } from './services/supabase';
import { StorageService } from './storage';
import { useAuth } from './AuthContext';
import { useHousehold } from './HouseholdContext';

export type Profile = ProfileRow;

interface ProfileContextValue {
    loading: boolean;
    profiles: Profile[];
    activeProfileId: string | null;
    activeProfile: Profile | null;
    refreshProfiles: () => Promise<void>;
    switchProfile: (profileId: string) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
    loading: true,
    profiles: [],
    activeProfileId: null,
    activeProfile: null,
    refreshProfiles: async () => { },
    switchProfile: async () => { },
});

async function touchLastActive(householdId: string, profileId: string): Promise<void> {
    const { error } = await supabase
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('household_id', householdId)
        .eq('id', profileId);

    if (error) {
        console.warn('[ProfileContext] Failed to update last_active_at:', error.message);
    }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const { householdId, loading: householdLoading } = useHousehold();
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

    const setActiveProfile = useCallback((profileId: string | null) => {
        setActiveProfileId(profileId);
        StorageService.setActiveProfileId(profileId);
    }, []);

    const syncActiveProfile = useCallback((items: Profile[], activeHouseholdId: string) => {
        const storedActiveProfileId = StorageService.getActiveProfileId();

        if (storedActiveProfileId && items.some((profile) => profile.id === storedActiveProfileId)) {
            setActiveProfile(storedActiveProfileId);
            return;
        }

        if (items.length > 0) {
            const nextId = items[0].id;
            setActiveProfile(nextId);
            void touchLastActive(activeHouseholdId, nextId);
            return;
        }

        setActiveProfile(null);
    }, [setActiveProfile]);

    const refreshProfiles = useCallback(async () => {
        if (!user) {
            setProfiles([]);
            setActiveProfile(null);
            setLoading(false);
            return;
        }

        if (!householdId) {
            // Membership not ready (or failed). Avoid querying with an unknown household id.
            setProfiles([]);
            setActiveProfile(null);
            setLoading(householdLoading);
            return;
        }

        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('household_id', householdId)
            .order('order_index', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            setLoading(false);
            throw error;
        }

        const nextProfiles = data ?? [];
        setProfiles(nextProfiles);
        syncActiveProfile(nextProfiles, householdId);
        setLoading(false);
    }, [householdId, householdLoading, setActiveProfile, syncActiveProfile, user]);

    const switchProfile = useCallback(async (profileId: string) => {
        if (!user || !householdId) return;
        setActiveProfile(profileId);
        void touchLastActive(householdId, profileId);
    }, [householdId, setActiveProfile, user]);

    useEffect(() => {
        if (!user) {
            setProfiles([]);
            setActiveProfile(null);
            setLoading(false);
            return;
        }

        StorageService.setActiveAccountId(user.id);

        if (!householdId) {
            setProfiles([]);
            setActiveProfile(null);
            setLoading(householdLoading);
            return;
        }

        void refreshProfiles().catch((error) => {
            console.error('[ProfileContext] Failed to refresh profiles:', error);
            setLoading(false);
        });
    }, [householdId, householdLoading, refreshProfiles, setActiveProfile, user]);

    const activeProfile = useMemo(() => {
        if (!activeProfileId) return null;
        return profiles.find((profile) => profile.id === activeProfileId) ?? null;
    }, [activeProfileId, profiles]);

    const value = useMemo<ProfileContextValue>(() => ({
        loading,
        profiles,
        activeProfileId,
        activeProfile,
        refreshProfiles,
        switchProfile,
    }), [
        loading,
        profiles,
        activeProfileId,
        activeProfile,
        refreshProfiles,
        switchProfile,
    ]);

    return (
        <ProfileContext.Provider value={value}>
            {children}
        </ProfileContext.Provider>
    );
}

export function useProfiles() {
    return useContext(ProfileContext);
}
