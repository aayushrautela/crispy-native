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
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            if (session) {
                SessionManager.addSession(session);
            }
        });

        // Listen for changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            if (session) {
                SessionManager.addSession(session);
            }
        });

        return () => subscription.unsubscribe();
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
