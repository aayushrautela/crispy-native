import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { parseMembershipPayload } from '@crispy-streaming/supabase-contract';
import type { MembershipRecord } from '@crispy-streaming/supabase-contract';

import { useAuth } from '@/src/core/AuthContext';
import { supabase } from '@/src/core/services/supabase';

interface HouseholdContextType {
    membership: MembershipRecord | null;
    householdId: string | null;
    role: MembershipRecord['role'] | null;
    loading: boolean;
    error: string | null;
    refreshMembership: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();

    const [membership, setMembership] = useState<MembershipRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestIdRef = useRef(0);

    const refreshMembership = useCallback(async () => {
        const requestId = ++requestIdRef.current;

        if (!user) {
            setMembership(null);
            setError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error: rpcError } = await supabase.rpc('ensure_household_membership');
            if (rpcError) throw rpcError;

            const record = parseMembershipPayload(data);
            if (requestId !== requestIdRef.current) return;

            setMembership(record);
            setLoading(false);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.warn('[HouseholdContext] Failed to ensure membership:', err);
            setMembership(null);
            setError(err instanceof Error ? err.message : 'Failed to load household membership');
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        refreshMembership();
    }, [refreshMembership]);

    const value = useMemo((): HouseholdContextType => {
        return {
            membership,
            householdId: membership?.household_id ?? null,
            role: membership?.role ?? null,
            loading,
            error,
            refreshMembership,
        };
    }, [membership, loading, error, refreshMembership]);

    return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
};

export const useHousehold = (): HouseholdContextType => {
    const ctx = useContext(HouseholdContext);
    if (!ctx) throw new Error('useHousehold must be used within a HouseholdProvider');
    return ctx;
};
