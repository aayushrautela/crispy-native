import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { KnownAccount, SessionManager, SessionMode } from './SessionManager';
import { supabase } from './services/supabase';

interface SignOutOptions {
    removeAccount?: boolean;
    fallbackMode?: 'anonymous' | 'guest';
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    mode: SessionMode;
    knownAccounts: KnownAccount[];
    activeAccount: KnownAccount | null;
    hasKnownAccounts: boolean;
    continueAsGuest: () => Promise<void>;
    switchAccount: (userId: string) => Promise<void>;
    removeAccount: (userId: string) => Promise<void>;
    signOut: (options?: SignOutOptions) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
    mode: 'anonymous',
    knownAccounts: [],
    activeAccount: null,
    hasKnownAccounts: false,
    continueAsGuest: async () => { },
    switchAccount: async () => { },
    removeAccount: async () => { },
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<SessionMode>(SessionManager.getMode());
    const [knownAccounts, setKnownAccounts] = useState<KnownAccount[]>(SessionManager.getAccounts());
    const [activeAccount, setActiveAccount] = useState<KnownAccount | null>(SessionManager.getActiveAccount());

    useEffect(() => {
        const unsubscribe = SessionManager.subscribe((snapshot) => {
            setMode(snapshot.mode);
            setKnownAccounts(snapshot.accounts);
            setActiveAccount(snapshot.activeAccount);
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | null = null;

        const init = async () => {
            try {
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

            const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
                setSession(nextSession);
                setUser(nextSession?.user ?? null);
                setLoading(false);

                if (nextSession) {
                    void SessionManager.addSession(nextSession);
                } else {
                    void SessionManager.handleExternalSignOut();
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

    const continueAsGuest = useCallback(async () => {
        await SessionManager.continueAsGuest();
    }, []);

    const switchAccount = useCallback(async (userId: string) => {
        await SessionManager.switchUser(userId);
    }, []);

    const removeAccount = useCallback(async (userId: string) => {
        await SessionManager.removeAccount(userId);
    }, []);

    const signOut = useCallback(async (options?: SignOutOptions) => {
        const removeCurrentAccount = options?.removeAccount ?? true;
        const fallbackMode = options?.fallbackMode ?? 'anonymous';
        const currentActive = SessionManager.getActiveAccount();

        if (removeCurrentAccount && currentActive) {
            await SessionManager.removeAccount(currentActive.user_id);
            return;
        }

        if (fallbackMode === 'guest') {
            await SessionManager.continueAsGuest();
        } else {
            await SessionManager.clearSession();
        }
    }, []);

    const value = useMemo(() => ({
        session,
        user,
        loading,
        mode,
        knownAccounts,
        activeAccount,
        hasKnownAccounts: knownAccounts.length > 0,
        continueAsGuest,
        switchAccount,
        removeAccount,
        signOut
    }), [
        session,
        user,
        loading,
        mode,
        knownAccounts,
        activeAccount,
        continueAsGuest,
        switchAccount,
        removeAccount,
        signOut,
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
