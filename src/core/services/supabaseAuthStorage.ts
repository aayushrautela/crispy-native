import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { storage, StorageService } from '../storage';

const ENCRYPTION_KEY_SECURESTORE_KEY = 'crispy-supabase-auth-encryption-key-v1';
const ENCRYPTED_VALUE_PREFIX = 'crispy-supabase-auth:';

const KEY_BYTES = 32;
const NONCE_BYTES = 24;

const HEX_RE = /^[0-9a-f]+$/i;

const SECURESTORE_OPTIONS: SecureStore.SecureStoreOptions = {
    keychainService: 'crispy.supabase.auth',
    // Avoid iCloud/backups; still available after first device unlock.
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

let cachedEncryptionKey: Uint8Array | null = null;
let loadEncryptionKeyPromise: Promise<Uint8Array | null> | null = null;
let createEncryptionKeyPromise: Promise<Uint8Array> | null = null;

function toHex(bytes: Uint8Array): string {
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
        out += bytes[i].toString(16).padStart(2, '0');
    }
    return out;
}

function fromHex(hex: string): Uint8Array | null {
    const normalized = hex.trim();
    if (normalized.length === 0 || normalized.length % 2 !== 0) return null;
    if (!HEX_RE.test(normalized)) return null;

    const out = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < normalized.length; i += 2) {
        const byte = Number.parseInt(normalized.slice(i, i + 2), 16);
        if (!Number.isFinite(byte)) return null;
        out[i / 2] = byte;
    }
    return out;
}

function storageKey(key: string): string {
    return `${ENCRYPTED_VALUE_PREFIX}${key}`;
}

let cachedTextEncoder: TextEncoder | null = null;
let cachedTextDecoder: TextDecoder | null = null;

function encodeUtf8(input: string): Uint8Array {
    if (!cachedTextEncoder) {
        if (typeof TextEncoder === 'undefined') {
            throw new Error('TextEncoder is not available in this runtime');
        }
        cachedTextEncoder = new TextEncoder();
    }
    return cachedTextEncoder.encode(input);
}

function decodeUtf8(input: Uint8Array): string {
    if (!cachedTextDecoder) {
        if (typeof TextDecoder === 'undefined') {
            throw new Error('TextDecoder is not available in this runtime');
        }
        cachedTextDecoder = new TextDecoder();
    }
    return cachedTextDecoder.decode(input);
}

async function loadEncryptionKey(): Promise<Uint8Array | null> {
    if (cachedEncryptionKey) return cachedEncryptionKey;
    if (loadEncryptionKeyPromise) return loadEncryptionKeyPromise;

    loadEncryptionKeyPromise = (async () => {
        try {
            const stored = await SecureStore.getItemAsync(ENCRYPTION_KEY_SECURESTORE_KEY, SECURESTORE_OPTIONS);
            if (!stored) return null;

            const bytes = fromHex(stored);
            if (!bytes || bytes.length !== KEY_BYTES) {
                console.warn('[SupabaseAuthStorage] Invalid encryption key in SecureStore; clearing.');
                await SecureStore.deleteItemAsync(ENCRYPTION_KEY_SECURESTORE_KEY, SECURESTORE_OPTIONS);
                cachedEncryptionKey = null;
                clearEncryptedValues();
                return null;
            }

            cachedEncryptionKey = bytes;
            return bytes;
        } catch (error) {
            console.error('[SupabaseAuthStorage] Failed to read encryption key:', error);
            return null;
        } finally {
            loadEncryptionKeyPromise = null;
        }
    })();

    return loadEncryptionKeyPromise;
}

async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
    if (cachedEncryptionKey) return cachedEncryptionKey;
    if (createEncryptionKeyPromise) return createEncryptionKeyPromise;

    createEncryptionKeyPromise = (async () => {
        const existing = await loadEncryptionKey();
        if (existing) return existing;

        const key = await Crypto.getRandomBytesAsync(KEY_BYTES);
        try {
            await SecureStore.setItemAsync(ENCRYPTION_KEY_SECURESTORE_KEY, toHex(key), SECURESTORE_OPTIONS);
        } catch (error) {
            console.error('[SupabaseAuthStorage] Failed to persist encryption key:', error);
            throw error;
        }

        cachedEncryptionKey = key;
        return key;
    })().finally(() => {
        createEncryptionKeyPromise = null;
    });

    return createEncryptionKeyPromise;
}

function clearEncryptedValues(): void {
    try {
        const keys = storage.getAllKeys();
        keys.forEach((key) => {
            if (key.startsWith(ENCRYPTED_VALUE_PREFIX)) {
                storage.remove(key);
            }
        });
    } catch (error) {
        console.error('[SupabaseAuthStorage] Failed clearing encrypted values:', error);
    }
}

async function encrypt(plaintext: string, key: Uint8Array): Promise<string> {
    const nonce = await Crypto.getRandomBytesAsync(NONCE_BYTES);
    const cipher = xchacha20poly1305(key, nonce);
    const encrypted = cipher.encrypt(encodeUtf8(plaintext));
    return `v1:${toHex(nonce)}:${toHex(encrypted)}`;
}

function decrypt(payload: string, key: Uint8Array): string | null {
    if (!payload.startsWith('v1:')) return null;
    const parts = payload.split(':');
    if (parts.length !== 3) return null;

    const nonce = fromHex(parts[1]);
    const ciphertext = fromHex(parts[2]);
    if (!nonce || nonce.length !== NONCE_BYTES || !ciphertext) return null;

    try {
        const cipher = xchacha20poly1305(key, nonce);
        const decrypted = cipher.decrypt(ciphertext);
        return decodeUtf8(decrypted);
    } catch {
        return null;
    }
}

async function migrateFromLegacySecureStore(key: string): Promise<string | null> {
    // Legacy versions wrote the full session blob into SecureStore directly under the Supabase storage key.
    // We intentionally read with default options here to match the legacy write.
    try {
        const legacy = await SecureStore.getItemAsync(key);
        if (!legacy) return null;

        try {
            const encKey = await getOrCreateEncryptionKey();
            const encrypted = await encrypt(legacy, encKey);
            StorageService.setGlobal(storageKey(key), encrypted);
            await SecureStore.deleteItemAsync(key);
        } catch (error) {
            console.error('[SupabaseAuthStorage] Failed migrating legacy session:', error);
        }

        return legacy;
    } catch {
        return null;
    }
}

export const supabaseAuthStorage = {
    getItem: async (key: string): Promise<string | null> => {
        const stored = StorageService.getGlobal<string>(storageKey(key));
        if (!stored) {
            return await migrateFromLegacySecureStore(key);
        }

        const encKey = await loadEncryptionKey();
        if (!encKey) {
            // If the key is missing (device restore / keychain reset), the ciphertext is unusable.
            StorageService.removeGlobal(storageKey(key));
            return await migrateFromLegacySecureStore(key);
        }

        const decrypted = decrypt(stored, encKey);
        if (decrypted === null) {
            console.warn('[SupabaseAuthStorage] Failed to decrypt stored session; clearing.');
            StorageService.removeGlobal(storageKey(key));
            return await migrateFromLegacySecureStore(key);
        }

        return decrypted;
    },

    setItem: async (key: string, value: string): Promise<void> => {
        try {
            const encKey = await getOrCreateEncryptionKey();
            const encrypted = await encrypt(value, encKey);
            StorageService.setGlobal(storageKey(key), encrypted);

            // Best-effort cleanup of any legacy plaintext blob.
            try {
                await SecureStore.deleteItemAsync(key);
            } catch {
                // ignore
            }
        } catch (error) {
            console.error('[SupabaseAuthStorage] Failed to persist session:', error);
        }
    },

    removeItem: async (key: string): Promise<void> => {
        try {
            StorageService.removeGlobal(storageKey(key));
        } catch (error) {
            console.error('[SupabaseAuthStorage] Failed to remove session:', error);
        }

        // Best-effort cleanup of any legacy plaintext blob.
        try {
            await SecureStore.deleteItemAsync(key);
        } catch {
            // ignore
        }
    },
};
