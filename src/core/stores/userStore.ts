import { create } from 'zustand';
import { getStoredLanguage, setStoredLanguage } from '../languages';
import { AddonService } from '../services/AddonService';
import { StorageService } from '../storage';
import { AddonManifest } from '../types/addon-types';

// --- Interfaces ---

export interface AppSettings {
    tmdbKey: string;
    omdbKey: string;
    addonSearchEnabled: boolean;
    autoplayEnabled: boolean;
    language: string;
    audioLanguage: string;
    subtitleLanguage: string;
    subtitleSize: number;
    subtitlePosition: number;
    subtitleColor: string;
    subtitleBackColor: string;
    subtitleBorderColor: string;
    introSkipMode: 'off' | 'manual' | 'auto';
    mobileNavbarStyle: 'floating' | 'edge-to-edge';
    openRouterKey: string;
    aiInsightsMode: 'off' | 'on-demand' | 'always';
    aiModelType: 'deepseek-r1' | 'nvidia-nemotron' | 'custom';
    aiCustomModelName: string;
    showRatingBadges: boolean;
    accentColor: string;
    amoledMode: boolean;
    useMaterialYou: boolean;
    videoPlayerEngine: 'auto' | 'exoplayer' | 'mpv';

    // Player engine tuning (used by MPV surface)
    decoderMode?: 'auto' | 'sw' | 'hw' | 'hw+';
    gpuMode?: 'gpu' | 'gpu-next';
    updatedAt?: number;
}

export interface Addon {
    url: string;
    enabled: boolean;
    name?: string;
    updatedAt?: number;
}

export interface CatalogPreferences {
    disabled: string[];
    hero: string[];
    traktTopPicks: boolean;
    continueWatching: boolean;
    updatedAt?: number;
}

export interface TraktAuth {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    updatedAt?: number;
}

export interface UserState {
    settings: AppSettings;
    addons: Addon[];
    manifests: Record<string, AddonManifest>; // In-memory separate from persistent `addons`
    catalogPrefs: CatalogPreferences;
    traktAuth: TraktAuth;
}

// --- Defaults ---

function getDefaultSettings(): AppSettings {
    return {
        tmdbKey: StorageService.getUser<string>('crispy-tmdb-key') || '',
        omdbKey: StorageService.getUser<string>('crispy-omdb-key') || '',
        addonSearchEnabled: StorageService.getUser<boolean>('crispy-addon-search-enabled') || false,
        autoplayEnabled: StorageService.getUser<boolean>('crispy-autoplay-enabled') || false,
        language: getStoredLanguage(),
        audioLanguage: StorageService.getUser<string>('crispy-audio-language') || 'en',
        subtitleLanguage: StorageService.getUser<string>('crispy-subtitle-language') || 'en',
        subtitleSize: StorageService.getUser<number>('crispy-subtitle-size') ?? 100,
        subtitlePosition: StorageService.getUser<number>('crispy-subtitle-position') ?? 5,
        subtitleColor: StorageService.getUser<string>('crispy-subtitle-color') || '#FFFFFF',
        subtitleBackColor: StorageService.getUser<string>('crispy-subtitle-back-color') || '#00000000',
        subtitleBorderColor: StorageService.getUser<string>('crispy-subtitle-border-color') || '#000000',
        introSkipMode: (StorageService.getUser<string>('crispy-intro-skip-mode') as any) || 'manual',
        mobileNavbarStyle: (StorageService.getUser<string>('crispy-mobile-navbar-style') as any) || 'floating',
        openRouterKey: StorageService.getUser<string>('crispy-openrouter-key') || '',
        aiInsightsMode: (StorageService.getUser<string>('crispy-ai-insights-mode') as any) || 'off',
        aiModelType: (StorageService.getUser<string>('crispy-ai-model-type') as any) || 'deepseek-r1',
        aiCustomModelName: StorageService.getUser<string>('crispy-ai-custom-model-name') || '',
        showRatingBadges: StorageService.getUser<boolean>('crispy-show-rating-badges') ?? true,
        accentColor: StorageService.getUser<string>('crispy-accent-color') || 'Golden Amber',
        amoledMode: !!StorageService.getUser<boolean>('crispy-amoled-mode'),
        useMaterialYou: StorageService.getUser<boolean>('crispy-material-you') ?? true,
        videoPlayerEngine: (StorageService.getUser<string>('crispy-video-engine') as any) || 'auto',

        decoderMode: (StorageService.getUser<string>('crispy-decoder-mode') as any) || 'auto',
        gpuMode: (StorageService.getUser<string>('crispy-gpu-mode') as any) || 'gpu',
    };
}

function getDefaultAddons(): Addon[] {
    return [
        {
            url: 'https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club/bmZ4LGRucCxhbXAsYXRwLGhibzo6dXM6MTc2Njk2NjU3MDcwNA%3D%3D/manifest.json',
            enabled: true,
            name: 'Streaming Catalogs'
        },
        {
            url: 'https://opensubtitles-v3.strem.io/manifest.json',
            enabled: true,
            name: 'OpenSubtitles v3'
        }
    ];
}

const DEFAULT_CATALOG_PREFS: CatalogPreferences = {
    disabled: [],
    hero: [
        'pw.ers.netflix-catalog-movie-nfx',
        'pw.ers.netflix-catalog-series-nfx',
        'pw.ers.netflix-catalog-movie-hbm',
        'pw.ers.netflix-catalog-series-hbm'
    ],
    traktTopPicks: true,
    continueWatching: true
};

const DEFAULT_TRAKT_AUTH: TraktAuth = {};

// --- Store Definition ---

export interface UserStoreState extends UserState {
    loading: boolean;
    setLoading: (loading: boolean) => void;

    // Unified Updates
    updateSettings: (updates: Partial<AppSettings>) => void;
    updateAddons: (addons: Addon[]) => void;
    updateCatalogPrefs: (prefs: Partial<CatalogPreferences>) => void;
    updateTraktAuth: (auth: TraktAuth) => void;

    // Addon Actions (Unified)
    addAddon: (url: string) => Promise<void>;
    removeAddon: (url: string) => void;
    updateManifest: (url: string, manifest: AddonManifest) => void;
    syncManifests: () => Promise<void>;

    // Bulk Hydration
    hydrate: (data: Partial<UserState>) => void;

    // Lifecycle
    reloadFromStorage: () => void;
    resetToDefaults: () => void;
}

// Helper to persist standard settings to StorageService (Side effects)
function persistLocalSettings(updates: Partial<AppSettings>) {
    if ('language' in updates && updates.language) setStoredLanguage(updates.language);

    // Persist ALL settings fields
    const keys: (keyof AppSettings)[] = [
        'introSkipMode', 'mobileNavbarStyle', 'omdbKey', 'tmdbKey',
        'openRouterKey', 'aiInsightsMode', 'aiModelType', 'aiCustomModelName',
        'accentColor', 'amoledMode', 'useMaterialYou', 'videoPlayerEngine',
        'audioLanguage', 'subtitleLanguage', 'subtitleSize', 'subtitlePosition',
        'subtitleColor', 'subtitleBackColor', 'subtitleBorderColor',
        'showRatingBadges', 'addonSearchEnabled', 'autoplayEnabled'
    ];

    keys.forEach(key => {
        if (key in updates) {
            const val = updates[key];
            const storageKey = `crispy-${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}`; // rudimentary kebab-case
            // manual overrides for legacy keys
            const map: Record<string, string> = {
                'introSkipMode': 'crispy-intro-skip-mode',
                'mobileNavbarStyle': 'crispy-mobile-navbar-style',
                'omdbKey': 'crispy-omdb-key',
                'tmdbKey': 'crispy-tmdb-key',
                'openRouterKey': 'crispy-openrouter-key',
                'aiInsightsMode': 'crispy-ai-insights-mode',
                'aiModelType': 'crispy-ai-model-type',
                'aiCustomModelName': 'crispy-ai-custom-model-name',
                'accentColor': 'crispy-accent-color',
                'amoledMode': 'crispy-amoled-mode',
                'useMaterialYou': 'crispy-material-you',
                'videoPlayerEngine': 'crispy-video-engine',
                'audioLanguage': 'crispy-audio-language',
                'subtitleLanguage': 'crispy-subtitle-language',
                'subtitleSize': 'crispy-subtitle-size',
                'subtitlePosition': 'crispy-subtitle-position',
                'subtitleColor': 'crispy-subtitle-color',
                'subtitleBackColor': 'crispy-subtitle-back-color',
                'subtitleBorderColor': 'crispy-subtitle-border-color',
                'showRatingBadges': 'crispy-show-rating-badges',
                'addonSearchEnabled': 'crispy-addon-search-enabled',
                'autoplayEnabled': 'crispy-autoplay-enabled',
            };
            const finalKey = map[key] || storageKey;

            if (val === undefined || val === '' || val === null) {
                StorageService.removeUser(finalKey);
            } else {
                StorageService.setUser(finalKey, val);
            }
        }
    });
}

// Initializer to load addons safely
function loadInitialAddons(): Addon[] {
    const stored = StorageService.getUser<Addon[]>('crispy-addons');
    // If not found or empty, try the DEFAULT_ADDONS
    if (!stored || !Array.isArray(stored) || stored.length === 0) {
        return getDefaultAddons();
    }
    return stored;
}

export const useUserStore = create<UserStoreState>((set, get) => {
    // 1. Load initial state synchronously from MMKV
    const initialAddons = loadInitialAddons();

    return {
        settings: getDefaultSettings(),
        addons: initialAddons,
        manifests: {}, // Start empty, hydrate later via effect/action
        catalogPrefs: StorageService.getUser<CatalogPreferences>('crispy-catalog-prefs') || DEFAULT_CATALOG_PREFS,
        traktAuth: StorageService.getUser<TraktAuth>('crispy-trakt-auth') || DEFAULT_TRAKT_AUTH,

        loading: true,
        setLoading: (loading) => set({ loading }),

        updateSettings: (updates) => {
            const current = get().settings;
            const next = { ...current, ...updates, updatedAt: Date.now() };

            set({ settings: next });
            persistLocalSettings(updates);
        },

        updateAddons: (addons) => {
            set({ addons });
            StorageService.setUser('crispy-addons', addons);
        },

        // --- NEW Addon Actions ---

        addAddon: async (url) => {
            const normalizedUrl = AddonService.normalizeAddonUrl(url);

            // Check if already exists
            const currentAddons = get().addons;
            if (currentAddons.some(a => AddonService.normalizeAddonUrl(a.url) === normalizedUrl)) {
                return; // Already exists
            }

            try {
                // Fetch to validate and get name
                const manifest = await AddonService.fetchManifest(normalizedUrl);

                const newAddon: Addon = {
                    url: normalizedUrl,
                    enabled: true,
                    name: manifest.name,
                    updatedAt: Date.now()
                };

                const nextAddons = [...currentAddons, newAddon];

                // Update State
                set((state) => ({
                    addons: nextAddons,
                    manifests: { ...state.manifests, [normalizedUrl]: manifest }
                }));

                // Persist
                StorageService.setUser('crispy-addons', nextAddons);

            } catch (e) {
                console.error('[UserStore] Failed to add addon:', url, e);
                throw e;
            }
        },

        removeAddon: (url) => {
            const normalizedUrl = AddonService.normalizeAddonUrl(url);
            const currentAddons = get().addons;
            const nextAddons = currentAddons.filter(a => AddonService.normalizeAddonUrl(a.url) !== normalizedUrl);

            set((state) => {
                const nextManifests = { ...state.manifests };
                delete nextManifests[normalizedUrl];
                return {
                    addons: nextAddons,
                    manifests: nextManifests
                };
            });

            StorageService.setUser('crispy-addons', nextAddons);
        },

        updateManifest: (url, manifest) => {
            set((state) => ({
                manifests: { ...state.manifests, [url]: manifest }
            }));
        },

        syncManifests: async () => {
            const { addons, updateManifest } = get();
            const promises = addons.map(async (addon) => {
                try {
                    const manifest = await AddonService.fetchManifest(addon.url);
                    updateManifest(addon.url, manifest);
                } catch (e) {
                    console.warn(`[UserStore] Failed to refresh manifest for ${addon.url}`, e);
                }
            });
            await Promise.allSettled(promises);
        },


        updateCatalogPrefs: (prefs) => {
            const current = get().catalogPrefs;
            const next = { ...current, ...prefs, updatedAt: Date.now() };
            set({ catalogPrefs: next });
            StorageService.setUser('crispy-catalog-prefs', next);
        },

        updateTraktAuth: (auth) => {
            const next = { ...auth, updatedAt: Date.now() };
            set({ traktAuth: next });
            StorageService.setUser('crispy-trakt-auth', next);
        },

        hydrate: (fetched) => {
            const current = get();
            const nextState: Partial<UserState> = {};

            if (fetched.settings) {
                nextState.settings = { ...current.settings, ...fetched.settings };
                persistLocalSettings(nextState.settings);
            }
            if (fetched.addons) {
                nextState.addons = fetched.addons;
                StorageService.setUser('crispy-addons', nextState.addons);
                // Trigger re-fetch of manifests for new addons
                setTimeout(() => get().syncManifests(), 100);
            }
            if (fetched.catalogPrefs) {
                nextState.catalogPrefs = { ...current.catalogPrefs, ...fetched.catalogPrefs };
            }
            if (fetched.traktAuth) {
                nextState.traktAuth = { ...current.traktAuth, ...fetched.traktAuth };
                StorageService.setUser('crispy-trakt-auth', nextState.traktAuth);
            }

            set({ ...nextState as any, loading: false });
        },

        reloadFromStorage: () => {
            console.log('[UserStore] 🔄 Reloading from storage (Context Switch)...');
            const addons = loadInitialAddons();

            set({
                settings: getDefaultSettings(),
                addons: addons,
                manifests: {},
                catalogPrefs: StorageService.getUser<CatalogPreferences>('crispy-catalog-prefs') || DEFAULT_CATALOG_PREFS,
                traktAuth: StorageService.getUser<TraktAuth>('crispy-trakt-auth') || DEFAULT_TRAKT_AUTH,
                loading: false // Data is ready
            });

            // Re-sync manifests for the loaded addons
            setTimeout(() => get().syncManifests(), 100);
        },

        resetToDefaults: () => {
            console.log('[UserStore] ⚠️ Factory Reset / Logout Wipe');
            const defaults = getDefaultAddons();
            set({
                settings: getDefaultSettings(),
                addons: defaults,
                manifests: {},
                catalogPrefs: DEFAULT_CATALOG_PREFS,
                traktAuth: StorageService.getUser<TraktAuth>('crispy-trakt-auth') || DEFAULT_TRAKT_AUTH,
                loading: true
            });
            // Ensure defaults are persisted (Wipe custom data)
            StorageService.setUser('crispy-addons', defaults);
        }
    };
});
