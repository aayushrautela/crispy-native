import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './services/supabase';
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

        const bootstrap = async () => {
            try {
                const { data, error } = await supabase.auth.getSession();
                if (error) throw error;
                if (cancelled) return;

                setSession(data.session);
                setUser(data.session?.user ?? null);

                if (data.session?.user?.id) {
                    StorageService.setActiveAccountId(data.session.user.id);
                } else {
                    StorageService.setActiveAccountId(null);
                }
            } catch (e) {
                if (!cancelled) {
                    console.error('[AuthContext] Failed to load session:', e);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void bootstrap();

        const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setUser(nextSession?.user ?? null);
            setLoading(false);

            if (nextSession?.user?.id) {
                StorageService.setActiveAccountId(nextSession.user.id);
            } else {
                StorageService.setActiveAccountId(null);
            }
        });

        return () => {
            cancelled = true;
            data.subscription.unsubscribe();
        };
    }, []);

    const signOut = useCallback(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw error;
        }

        StorageService.setActiveAccountId(null);
    }, []);

    const value = useMemo(() => ({
        session,
        user,
        loading,
        signOut
    }), [
        session,
        user,
        loading,
        signOut,
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
