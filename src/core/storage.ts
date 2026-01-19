import { MMKV } from 'react-native-mmkv';

// Main production storage mechanism
const mmkv = new MMKV({
    id: 'crispy-storage',
});

export const storage = mmkv;

export type UserStorageKey =
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

export type GlobalStorageKey =
    | 'crispy_known_sessions'
    | 'crispy_active_user_id'
    | 'crispy-guest-mode'
    | 'crispy-migrated'
    | 'crispy-is-first-boot';

class StorageServiceImpl {
    public getUser<T>(key: UserStorageKey, defaultValue: T): T;
    public getUser<T>(key: UserStorageKey): T | null;
    public getUser<T>(key: UserStorageKey, defaultValue?: T): T | null {
        const activeUserId = storage.getString('crispy_active_user_id');
        if (!activeUserId) return this.getRaw(key, defaultValue);
        const namespacedKey = "u_" + activeUserId + ":" + key;
        return this.getRaw(namespacedKey, defaultValue);
    }
    public setUser<T>(key: UserStorageKey, value: T): void {
        const activeUserId = storage.getString('crispy_active_user_id');
        if (!activeUserId) {
            this.setRaw(key, value);
            return;
        }
        const namespacedKey = "u_" + activeUserId + ":" + key;
        this.setRaw(namespacedKey, value);
    }
    public removeUser(key: UserStorageKey): void {
        const activeUserId = storage.getString('crispy_active_user_id');
        const fullKey = activeUserId ? "u_" + activeUserId + ":" + key : key;
        storage.delete(fullKey);
    }
    public removeGlobal(key: GlobalStorageKey): void {
        storage.delete(key);
    }
    public getGlobal<T>(key: GlobalStorageKey, defaultValue: T): T;
    public getGlobal<T>(key: GlobalStorageKey): T | null;
    public getGlobal<T>(key: GlobalStorageKey, defaultValue?: T): T | null {
        return this.getRaw(key, defaultValue);
    }
    public setGlobal<T>(key: GlobalStorageKey, value: T): void {
        this.setRaw(key, value);
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
