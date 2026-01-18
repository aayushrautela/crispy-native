import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({
    id: 'crispy-storage',
});

/**
 * Valid keys for user-specific data that must be isolated.
 * Prefix: u_{userId}:
 */
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
    | string;

/**
 * Valid keys for global system data.
 * No prefix.
 */
export type GlobalStorageKey =
    | 'crispy_known_sessions'
    | 'crispy_active_user_id'
    | 'crispy-guest-mode'
    | 'crispy-migrated'
    | 'crispy-is-first-boot';

class StorageServiceImpl {
    /**
     * Get a user-scoped item.
     * Automatically applies namespacing based on the active user.
     */
    public getUser<T>(key: UserStorageKey, defaultValue: T): T;
    public getUser<T>(key: UserStorageKey): T | null;
    public getUser<T>(key: UserStorageKey, defaultValue?: T): T | null {
        const activeUserId = storage.getString('crispy_active_user_id');

        if (!activeUserId) {
            return this.getRaw(key, defaultValue);
        }

        const namespacedKey = `u_${activeUserId}:${key}`;
        return this.getRaw(namespacedKey, defaultValue);
    }

    /**
     * Set a user-scoped item.
     */
    public setUser<T>(key: UserStorageKey, value: T): void {
        const activeUserId = storage.getString('crispy_active_user_id');
        if (!activeUserId) {
            this.setRaw(key, value);
            return;
        }

        const namespacedKey = `u_${activeUserId}:${key}`;
        this.setRaw(namespacedKey, value);
    }

    /**
     * Remove a user-scoped item.
     */
    public removeUser(key: UserStorageKey): void {
        const activeUserId = storage.getString('crispy_active_user_id');
        const fullKey = activeUserId ? `u_${activeUserId}:${key}` : key;
        storage.delete(fullKey);
    }

    /**
     * Remove a global item.
     */
    public removeGlobal(key: GlobalStorageKey): void {
        storage.delete(key);
    }

    /**
     * Get a global item (shared across all accounts).
     */
    public getGlobal<T>(key: GlobalStorageKey, defaultValue: T): T;
    public getGlobal<T>(key: GlobalStorageKey): T | null;
    public getGlobal<T>(key: GlobalStorageKey, defaultValue?: T): T | null {
        return this.getRaw(key, defaultValue);
    }

    /**
     * Set a global item.
     */
    public setGlobal<T>(key: GlobalStorageKey, value: T): void {
        this.setRaw(key, value);
    }

    /**
     * Internal raw access to MMKV with JSON parsing.
     */
    private getRaw<T>(key: string, defaultValue?: T): T | null {
        try {
            const item = storage.getString(key);
            if (item === undefined) return defaultValue ?? null;

            try {
                return JSON.parse(item) as T;
            } catch {
                // MMKV might store raw strings
                return item as unknown as T;
            }
        } catch (e) {
            console.error(`[StorageService] Error reading key "${key}"`, e);
            return defaultValue ?? null;
        }
    }

    private setRaw<T>(key: string, value: T): void {
        try {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            storage.set(key, stringValue);
        } catch (e) {
            console.error(`[StorageService] Error writing key "${key}"`, e);
        }
    }
}

export const StorageService = new StorageServiceImpl();
