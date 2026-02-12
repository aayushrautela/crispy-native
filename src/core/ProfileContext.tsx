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
    createProfile: (name: string) => Promise<Profile>;
    renameProfile: (profileId: string, name: string) => Promise<void>;
    deleteProfile: (profileId: string) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
    loading: true,
    profiles: [],
    activeProfileId: null,
    activeProfile: null,
    refreshProfiles: async () => { },
    switchProfile: async () => { },
    createProfile: async () => {
        throw new Error('ProfileProvider not mounted');
    },
    renameProfile: async () => { },
    deleteProfile: async () => { },
});

function getNextOrderIndex(profiles: Profile[]): number {
    return profiles.reduce((max, profile) => Math.max(max, profile.order_index ?? 0), 0) + 1;
}

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
        if (!user) throw new Error('No account is signed in.');

        const profileExists = profiles.some((profile) => profile.id === profileId);
        if (!profileExists) {
            throw new Error('Profile not found for this account.');
        }

        setActiveProfile(profileId);
        await touchLastActive(user.id, profileId);
    }, [profiles, setActiveProfile, user]);

    const createProfile = useCallback(async (name: string) => {
        if (!user) throw new Error('No account is signed in.');

        const trimmedName = name.trim();
        if (!trimmedName) {
            throw new Error('Profile name cannot be empty.');
        }

        const { data, error } = await supabase
            .from('profiles')
            .insert({
                account_id: user.id,
                name: trimmedName,
                order_index: getNextOrderIndex(profiles),
            })
            .select('*')
            .single();

        if (error || !data) {
            throw error ?? new Error('Failed to create profile.');
        }

        const createdProfile = data as Profile;
        const nextProfiles = [...profiles, createdProfile].sort((a, b) => a.order_index - b.order_index);
        setProfiles(nextProfiles);

        if (!activeProfileId) {
            await switchProfile(createdProfile.id);
        }

        return createdProfile;
    }, [activeProfileId, profiles, switchProfile, user]);

    const renameProfile = useCallback(async (profileId: string, name: string) => {
        if (!user) throw new Error('No account is signed in.');

        const trimmedName = name.trim();
        if (!trimmedName) {
            throw new Error('Profile name cannot be empty.');
        }

        const { error } = await supabase
            .from('profiles')
            .update({ name: trimmedName })
            .eq('account_id', user.id)
            .eq('id', profileId);

        if (error) throw error;

        setProfiles((prev) => prev.map((profile) => profile.id === profileId ? { ...profile, name: trimmedName } : profile));
    }, [user]);

    const deleteProfile = useCallback(async (profileId: string) => {
        if (!user) throw new Error('No account is signed in.');

        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('account_id', user.id)
            .eq('id', profileId);

        if (error) throw error;

        StorageService.clearProfileNamespace(profileId);

        const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
        setProfiles(nextProfiles);

        if (activeProfileId === profileId) {
            if (nextProfiles.length > 0) {
                await switchProfile(nextProfiles[0].id);
            } else {
                setActiveProfile(null);
            }
        }
    }, [activeProfileId, profiles, setActiveProfile, switchProfile, user]);

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
        createProfile,
        renameProfile,
        deleteProfile,
    }), [
        loading,
        profiles,
        activeProfileId,
        activeProfile,
        refreshProfiles,
        switchProfile,
        createProfile,
        renameProfile,
        deleteProfile,
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
