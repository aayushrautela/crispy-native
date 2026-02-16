import { create } from 'zustand';
import { getStoredLanguage, setStoredLanguage } from '../languages';
import { AddonService } from '../services/AddonService';
import { StorageService } from '../storage';
import { AddonManifest } from '../types/addon-types';
import type { CrispyDecoderMode, CrispyGpuMode } from '@/modules/crispy-native-core';

// --- Interfaces ---

export interface AppSettings {
    tmdbAccessToken: string;
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
    // Playback engine preference. "auto" starts with ExoPlayer and falls back to VLC when needed.
    videoPlayerEngine: 'auto' | 'vlc';

    // VLC (Android) tuning
    decoderMode?: CrispyDecoderMode;
    gpuMode?: CrispyGpuMode;
    updatedAt?: number;
}

function normalizeVideoPlayerEngine(value: unknown): AppSettings['videoPlayerEngine'] {
    const engine = typeof value === 'string' ? value.toLowerCase() : '';
    // Legacy values: treat explicit Exo selection as Auto.
    return engine === 'vlc' ? 'vlc' : 'auto';
}

function normalizeDecoderMode(value: unknown): CrispyDecoderMode {
    const mode = typeof value === 'string' ? value.toLowerCase() : '';
    if (mode === 'sw' || mode === 'hw' || mode === 'hw+' || mode === 'auto') return mode as CrispyDecoderMode;
    return 'auto';
}

function normalizeGpuMode(value: unknown): CrispyGpuMode {
    const mode = typeof value === 'string' ? value.toLowerCase() : '';
    if (mode === 'gpu' || mode === 'gpu-next') return mode as CrispyGpuMode;
    return 'gpu';
}

function sanitizeSettingsPatch(updates: Partial<AppSettings>): Partial<AppSettings> {
    return { ...updates };
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
        tmdbAccessToken:
            StorageService.getProfile<string>('crispy-tmdb-access-token') ||
            '',
        omdbKey: StorageService.getProfile<string>('crispy-omdb-key') || '',
        addonSearchEnabled: StorageService.getProfile<boolean>('crispy-addon-search-enabled') || false,
        autoplayEnabled: StorageService.getProfile<boolean>('crispy-autoplay-enabled') || false,
        language: getStoredLanguage(),
        audioLanguage: StorageService.getProfile<string>('crispy-audio-language') || 'en',
        subtitleLanguage: StorageService.getProfile<string>('crispy-subtitle-language') || 'en',
        subtitleSize: StorageService.getProfile<number>('crispy-subtitle-size') ?? 100,
        subtitlePosition: StorageService.getProfile<number>('crispy-subtitle-position') ?? 5,
        subtitleColor: StorageService.getProfile<string>('crispy-subtitle-color') || '#FFFFFF',
        subtitleBackColor: StorageService.getProfile<string>('crispy-subtitle-back-color') || '#00000000',
        subtitleBorderColor: StorageService.getProfile<string>('crispy-subtitle-border-color') || '#000000',
        introSkipMode: (StorageService.getProfile<string>('crispy-intro-skip-mode') as any) || 'manual',
        mobileNavbarStyle: (StorageService.getProfile<string>('crispy-mobile-navbar-style') as any) || 'floating',
        openRouterKey: StorageService.getProfile<string>('crispy-openrouter-key') || '',
        aiInsightsMode: (StorageService.getProfile<string>('crispy-ai-insights-mode') as any) || 'off',
        aiModelType: (StorageService.getProfile<string>('crispy-ai-model-type') as any) || 'deepseek-r1',
        aiCustomModelName: StorageService.getProfile<string>('crispy-ai-custom-model-name') || '',
        showRatingBadges: StorageService.getProfile<boolean>('crispy-show-rating-badges') ?? true,
        accentColor: StorageService.getProfile<string>('crispy-accent-color') || 'Golden Amber',
        amoledMode: !!StorageService.getProfile<boolean>('crispy-amoled-mode'),
        useMaterialYou: StorageService.getProfile<boolean>('crispy-material-you') ?? true,
        videoPlayerEngine: normalizeVideoPlayerEngine(StorageService.getProfile<string>('crispy-video-engine')),

        decoderMode: normalizeDecoderMode(StorageService.getProfile<string>('crispy-decoder-mode')),
        gpuMode: normalizeGpuMode(StorageService.getProfile<string>('crispy-gpu-mode')),
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
    reset: () => void;
}

// Helper to persist standard settings to StorageService (Side effects)
function persistLocalSettings(updates: Partial<AppSettings>) {
    if ('language' in updates && updates.language) setStoredLanguage(updates.language);

    // Persist ALL settings fields
    const keys: (keyof AppSettings)[] = [
        'introSkipMode', 'mobileNavbarStyle', 'omdbKey', 'tmdbAccessToken',
        'openRouterKey', 'aiInsightsMode', 'aiModelType', 'aiCustomModelName',
        'accentColor', 'amoledMode', 'useMaterialYou', 'videoPlayerEngine',
        'decoderMode', 'gpuMode',
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
                'tmdbAccessToken': 'crispy-tmdb-access-token',
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
                StorageService.removeProfile(finalKey);
            } else {
                StorageService.setProfile(finalKey, val);
            }
        }
    });
}

// Initializer to load addons safely
function loadInitialAddons(): Addon[] {
    const stored = StorageService.getAccount<Addon[]>('crispy-addons');
    // If not found or empty, try the DEFAULT_ADDONS
    if (!stored || !Array.isArray(stored) || stored.length === 0) {
        return getDefaultAddons();
    }
    return stored;
}

export const useUserStore = create<UserStoreState>((set, get) => {
    console.log('[CRISPY-BOOT] useUserStore initializing');
    // 1. Load initial state synchronously from MMKV
    const initialAddons = loadInitialAddons();

    return {
        settings: getDefaultSettings(),
        addons: initialAddons,
        manifests: {}, // Start empty, hydrate later via effect/action
        catalogPrefs: StorageService.getProfile<CatalogPreferences>('crispy-catalog-prefs') || DEFAULT_CATALOG_PREFS,
        traktAuth: StorageService.getProfile<TraktAuth>('crispy-trakt-auth') || DEFAULT_TRAKT_AUTH,

        loading: true,
        setLoading: (loading) => set({ loading }),

        updateSettings: (updates) => {
            const normalizedUpdates = sanitizeSettingsPatch(updates);
            const current = get().settings;
            const next = { ...current, ...normalizedUpdates, updatedAt: Date.now() };

            set({ settings: next });
            persistLocalSettings(normalizedUpdates);
        },

        updateAddons: (addons) => {
            set({ addons });
            StorageService.setAccount('crispy-addons', addons);
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
                StorageService.setAccount('crispy-addons', nextAddons);

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

            StorageService.setAccount('crispy-addons', nextAddons);
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
            StorageService.setProfile('crispy-catalog-prefs', next);
        },

        updateTraktAuth: (auth) => {
            const next = { ...auth, updatedAt: Date.now() };
            set({ traktAuth: next });
            StorageService.setProfile('crispy-trakt-auth', next);
        },

        hydrate: (fetched) => {
            const current = get();
            const nextState: Partial<UserState> = {};

            if (fetched.settings) {
                nextState.settings = { ...current.settings, ...sanitizeSettingsPatch(fetched.settings) };
                persistLocalSettings(nextState.settings);
            }
            if (fetched.addons) {
                nextState.addons = fetched.addons;
                StorageService.setAccount('crispy-addons', nextState.addons);
                // Trigger re-fetch of manifests for new addons
                setTimeout(() => get().syncManifests(), 100);
            }
            if (fetched.catalogPrefs) {
                nextState.catalogPrefs = { ...current.catalogPrefs, ...fetched.catalogPrefs };
                StorageService.setProfile('crispy-catalog-prefs', nextState.catalogPrefs);
            }
            if (fetched.traktAuth) {
                nextState.traktAuth = { ...current.traktAuth, ...fetched.traktAuth };
                StorageService.setProfile('crispy-trakt-auth', nextState.traktAuth);
            }

            set({ ...nextState as any, loading: false });
        },

        reloadFromStorage: () => {
            console.log('[UserStore] Reloading from storage (Context Switch)...');
            const addons = loadInitialAddons();

            set({
                settings: getDefaultSettings(),
                addons: addons,
                manifests: {},
                catalogPrefs: StorageService.getProfile<CatalogPreferences>('crispy-catalog-prefs') || DEFAULT_CATALOG_PREFS,
                traktAuth: StorageService.getProfile<TraktAuth>('crispy-trakt-auth') || DEFAULT_TRAKT_AUTH,
                loading: false // Data is ready
            });

            // Re-sync manifests for the loaded addons
            setTimeout(() => get().syncManifests(), 100);
        },

        resetToDefaults: () => {
            console.log('[UserStore] Factory Reset / Logout Wipe');
            const defaults = getDefaultAddons();
            set({
                settings: getDefaultSettings(),
                addons: defaults,
                manifests: {},
                catalogPrefs: DEFAULT_CATALOG_PREFS,
                traktAuth: StorageService.getProfile<TraktAuth>('crispy-trakt-auth') || DEFAULT_TRAKT_AUTH,
                loading: true
            });
            // Ensure defaults are persisted (Wipe custom data)
            StorageService.setAccount('crispy-addons', defaults);
        },
        
        // Alias for resetToDefaults or similar reset logic expected by SyncService
        reset: () => {
             get().reloadFromStorage();
        }
    };
});
