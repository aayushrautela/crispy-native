import { Session } from '@supabase/supabase-js';
import { supabase } from './api/supabase';
import { StorageService } from './storage';
import { router } from 'expo-router';

export interface KnownAccount {
    user_id: string;
    email: string;
    avatar_url?: string;
    name?: string;
    session: Session;
    last_active: number;
}

class SessionManagerService {
    private accounts: Map<string, KnownAccount> = new Map();
    private activeUserId: string | null = null;
    private listeners: ((accounts: KnownAccount[]) => void)[] = [];

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage() {
        const stored = StorageService.getGlobal<KnownAccount[]>('crispy_known_sessions');
        if (stored) {
            stored.forEach((acc: KnownAccount) => this.accounts.set(acc.user_id, acc));
        }

        const active = StorageService.getGlobal<string>('crispy_active_user_id');
        if (active && this.accounts.has(active)) {
            this.activeUserId = active;
        }
    }

    private saveToStorage() {
        const list = Array.from(this.accounts.values());
        StorageService.setGlobal('crispy_known_sessions', list);
        if (this.activeUserId) {
            StorageService.setGlobal('crispy_active_user_id', this.activeUserId);
        } else {
            StorageService.removeGlobal('crispy_active_user_id');
        }
        this.notifyListeners();
    }

    public getAccounts(): KnownAccount[] {
        return Array.from(this.accounts.values()).sort((a, b) => b.last_active - a.last_active);
    }

    public getActiveAccount(): KnownAccount | null {
        if (!this.activeUserId) return null;
        return this.accounts.get(this.activeUserId) || null;
    }

    public async addSession(session: Session) {
        if (!session.user) return;

        const existing = this.accounts.get(session.user.id);

        const name = session.user.user_metadata?.name || session.user.user_metadata?.full_name || existing?.name;
        const avatar = session.user.user_metadata?.avatar_url || existing?.avatar_url;

        const account: KnownAccount = {
            user_id: session.user.id,
            email: session.user.email || 'Unknown',
            avatar_url: avatar,
            name: name,
            session: session,
            last_active: Date.now()
        };

        this.accounts.set(account.user_id, account);
        this.activeUserId = account.user_id;
        this.saveToStorage();
    }

    public async switchUser(userId: string) {
        const account = this.accounts.get(userId);
        if (!account) throw new Error('User not found');

        this.activeUserId = userId;
        account.last_active = Date.now();
        this.saveToStorage();

        const { error } = await supabase.auth.setSession({
            access_token: account.session.access_token,
            refresh_token: account.session.refresh_token,
        });

        if (error) {
            console.error('[SessionManager] Failed to restore session:', error);
            this.accounts.delete(userId);
            this.saveToStorage();
            throw new Error('Your session has expired. Please log in again.');
        }

        // Replace modern deep navigation logic
        router.replace('/');
    }

    public async removeAccount(userId: string) {
        this.accounts.delete(userId);
        if (this.activeUserId === userId) {
            this.activeUserId = null;
            await supabase.auth.signOut();
        }
        this.saveToStorage();
    }

    public subscribe(callback: (accounts: KnownAccount[]) => void) {
        this.listeners.push(callback);
        callback(this.getAccounts());
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners() {
        const list = this.getAccounts();
        this.listeners.forEach(l => l(list));
    }
}

export const SessionManager = new SessionManagerService();
