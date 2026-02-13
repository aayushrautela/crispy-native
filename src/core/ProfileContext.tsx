import type { User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './services/supabase';
import { StorageService } from './storage';
import { useAuth } from './AuthContext';

export interface Profile {
    id: string;
    account_id: string;
    name: string;
    avatar: string | null;
    order_index: number;
    last_active_at: string | null;
    created_at: string;
    updated_at: string;
}

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

async function touchLastActive(accountId: string, profileId: string): Promise<void> {
    const { error } = await supabase
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('account_id', accountId)
        .eq('id', profileId);

    if (error) {
        console.warn('[ProfileContext] Failed to update last_active_at:', error.message);
    }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

    const setActiveProfile = useCallback((profileId: string | null) => {
        setActiveProfileId(profileId);
        StorageService.setActiveProfileId(profileId);
    }, []);

    const syncActiveProfile = useCallback((items: Profile[], account: User | null) => {
        const storedActiveProfileId = StorageService.getActiveProfileId();

        if (storedActiveProfileId && items.some((profile) => profile.id === storedActiveProfileId)) {
            setActiveProfile(storedActiveProfileId);
            return;
        }

        if (items.length > 0) {
            const nextId = items[0].id;
            setActiveProfile(nextId);
            if (account) {
                void touchLastActive(account.id, nextId);
            }
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

        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('account_id', user.id)
            .order('order_index', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            setLoading(false);
            throw error;
        }

        const nextProfiles = (data ?? []) as Profile[];
        setProfiles(nextProfiles);
        syncActiveProfile(nextProfiles, user);
        setLoading(false);
    }, [setActiveProfile, syncActiveProfile, user]);

    const switchProfile = useCallback(async (profileId: string) => {
        if (!user) return;
        setActiveProfile(profileId);
    }, [setActiveProfile, user]);

    useEffect(() => {
        if (!user) {
            setProfiles([]);
            setActiveProfile(null);
            setLoading(false);
            return;
        }

        StorageService.setActiveAccountId(user.id);
        void refreshProfiles().catch((error) => {
            console.error('[ProfileContext] Failed to refresh profiles:', error);
            setLoading(false);
        });
    }, [refreshProfiles, setActiveProfile, user]);

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
