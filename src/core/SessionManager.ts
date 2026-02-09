import { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import { StorageService } from './storage';

export interface KnownAccount {
    user_id: string;
    email: string;
    avatar_url?: string;
    name?: string;
    session: Session;
    last_active: number;
}

export type SessionMode = 'anonymous' | 'guest' | 'account';

export interface SessionSnapshot {
    mode: SessionMode;
    accounts: KnownAccount[];
    activeAccount: KnownAccount | null;
}

const KNOWN_SESSIONS_KEY = 'crispy_known_sessions';
const ACTIVE_USER_KEY = 'crispy_active_user_id';
const SESSION_MODE_KEY = 'crispy_session_mode';
const LEGACY_GUEST_KEY = 'crispy-guest-mode';

class SessionManagerService {
    private accounts: Map<string, KnownAccount> = new Map();
    private activeUserId: string | null = null;
    private mode: SessionMode = 'anonymous';
    private listeners: ((snapshot: SessionSnapshot) => void)[] = [];
    private transitionChain: Promise<void> = Promise.resolve();

    constructor() {
        this.loadFromStorage();
        this.persistState();
    }

    private loadFromStorage() {
        const stored = StorageService.getGlobal<KnownAccount[]>(KNOWN_SESSIONS_KEY);
        if (stored) {
            stored.forEach((acc: KnownAccount) => this.accounts.set(acc.user_id, acc));
        }

        const active = StorageService.getGlobal<string>(ACTIVE_USER_KEY);
        if (active && this.accounts.has(active)) {
            this.activeUserId = active;
        }

        const storedMode = this.normalizeMode(StorageService.getGlobal<string>(SESSION_MODE_KEY));
        const legacyGuest = StorageService.getGlobal<boolean | string>(LEGACY_GUEST_KEY);
        const isLegacyGuest = legacyGuest === true || legacyGuest === 'true';

        if (storedMode) {
            this.mode = storedMode;
        } else if (isLegacyGuest) {
            this.mode = 'guest';
        } else if (this.activeUserId) {
            this.mode = 'account';
        } else {
            this.mode = 'anonymous';
        }

        if (this.mode === 'account' && (!this.activeUserId || !this.accounts.has(this.activeUserId))) {
            const fallback = this.getSortedAccounts()[0];
            this.activeUserId = fallback?.user_id ?? null;
            if (!this.activeUserId) {
                this.mode = 'anonymous';
            }
        }

        if (this.mode !== 'account') {
            this.activeUserId = null;
        }
    }

    private normalizeMode(value: unknown): SessionMode | null {
        if (value === 'anonymous' || value === 'guest' || value === 'account') {
            return value;
        }
        return null;
    }

    private getSortedAccounts(): KnownAccount[] {
        return Array.from(this.accounts.values()).sort((a, b) => b.last_active - a.last_active);
    }

    private deriveModeFromState(): SessionMode {
        if (this.mode === 'guest') return 'guest';
        if (this.activeUserId && this.accounts.has(this.activeUserId)) return 'account';
        return 'anonymous';
    }

    private persistState() {
        const list = this.getSortedAccounts();
        StorageService.setGlobal(KNOWN_SESSIONS_KEY, list);

        if (this.activeUserId) {
            StorageService.setGlobal(ACTIVE_USER_KEY, this.activeUserId);
        } else {
            StorageService.removeGlobal(ACTIVE_USER_KEY);
        }

        StorageService.setGlobal(SESSION_MODE_KEY, this.mode);
        if (this.mode === 'guest') {
            StorageService.setGlobal(LEGACY_GUEST_KEY, true);
        } else {
            StorageService.removeGlobal(LEGACY_GUEST_KEY);
        }

        this.notifyListeners();
    }

    private upsertAccountFromSession(session: Session, setActive: boolean = true) {
        if (!session.user) return;

        const existing = this.accounts.get(session.user.id);
        const name = session.user.user_metadata?.name || session.user.user_metadata?.full_name || existing?.name;
        const avatar = session.user.user_metadata?.avatar_url || existing?.avatar_url;

        const account: KnownAccount = {
            user_id: session.user.id,
            email: session.user.email || existing?.email || 'Unknown',
            avatar_url: avatar,
            name,
            session,
            last_active: Date.now(),
        };

        this.accounts.set(account.user_id, account);
        if (setActive) {
            this.activeUserId = account.user_id;
        }
    }

    private runTransition<T>(operation: () => Promise<T>): Promise<T> {
        const run = this.transitionChain.then(operation, operation);
        this.transitionChain = run.then(() => undefined, () => undefined);
        return run;
    }

    public getMode(): SessionMode {
        return this.mode;
    }

    public hasKnownAccounts(): boolean {
        return this.accounts.size > 0;
    }

    public getAccounts(): KnownAccount[] {
        return this.getSortedAccounts();
    }

    public getActiveAccount(): KnownAccount | null {
        if (!this.activeUserId) return null;
        return this.accounts.get(this.activeUserId) || null;
    }

    public getSnapshot(): SessionSnapshot {
        return {
            mode: this.mode,
            accounts: this.getAccounts(),
            activeAccount: this.getActiveAccount(),
        };
    }

    public async addSession(session: Session) {
        return this.runTransition(async () => {
            if (!session.user) return;
            this.upsertAccountFromSession(session);
            this.mode = 'account';
            this.persistState();
        });
    }

    public async switchUser(userId: string) {
        return this.runTransition(async () => {
            const account = this.accounts.get(userId);
            if (!account) {
                throw new Error('Account not found. Please sign in again.');
            }

            const { data, error } = await supabase.auth.setSession({
                access_token: account.session.access_token,
                refresh_token: account.session.refresh_token,
            });

            if (error) {
                this.accounts.delete(userId);
                if (this.activeUserId === userId) {
                    this.activeUserId = null;
                }
                this.mode = this.deriveModeFromState();
                this.persistState();
                throw new Error('Your session has expired. Please sign in again.');
            }

            if (data.session) {
                this.upsertAccountFromSession(data.session);
            } else {
                account.last_active = Date.now();
                this.accounts.set(account.user_id, account);
                this.activeUserId = account.user_id;
            }

            this.mode = 'account';
            this.persistState();
        });
    }

    public async restoreActiveSession() {
        return this.runTransition(async () => {
            if (this.mode === 'guest' || this.mode === 'anonymous') {
                this.activeUserId = null;
                this.persistState();
                try {
                    await supabase.auth.signOut();
                } catch {
                    // Ignore restore-time sign-out failures
                }
                return;
            }

            if (!this.accounts.size) {
                this.activeUserId = null;
                this.mode = 'anonymous';
                this.persistState();
                return;
            }

            if (!this.activeUserId || !this.accounts.has(this.activeUserId)) {
                this.activeUserId = this.getSortedAccounts()[0]?.user_id ?? null;
            }

            while (this.activeUserId) {
                const account = this.accounts.get(this.activeUserId);
                if (!account) break;

                const { data, error } = await supabase.auth.setSession({
                    access_token: account.session.access_token,
                    refresh_token: account.session.refresh_token,
                });

                if (!error) {
                    if (data.session) {
                        this.upsertAccountFromSession(data.session);
                    } else {
                        account.last_active = Date.now();
                        this.accounts.set(account.user_id, account);
                    }
                    this.mode = 'account';
                    this.persistState();
                    return;
                }

                this.accounts.delete(account.user_id);
                this.activeUserId = this.getSortedAccounts()[0]?.user_id ?? null;
            }

            this.activeUserId = null;
            this.mode = this.deriveModeFromState();
            this.persistState();
        });
    }

    public async continueAsGuest() {
        return this.runTransition(async () => {
            this.mode = 'guest';
            this.activeUserId = null;
            this.persistState();

            try {
                await supabase.auth.signOut();
            } catch {
                // Keep local mode stable even if remote sign-out fails.
            }
        });
    }

    public async clearSession() {
        return this.runTransition(async () => {
            this.mode = 'anonymous';
            this.activeUserId = null;
            this.persistState();

            try {
                await supabase.auth.signOut();
            } catch {
                // Keep local mode stable even if remote sign-out fails.
            }
        });
    }

    public async handleExternalSignOut() {
        return this.runTransition(async () => {
            if (this.mode === 'account') {
                this.activeUserId = null;
                this.mode = 'anonymous';
                this.persistState();
            }
        });
    }

    public async removeAccount(userId: string) {
        return this.runTransition(async () => {
            const wasActive = this.activeUserId === userId;

            this.accounts.delete(userId);

            if (wasActive) {
                this.activeUserId = null;
                try {
                    await supabase.auth.signOut();
                } catch {
                    // Best-effort sign-out for active account removal.
                }
            }

            if (this.mode === 'account' && !this.activeUserId) {
                this.mode = 'anonymous';
            }

            this.persistState();
        });
    }

    public subscribe(callback: (snapshot: SessionSnapshot) => void) {
        this.listeners.push(callback);
        callback(this.getSnapshot());
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners() {
        const snapshot = this.getSnapshot();
        this.listeners.forEach(listener => listener(snapshot));
    }
}

export const SessionManager = new SessionManagerService();
