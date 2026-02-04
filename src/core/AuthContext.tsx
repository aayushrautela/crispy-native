import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './services/supabase';
import { SessionManager } from './SessionManager';
import { StorageService } from './storage';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | null = null;

        const init = async () => {
            try {
                // If we have a previously stored session in MMKV, restore it into supabase
                await SessionManager.restoreActiveSession();
            } catch (e) {
                console.warn('[AuthContext] Failed to restore previous session:', e);
            }

            try {
                const { data } = await supabase.auth.getSession();
                if (cancelled) return;

                setSession(data.session);
                setUser(data.session?.user ?? null);
                setLoading(false);

                if (data.session) {
                    void SessionManager.addSession(data.session);
                }
            } catch (e) {
                if (cancelled) return;
                console.error('[AuthContext] Failed to load session:', e);
                setLoading(false);
            }

            if (cancelled) return;

            // Listen for changes
            const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
                setSession(nextSession);
                setUser(nextSession?.user ?? null);
                setLoading(false);

                if (nextSession) {
                    void SessionManager.addSession(nextSession);
                }
            });

            unsubscribe = () => data.subscription.unsubscribe();
        };

        void init();

        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, []);

    const signOut = useCallback(async () => {
        StorageService.removeGlobal('crispy-guest-mode');
        if (user) {
            await SessionManager.removeAccount(user.id);
        } else {
            await supabase.auth.signOut();
        }
    }, [user]);

    const value = useMemo(() => ({
        session,
        user,
        loading,
        signOut
    }), [session, user, loading, signOut]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
