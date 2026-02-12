import { createMMKV } from 'react-native-mmkv';

// Main production storage mechanism
export const storage = createMMKV({
    id: 'crispy-storage'
});

const STORAGE_SCHEMA_VERSION = 2;
const STORAGE_SCHEMA_KEY = 'crispy-schema-version';
const ACTIVE_ACCOUNT_KEY = 'crispy-active-account-id';
const ACTIVE_PROFILE_KEY = 'crispy-active-profile-id';

console.log('[Storage] MMKV Initialized. Active Account:', storage.getString(ACTIVE_ACCOUNT_KEY) || 'None');

export type ProfileStorageKey =
    | 'crispy-mobile-navbar-style'
    | 'crispy-intro-skip-mode'
    | 'crispy-omdb-key'
    | 'crispy-tmdb-key'
    | 'crispy-trakt-auth'
    | 'crispy-language'
    | 'crispy-addon-search-enabled'
    | 'crispy-accent-color'
    | 'crispy-amoled-mode'
    | 'crispy-addons'
    | 'crispy-shell-settings'
    | 'crispy-openrouter-key'
    | string;

export type AccountStorageKey =
    | 'crispy-addons'
    | 'crispy-profiles-cache'
    | string;

export type DeviceStorageKey =
    | typeof ACTIVE_ACCOUNT_KEY
    | typeof ACTIVE_PROFILE_KEY
    | typeof STORAGE_SCHEMA_KEY
    | 'crispy-migrated'
    | 'crispy-is-first-boot';

class StorageServiceImpl {
    constructor() {
        this.ensureSchemaVersion();
    }

    private ensureSchemaVersion() {
        const current = storage.getNumber(STORAGE_SCHEMA_KEY) ?? 0;
        if (current >= STORAGE_SCHEMA_VERSION) {
            return;
        }

        console.log(`[Storage] Resetting storage schema ${current} -> ${STORAGE_SCHEMA_VERSION}`);
        storage.clearAll();
        storage.set(STORAGE_SCHEMA_KEY, STORAGE_SCHEMA_VERSION);
    }

    public getActiveAccountId(): string | null {
        return storage.getString(ACTIVE_ACCOUNT_KEY) ?? null;
    }

    public setActiveAccountId(accountId: string | null): void {
        if (!accountId) {
            storage.remove(ACTIVE_ACCOUNT_KEY);
            storage.remove(ACTIVE_PROFILE_KEY);
            return;
        }
        storage.set(ACTIVE_ACCOUNT_KEY, accountId);
    }

    public getActiveProfileId(): string | null {
        return storage.getString(ACTIVE_PROFILE_KEY) ?? null;
    }

    public setActiveProfileId(profileId: string | null): void {
        if (!profileId) {
            storage.remove(ACTIVE_PROFILE_KEY);
            return;
        }
        storage.set(ACTIVE_PROFILE_KEY, profileId);
    }

    public getDevice<T>(key: DeviceStorageKey, defaultValue: T): T;
    public getDevice<T>(key: DeviceStorageKey): T | null;
    public getDevice<T>(key: DeviceStorageKey, defaultValue?: T): T | null {
        return this.getRaw(key, defaultValue);
    }

    public setDevice<T>(key: DeviceStorageKey, value: T): void {
        this.setRaw(key, value);
    }

    public removeDevice(key: DeviceStorageKey): void {
        storage.remove(key);
    }

    public getGlobal<T>(key: string, defaultValue: T): T;
    public getGlobal<T>(key: string): T | null;
    public getGlobal<T>(key: string, defaultValue?: T): T | null {
        return this.getRaw(key, defaultValue);
    }

    public setGlobal<T>(key: string, value: T): void {
        this.setRaw(key, value);
    }

    public removeGlobal(key: string): void {
        storage.remove(key);
    }

    public getAccount<T>(key: AccountStorageKey, defaultValue: T): T;
    public getAccount<T>(key: AccountStorageKey): T | null;
    public getAccount<T>(key: AccountStorageKey, defaultValue?: T): T | null {
        const accountId = this.getActiveAccountId();
        if (!accountId) return defaultValue ?? null;
        return this.getRaw(this.accountKey(accountId, key), defaultValue);
    }

    public setAccount<T>(key: AccountStorageKey, value: T): void {
        const accountId = this.getActiveAccountId();
        if (!accountId) {
            console.warn(`[Storage] setAccount(${key}) ignored: no active account`);
            return;
        }
        this.setRaw(this.accountKey(accountId, key), value);
    }

    public removeAccount(key: AccountStorageKey): void {
        const accountId = this.getActiveAccountId();
        if (!accountId) return;
        storage.remove(this.accountKey(accountId, key));
    }

    public getProfile<T>(key: ProfileStorageKey, defaultValue: T): T;
    public getProfile<T>(key: ProfileStorageKey): T | null;
    public getProfile<T>(key: ProfileStorageKey, defaultValue?: T): T | null {
        const accountId = this.getActiveAccountId();
        const profileId = this.getActiveProfileId();
        if (!accountId || !profileId) return defaultValue ?? null;
        return this.getRaw(this.profileKey(accountId, profileId, key), defaultValue);
    }

    public setProfile<T>(key: ProfileStorageKey, value: T): void {
        const accountId = this.getActiveAccountId();
        const profileId = this.getActiveProfileId();
        if (!accountId || !profileId) {
            console.warn(`[Storage] setProfile(${key}) ignored: no active profile`);
            return;
        }
        this.setRaw(this.profileKey(accountId, profileId, key), value);
    }

    public removeProfile(key: ProfileStorageKey): void {
        const accountId = this.getActiveAccountId();
        const profileId = this.getActiveProfileId();
        if (!accountId || !profileId) return;
        storage.remove(this.profileKey(accountId, profileId, key));
    }

    public clearProfileNamespace(profileId: string): void {
        const accountId = this.getActiveAccountId();
        if (!accountId) return;

        const prefix = `a_${accountId}:p_${profileId}:`;
        const keys = storage.getAllKeys();
        keys.forEach((key) => {
            if (key.startsWith(prefix)) {
                storage.remove(key);
            }
        });
    }

    private accountKey(accountId: string, key: string): string {
        return `a_${accountId}:${key}`;
    }

    private profileKey(accountId: string, profileId: string, key: string): string {
        return `a_${accountId}:p_${profileId}:${key}`;
    }

    private getRaw<T>(key: string, defaultValue?: T): T | null {
        try {
            const item = storage.getString(key);
            if (item === undefined) return defaultValue ?? null;
            try {
                return JSON.parse(item) as T;
            } catch {
                return item as unknown as T;
            }
        } catch (e) {
            console.error("[StorageService] Error reading key " + key, e);
            return defaultValue ?? null;
        }
    }
    private setRaw<T>(key: string, value: T): void {
        try {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            storage.set(key, stringValue);
        } catch (e) {
            console.error("[StorageService] Error writing key " + key, e);
        }
    }
}

export const StorageService = new StorageServiceImpl();
