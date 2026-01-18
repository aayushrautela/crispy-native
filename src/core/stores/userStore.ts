import { create } from 'zustand';
import { StorageService } from '../storage';
import { getStoredLanguage, setStoredLanguage } from '../languages';

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
    order: string[];
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
    catalogPrefs: CatalogPreferences;
    traktAuth: TraktAuth;
}

// --- Defaults ---

function getDefaultSettings(): AppSettings {
    return {
        tmdbKey: '',
        omdbKey: StorageService.getUser<string>('crispy-omdb-key') || '',
        addonSearchEnabled: false,
        autoplayEnabled: false,
        language: getStoredLanguage(),
        audioLanguage: 'en',
        subtitleLanguage: 'en',
        subtitleSize: 100,
        subtitlePosition: 5,
        subtitleColor: '#FFFFFF',
        subtitleBackColor: '#00000000',
        subtitleBorderColor: '#000000',
        introSkipMode: (StorageService.getUser<string>('crispy-intro-skip-mode') as any) || 'manual',
        mobileNavbarStyle: (StorageService.getUser<string>('crispy-mobile-navbar-style') as any) || 'floating',
        openRouterKey: '',
        aiInsightsMode: 'off',
        aiModelType: 'deepseek-r1',
        aiCustomModelName: '',
        showRatingBadges: true,
        accentColor: StorageService.getUser<string>('crispy-accent-color') || 'Golden Amber',
        amoledMode: !!StorageService.getUser<boolean>('crispy-amoled-mode'),
    };
}

function getDefaultAddons(): Addon[] {
    return [{
        url: 'https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club/bmZ4LGRucCxhbXAsYXRwLGhibzo6dXM6MTc2Njk2NjU3MDcwNA%3D%3D/manifest.json',
        enabled: true,
        name: 'Streaming Catalogs'
    }];
}

const DEFAULT_CATALOG_PREFS: CatalogPreferences = {
    disabled: [],
    order: [],
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

interface UserStoreState extends UserState {
    loading: boolean;
    setLoading: (loading: boolean) => void;

    // Unified Updates
    updateSettings: (updates: Partial<AppSettings>) => void;
    updateAddons: (addons: Addon[]) => void;
    updateCatalogPrefs: (prefs: Partial<CatalogPreferences>) => void;
    updateTraktAuth: (auth: TraktAuth) => void;

    // Bulk Hydration
    hydrate: (data: Partial<UserState>) => void;

    // Lifecycle
    reset: () => void;
}

// Helper to persist standard settings to StorageService (Side effects)
function persistLocalSettings(updates: Partial<AppSettings>) {
    if ('language' in updates && updates.language) {
        setStoredLanguage(updates.language);
    }
    if ('introSkipMode' in updates) StorageService.setUser('crispy-intro-skip-mode', updates.introSkipMode);
    if ('mobileNavbarStyle' in updates) StorageService.setUser('crispy-mobile-navbar-style', updates.mobileNavbarStyle);

    if ('omdbKey' in updates) {
        if (updates.omdbKey) StorageService.setUser('crispy-omdb-key', updates.omdbKey);
        else StorageService.removeUser('crispy-omdb-key');
    }
    if ('tmdbKey' in updates) {
        if (updates.tmdbKey) StorageService.setUser('crispy-tmdb-key', updates.tmdbKey);
        else StorageService.removeUser('crispy-tmdb-key');
    }

    // Theme
    if ('accentColor' in updates) StorageService.setUser('crispy-accent-color', updates.accentColor);
    if ('amoledMode' in updates) StorageService.setUser('crispy-amoled-mode', updates.amoledMode);
}

export const useUserStore = create<UserStoreState>((set, get) => ({
    settings: getDefaultSettings(),
    addons: StorageService.getUser<Addon[]>('crispy-addons') || getDefaultAddons(),
    catalogPrefs: DEFAULT_CATALOG_PREFS,
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

    updateCatalogPrefs: (prefs) => {
        const current = get().catalogPrefs;
        const next = { ...current, ...prefs, updatedAt: Date.now() };
        set({ catalogPrefs: next });
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

    reset: () => {
        set({
            settings: getDefaultSettings(),
            addons: StorageService.getUser<Addon[]>('crispy-addons') || getDefaultAddons(),
            catalogPrefs: DEFAULT_CATALOG_PREFS,
            traktAuth: StorageService.getUser<TraktAuth>('crispy-trakt-auth') || DEFAULT_TRAKT_AUTH,
            loading: true
        });
    }
}));
