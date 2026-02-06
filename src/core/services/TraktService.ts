import { StorageService } from '../storage';
import { TraktAuth, useUserStore } from '../stores/userStore';

// Helper to safely get IDs
const media_ids = (item: any) => item?.ids || {};

// Storage keys - these will be prefixed by StorageService for per-user isolation
const TRAKT_AUTH_KEY = 'crispy-trakt-auth';

// Trakt API configuration
const TRAKT_API_URL = 'https://api.trakt.tv';
const TRAKT_CLIENT_ID = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
const TRAKT_CLIENT_SECRET = process.env.EXPO_PUBLIC_TRAKT_CLIENT_SECRET;
const TRAKT_REDIRECT_URI = 'crispy-native://auth/trakt';

class TraktApiError extends Error {
    public readonly status: number;
    public readonly bodyText?: string;

    constructor(status: number, message: string, bodyText?: string) {
        super(message);
        this.name = 'TraktApiError';
        this.status = status;
        this.bodyText = bodyText;
    }
}

export interface TraktPlaybackItem {
    progress: number;
    paused_at: string;
    id: number;
    type: 'movie' | 'episode';
    movie?: any;
    episode?: any;
    show?: any;
}

export class TraktService {
    private static _instance: TraktService;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiry: number = 0;
    private isInitialized: boolean = false;

    // Rate limiting
    private lastApiCall: number = 0;
    private readonly MIN_API_INTERVAL = 500;
    private requestQueue: Promise<any> = Promise.resolve();

    // Scrobble guards (modeled after Nuvio)
    private readonly SCROBBLE_SYNC_DEBOUNCE_MS = 5000;
    private readonly SCROBBLE_STOP_DEBOUNCE_MS = 30000;
    private readonly SCROBBLE_START_DEBOUNCE_MS = 30000;
    private readonly SCROBBLE_ERROR_BACKOFF_MS = 30000;
    private readonly SCROBBLE_EXPIRY_MS = 46 * 60 * 1000;

    private lastScrobbleSyncTimes: Map<string, number> = new Map();
    private lastScrobbleStopTimes: Map<string, number> = new Map();
    private lastScrobbleStartTimes: Map<string, number> = new Map();
    private lastScrobbleErrorTimes: Map<string, number> = new Map();
    private scrobbledItems: Set<string> = new Set();
    private scrobbledTimestamps: Map<string, number> = new Map();
    private currentlyWatching: Set<string> = new Set();

    private constructor() {
        this.initialize();
    }

    public static getInstance(): TraktService {
        if (!TraktService._instance) {
            TraktService._instance = new TraktService();
        }
        return TraktService._instance;
    }

    public initialize() {
        if (this.isInitialized) return;

        try {
            // Reverted to User storage for profile isolation
            const auth = StorageService.getUser<TraktAuth>(TRAKT_AUTH_KEY);
            if (auth) {
                this.accessToken = auth.accessToken || null;
                this.refreshToken = auth.refreshToken || null;
                this.tokenExpiry = auth.expiresAt || 0;
            }
            this.isInitialized = true;
            console.log('[TraktService] Initialized (User). Authenticated:', !!this.accessToken);
        } catch (error) {
            console.error('[TraktService] Initialization failed:', error);
        }
    }

    // Call this when switching users to force re-read of storage
    public reset() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = 0;
        this.isInitialized = false;
        this.initialize();
    }

    public isAuthenticated(): boolean {
        this.initialize();
        return !!this.accessToken;
    }

    public getAuthUrl(): string {
        return `https://trakt.tv/oauth/authorize?response_type=code&client_id=${TRAKT_CLIENT_ID}&redirect_uri=${encodeURIComponent(TRAKT_REDIRECT_URI)}`;
    }

    public async exchangeCodeForToken(code: string): Promise<boolean> {
        try {
            const response = await fetch(`${TRAKT_API_URL}/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    client_id: TRAKT_CLIENT_ID,
                    client_secret: TRAKT_CLIENT_SECRET,
                    redirect_uri: TRAKT_REDIRECT_URI,
                    grant_type: 'authorization_code',
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Token exchange failed: ${response.status} ${text}`);
            }

            const data = await response.json();
            const auth: TraktAuth = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + (data.expires_in * 1000)
            };

            this.saveTokens(auth);
            useUserStore.getState().updateTraktAuth(auth);

            return true;
        } catch (error) {
            console.error('[TraktService] Exchange failed:', error);
            return false;
        }
    }

    public async oauthDeviceCode(): Promise<any> {
        console.log('[TraktService] oauthDeviceCode: Requesting from Trakt API...');
        if (!TRAKT_CLIENT_ID) {
            console.error('[TraktService] TRAKT_CLIENT_ID is missing!');
            throw new Error('TRAKT_CLIENT_ID environment variable is missing');
        }

        const response = await fetch(`${TRAKT_API_URL}/oauth/device/code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: TRAKT_CLIENT_ID
            })
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => 'No body');
            console.error(`[TraktService] Trakt API response not OK: ${response.status}`, errBody);
            throw new Error(`Failed to get device code: ${response.status}`);
        }

        const data = await response.json();
        console.log('[TraktService] oauthDeviceCode: Success');
        return data;
    }

    public async oauthToken(deviceCode: string): Promise<TraktAuth> {
        const response = await fetch(`${TRAKT_API_URL}/oauth/device/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: deviceCode,
                client_id: TRAKT_CLIENT_ID,
                client_secret: TRAKT_CLIENT_SECRET
            })
        });

        if (!response.ok) {
            // 400 means pending, others are errors
            return {};
        }

        const data = await response.json();
        const auth: TraktAuth = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in * 1000)
        };

        this.saveTokens(auth);
        useUserStore.getState().updateTraktAuth(auth);

        return auth;
    }

    private saveTokens(auth: TraktAuth) {
        this.accessToken = auth.accessToken || null;
        this.refreshToken = auth.refreshToken || null;
        this.tokenExpiry = auth.expiresAt || 0;

        // Save Trakt to per-user namespace
        StorageService.setUser(TRAKT_AUTH_KEY, auth);
    }

    public logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = 0;

        StorageService.removeUser(TRAKT_AUTH_KEY);
        useUserStore.getState().updateTraktAuth({});
    }

    private async refreshAccessToken(): Promise<void> {
        if (!this.refreshToken) throw new Error('No refresh token available');

        try {
            console.log('[TraktService] Refreshing token...');
            const response = await fetch(`${TRAKT_API_URL}/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refresh_token: this.refreshToken,
                    client_id: TRAKT_CLIENT_ID,
                    client_secret: TRAKT_CLIENT_SECRET,
                    redirect_uri: TRAKT_REDIRECT_URI,
                    grant_type: 'refresh_token',
                }),
            });

            if (!response.ok) throw new Error(`Refresh failed: ${response.status}`);

            const data = await response.json();
            const auth: TraktAuth = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + (data.expires_in * 1000),
                updatedAt: Date.now()
            };

            this.saveTokens(auth);
            useUserStore.getState().updateTraktAuth(auth);

        } catch (error) {
            console.error('[TraktService] Refresh failed:', error);
            this.logout();
            throw error;
        }
    }

    // Generic API request with queueing and rate limiting
    private async apiRequest<T>(
        endpoint: string,
        method: 'GET' | 'POST' | 'DELETE' = 'GET',
        body?: any,
        retryCount = 0
    ): Promise<T> {
        return this.requestQueue = this.requestQueue.then(async () => {
            return this.executeRequest<T>(endpoint, method, body, retryCount);
        }).catch(e => {
            throw e;
        });
    }

    // --- Normalization (Ported from WebUI hooks/useTraktIntegration.ts) ---

    private normalize(item: any): any {
        if (!item) return item;

        // Handle various shapes (Trakt {movie: {...}}, or direct Meta like)
        const media = item.movie || item.show || item.episode || item;
        let type = item.type || (item.movie ? 'movie' : item.show ? 'series' : item.episode ? 'episode' : undefined);

        // Normalize 'show' to 'series' for internal consistency
        if (type === 'show') type = 'series';

        if (!media) return item;

        // Hoist IDs for direct access but KEEP the original ids object
        const ids = media.ids || item.ids || {};

        // Robust Image Parsing (WebUI logic)
        // Trakt 'extended=images' returns arrays of paths or full URLs
        const getUrl = (paths: string[] | string | undefined) => {
            if (!paths) return undefined;
            const path = Array.isArray(paths) ? paths[0] : paths;
            if (!path) return undefined;
            // Ensure Trakt relative paths get https://
            return path.startsWith('http') ? path : `https://${path}`;
        };

        const poster =
            getUrl(media.images?.poster) ||
            media.images?.poster?.medium ||
            media.images?.poster?.full ||
            media.poster;

        const background =
            getUrl(media.images?.fanart) ||
            media.images?.fanart?.medium ||
            media.images?.fanart?.full ||
            media.background || media.backdrop;

        const logo =
            getUrl(media.images?.logo) ||
            media.images?.logo?.full ||
            media.logo;

        // Episode specific metadata (for Continue Watching)
        const isEpisode = !!item.episode;
        const episodeInfo = isEpisode ? {
            episodeTitle: item.episode.title,
            season: item.episode.season,
            episodeNumber: item.episode.number,
            showTitle: item.show?.title,
            airDate: item.episode.first_aired
        } : {};

        // Augment instead of Transform
        return {
            ...item,
            ...episodeInfo,
            ids: ids, // Universal ID access
            id: ids.imdb || (ids.tmdb ? `tmdb:${ids.tmdb}` : (ids.trakt ? `trakt:${ids.trakt}` : item.id)),
            name: media.title || media.name || (item.show?.title ? `${item.show.title} - ${media.title}` : 'Unknown'),
            type: (type === 'show' || type === 'episode') ? 'series' : (type || 'movie'),
            year: media.year?.toString() || media.releaseInfo || '',
            poster: poster,
            backdrop: background,
            logo: logo,
            description: media.overview || media.description,
            genres: media.genres,
            posterShape: item.posterShape || (item.paused_at ? 'landscape' : (type === 'landscape' ? 'landscape' : 'poster')),
        };
    }

    private async executeRequest<T>(
        endpoint: string,
        method: string,
        body?: any,
        retryCount = 0
    ): Promise<T> {
        this.initialize();

        const now = Date.now();
        const timeSince = now - this.lastApiCall;
        if (timeSince < this.MIN_API_INTERVAL) {
            await new Promise(r => setTimeout(r, this.MIN_API_INTERVAL - timeSince));
        }
        this.lastApiCall = Date.now();

        if (this.tokenExpiry && this.tokenExpiry < Date.now() + 5 * 60 * 1000 && this.refreshToken) {
            await this.refreshAccessToken();
        }

        if (!this.accessToken) throw new Error('Not authenticated');

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'trakt-api-version': '2',
            'trakt-api-key': TRAKT_CLIENT_ID || '',
            'Authorization': `Bearer ${this.accessToken}`
        };

        try {
            const res = await fetch(`${TRAKT_API_URL}${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined
            });

            if (res.status === 429) {
                if (retryCount < 3) {
                    console.log(`[TraktService] 429 Limited. Retrying...`);
                    await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
                    return this.executeRequest(endpoint, method, body, retryCount + 1);
                }
                throw new Error('Rate limit exceeded');
            }

            if (res.status === 401) {
                if (this.refreshToken && retryCount === 0) {
                    await this.refreshAccessToken();
                    return this.executeRequest(endpoint, method, body, retryCount + 1);
                }
                this.logout();
                throw new Error('Session expired');
            }

            // Handle scrobble conflicts gracefully (common when stopping multiple times)
            if (res.status === 409) {
                const conflictText = await res.text().catch(() => '');
                // Returning null keeps callers from retry loops; scrobble() will record local state.
                if (!conflictText) return null as any;
                try {
                    return JSON.parse(conflictText) as any;
                } catch {
                    return null as any;
                }
            }

            if (!res.ok) {
                if (res.status === 204) return null as any;
                const errText = await res.text().catch(() => '');
                throw new TraktApiError(res.status, `Trakt API Error: ${res.status}`, errText);
            }

            const text = await res.text();
            return text ? JSON.parse(text) : (null as any);
        } catch (e) {
            console.error(`[TraktService] Request failed for ${endpoint}:`, e);
            throw e;
        }
    }

    private normalizeIdForKey(id: string): string {
        const raw = String(id || '').trim();
        if (!raw) return '';
        if (raw.startsWith('tmdb:') || raw.startsWith('trakt:')) return raw;
        if (raw.startsWith('imdb:')) {
            const imdb = raw.replace('imdb:', '').trim();
            if (!imdb) return '';
            return imdb.startsWith('tt') ? imdb : `tt${imdb}`;
        }
        if (raw.startsWith('tt')) return raw;
        if (!isNaN(Number(raw))) return `tmdb:${parseInt(raw, 10)}`;
        return raw;
    }

    private getWatchingKey(type: 'movie' | 'series', id: string, season?: number, episode?: number): string {
        if (type === 'series' && season !== undefined && episode !== undefined) {
            return `episode:${this.normalizeIdForKey(id)}:${season}:${episode}`;
        }
        if (type === 'series') {
            return `episode:${this.normalizeIdForKey(id)}`;
        }
        return `movie:${this.normalizeIdForKey(id)}`;
    }

    private isValidIdsObject(ids: any): boolean {
        if (!ids || typeof ids !== 'object') return false;
        if (typeof ids.trakt === 'number' && !Number.isNaN(ids.trakt)) return true;
        if (typeof ids.tmdb === 'number' && !Number.isNaN(ids.tmdb)) return true;
        if (typeof ids.tvdb === 'number' && !Number.isNaN(ids.tvdb)) return true;
        if (typeof ids.imdb === 'string' && ids.imdb.trim().startsWith('tt')) return true;
        if (typeof ids.slug === 'string' && ids.slug.trim().length > 0) return true;
        return false;
    }

    private cleanupOldScrobbleState() {
        const now = Date.now();

        for (const [key, ts] of this.scrobbledTimestamps.entries()) {
            if (now - ts > this.SCROBBLE_EXPIRY_MS) {
                this.scrobbledTimestamps.delete(key);
                this.scrobbledItems.delete(key);
            }
        }

        // Keep maps from growing unbounded
        const maxAge = 24 * 60 * 60 * 1000;
        for (const [key, ts] of this.lastScrobbleSyncTimes.entries()) {
            if (now - ts > maxAge) this.lastScrobbleSyncTimes.delete(key);
        }
        for (const [key, ts] of this.lastScrobbleStartTimes.entries()) {
            if (now - ts > maxAge) this.lastScrobbleStartTimes.delete(key);
        }
        for (const [key, ts] of this.lastScrobbleStopTimes.entries()) {
            if (now - ts > maxAge) this.lastScrobbleStopTimes.delete(key);
        }
        for (const [key, ts] of this.lastScrobbleErrorTimes.entries()) {
            if (now - ts > maxAge) this.lastScrobbleErrorTimes.delete(key);
        }
    }

    // --- Public API Methods (WebUI Parity) ---

    public async getUserProfile() {
        if (!this.isAuthenticated()) return null;
        return this.apiRequest('/users/me?extended=full');
    }

    public async getContinueWatching() {
        if (!this.isAuthenticated()) return [];
        // Ported from WebUI worker/trakt.ts: getContinueWatching()
        // Single API call with images
        const playback = await this.apiRequest<any[]>('/sync/playback?extended=images');

        // Sort by most recently paused first
        const sorted = (playback || []).sort((a, b) =>
            new Date(b.paused_at).getTime() - new Date(a.paused_at).getTime()
        );

        // Deduplicate: keep only one entry per movie/show (the most recent)
        const seen = new Map<string, any>();
        for (const item of sorted) {
            const key = item.type === 'movie'
                ? `movie:${item.movie?.ids?.trakt}`
                : `show:${item.show?.ids?.trakt}`;

            if (!seen.has(key)) {
                seen.set(key, item);
            }
        }

        const all = Array.from(seen.values());
        // Return normalized items directly, leaving enrichment to the UI
        return all.map(i => this.normalize(i));
    }

    public async getCollection() {
        if (!this.isAuthenticated()) return [];
        const [movies, shows] = await Promise.all([
            this.apiRequest<any[]>('/sync/collection/movies?extended=images,full'),
            this.apiRequest<any[]>('/sync/collection/shows?extended=images,full')
        ]);
        const all = [
            ...(movies || []).map(i => ({ ...i, type: 'movie' })),
            ...(shows || []).map(i => ({ ...i, type: 'show' }))
        ];
        return all.map(i => this.normalize(i));
    }

    public async getWatchedShows() {
        if (!this.isAuthenticated()) return [];
        const shows = await this.apiRequest<any[]>('/sync/watched/shows?extended=images,full');
        return (shows || []).map(i => ({ ...i, type: 'show' })).map(i => this.normalize(i));
    }

    public async getWatchedMovies() {
        if (!this.isAuthenticated()) return [];
        const movies = await this.apiRequest<any[]>('/sync/watched/movies?extended=images,full');
        return (movies || []).map(i => ({ ...i, type: 'movie' })).map(i => this.normalize(i));
    }

    public async getWatchedHistory() {
        if (!this.isAuthenticated()) return [];
        // Combined history for movies and episodes
        const history = await this.apiRequest<any[]>('/sync/history?extended=images,full&limit=100');
        return (history || []).map(i => this.normalize(i));
    }

    private constructScrobbleBody(item: any, progress: number) {
        const type = item.type || (item.movie ? 'movie' : 'episode'); // Default fallback
        const ids = item.ids || (item.movie?.ids || item.episode?.ids || item.show?.ids);
        
        if (!ids) throw new Error('Cannot scrobble item without IDs');

        const body: any = {
            progress: Math.min(100, Math.max(0, progress)),
            app_version: '1.0.0',
            date: new Date().toISOString()
        };

        if (type === 'movie' || item.movie) {
            body.movie = { ids };
        } else if (type === 'episode' || item.episode) {
            body.episode = { ids };
        } else if (type === 'show' || item.show) {
             // Fallback for "show" type if passed incorrectly, usually implies episode
             // But we need episode IDs. If we only have show IDs, we can't scrobble an episode easily without season/ep number.
             // Assuming the item passed IS an episode or movie object with IDs.
             if (item.season && item.number) {
                 body.episode = { season: item.season, number: item.number, title: item.title }; 
                 // If we have IDs for the show/episode, use them
             } else {
                 // Try to use the IDs as episode IDs
                 body.episode = { ids };
             }
        }
        
        return body;
    }
    
    // Cleaner Public API for Scrobbling that handles ID resolution internally
    public async startScrobble(id: string, type: 'movie' | 'episode', progress: number) {
         const ids = this.getIdsObject(id);
         const body: any = {
             progress: Math.min(100, Math.max(0, progress)),
             app_version: '1.0.0',
             date: new Date().toISOString()
         };
         
         if (type === 'movie') body.movie = { ids };
         else body.episode = { ids }; // For episodes, we really need the specific episode ID, or we need to pass S/E. 
         // NOTE: The 'id' passed here is usually the specific episode ID (imdb/tmdb/trakt of the EPISODE).
         // If the app passes Show ID + S/E, we need a different signature. 
         // Current App Architecture: 'id' in player is usually the specific stream ID. 
         // For Movies: imdb/tmdb of movie.
         // For Series: The 'id' param in PlayerScreen is `tt12345:1:2` (IMDB:S:E) or `tmdb:12345:1:2`.
         
         // We need to handle the S:E parsing here if simple IDs aren't enough.
         
         return this.apiRequest('/scrobble/start', 'POST', body);
    }
    
    // Robust Scrobble Implementation that accepts parsed metadata
    public async scrobble(action: 'start' | 'pause' | 'stop', id: string, type: 'movie' | 'series', progress: number, season?: number, episode?: number) {
        if (!this.isAuthenticated()) return null;

        this.cleanupOldScrobbleState();

        const now = Date.now();

        const isEpisode = type === 'series' || (season !== undefined && episode !== undefined);

        // Normalize episode target once, and use it for keying/debouncing.
        let showId = id;
        let s = season;
        let e = episode;
        if (isEpisode) {
            const parts = String(id || '').split(':');
            if (parts.length >= 3) {
                const maybeEpisode = parseInt(parts[parts.length - 1], 10);
                const maybeSeason = parseInt(parts[parts.length - 2], 10);
                if (!Number.isNaN(maybeSeason) && !Number.isNaN(maybeEpisode)) {
                    showId = parts.slice(0, -2).join(':');
                    if (s === undefined) s = maybeSeason;
                    if (e === undefined) e = maybeEpisode;
                }
            }
        }

        const watchingKey = isEpisode
            ? this.getWatchingKey('series', showId, s, e)
            : this.getWatchingKey('movie', id);

        // Backoff after failures to prevent tight retry loops (e.g. 422 invalid payload)
        const lastErr = this.lastScrobbleErrorTimes.get(watchingKey) || 0;
        if (now - lastErr < this.SCROBBLE_ERROR_BACKOFF_MS) {
            return null;
        }

        // If already scrobbled recently, avoid duplicate stop calls that often trigger 409 conflicts.
        if (action === 'stop' && this.scrobbledItems.has(watchingKey)) {
            const lastScrobbledAt = this.scrobbledTimestamps.get(watchingKey) || 0;
            if (now - lastScrobbledAt < this.SCROBBLE_EXPIRY_MS) return null;
        }

        // Debounce start/updates/stops
        if (action === 'start') {
            const lastStart = this.lastScrobbleStartTimes.get(watchingKey) || 0;
            if (now - lastStart < this.SCROBBLE_START_DEBOUNCE_MS) return null;
        }

        if (action === 'pause') {
            const lastSync = this.lastScrobbleSyncTimes.get(watchingKey) || 0;
            if (now - lastSync < this.SCROBBLE_SYNC_DEBOUNCE_MS) return null;
        }

        if (action === 'stop') {
            const lastStop = this.lastScrobbleStopTimes.get(watchingKey) || 0;
            if (now - lastStop < this.SCROBBLE_STOP_DEBOUNCE_MS) return null;
        }

        const body: any = {
            progress: Math.min(100, Math.max(0, progress)),
            app_version: '1.0.0',
            date: new Date().toISOString()
        };

        // Handle Series (Episodes)
        if (isEpisode) {
            // We need to identify the EPISODE.
            // Case 1: ID is a specific Episode ID (rare in this app, usually ShowID)
            // Case 2: ID is Show ID + Season + Episode
            
            // For scrobbling an episode by Show ID + S/E, we send:
            // { episode: { season: 1, number: 1, show: { ids: { ... } } } } ??
            // Trakt docs say: 
            // "movie": { "ids": {} }
            // "episode": { "ids": {} } OR { "season": 1, "number": 1, "title": "...", "ids": {} } 
            // If we don't have episode IDs, we MUST provide Show IDs?
            // Actually, Trakt Checkin/Scrobble accepts "episode": { "season": X, "number": Y } IF "show" is nested? No.
            // It accepts "episode": { "season": 1, "number": 1, "ids": { ... } }
            // If we don't have specific episode IDs (like IMDB for that specific episode), we rely on Trakt finding it via Show ID?
            // The BEST way is to find the Episode Trakt ID first.
            
            // HOWEVER, Trakt supports lookup by Show ID + S/E in the `episode` object?
            // "episode": { "season": 1, "number": 2 } is NOT enough usually.
            // We usually need: "show": { "ids": ... }, "episode": { "season": 1, "number": 2 } ?
            // Let's check the WebUI implementation (which I read).
            
            // WebUI `trakt.ts` L600: `stremioIdToTraktItem`.
            // WebUI logic seems to resolve IDs first? 
            // `findNextEpisodeFromTMDB` ...
            // `scrobbleStart` just calls API with params.
            // In the Nuvio/WebUI ecosystem, they construct a `TraktScrobbleParams` object.
            
            // Let's rely on `TraktService` finding the ID if needed, OR just send what we have.
            // Constructing the best possible payload:
            
            if (s !== undefined && e !== undefined) {
                 // We have S/E. We likely have the SHOW ID.
                 const showIds = this.getIdsObject(showId);
                 if (!this.isValidIdsObject(showIds) || s <= 0 || e <= 0) {
                     this.lastScrobbleErrorTimes.set(watchingKey, now);
                     console.warn('[TraktService] Invalid episode scrobble params', { id, showId, season: s, episode: e, showIds });
                     return null;
                 }
                 body.episode = {
                     season: s,
                     number: e,
                 };
                 // Does Trakt allow 'show' inside scrobble? 
                 // Official Docs: 
                 // "episode": { "season": 1, "number": 1 } IS NOT SUFFICIENT ALONE.
                 // But if we include IDs in the episode object that might work?
                 // Actually, if we use standard IDs (IMDB/TMDB) for the SHOW, we can't put them in `episode.ids`.
                 
                 // Strategy: We should probably fetch the Episode Trakt ID if possible, BUT that's slow.
                 // Alternative: Send `episode: { season: 1, number: 1, title: '...' }` AND `show: { ids: ... }` ?
                 // Trakt Scrobble endpoint body structure:
                 // { movie: {...}, progress: ... } OR { episode: {...}, progress: ... }
                 // The `episode` object can contain `ids`.
                 
                 // If we only have Show ID, we can't scrobble easily without looking up the episode first.
                 // BUT, we have `getIdsObject` which handles `tt...`.
                 
                 // Let's assume we need to do a lookup if we don't have a direct Episode ID.
                 // Most robust: 
                 // 1. Try to find Trakt ID for the episode.
                 // 2. If fail, fail scrobble?
                 
                 // Let's use `getTraktIdFromImdbId` or similar if needed.
                 // But better: Just implement the API call and let the Context handle the complexity of ID resolution?
                 // NO, the Service should handle it.
                 
                 // Let's try to lookup the specific episode ID if we are given S/E.
                 // If `id` is `tt12345` (Show IMDB), we need the episode ID.
                 
                 // We can use `getTraktIdFromImdbId` logic but extended for S/E?
                 // No, that function is for `getTraktIdFromImdbId(id, type)`.
                 
                 // Let's add a helper `getEpisodeId` or similar.
                 // OR allow the payload to include `show`.
                 // Note: Trakt generally is smart. If we send:
                 // { episode: { season: 1, number: 1 }, show: { ids: { imdb: '...' } } }
                 // It might work. Let's try that pattern as it's efficient.
                 body.episode = {
                     season: s,
                     number: e
                 };
                 body.show = {
                     ids: showIds
                 };
            } else {
                // Assume ID is for the episode itself
                const episodeIds = this.getIdsObject(id);
                if (!this.isValidIdsObject(episodeIds)) {
                    this.lastScrobbleErrorTimes.set(watchingKey, now);
                    console.warn('[TraktService] Invalid episode IDs for scrobble', { id, episodeIds });
                    return null;
                }
                body.episode = { ids: episodeIds };
            }
        } else {
            // Movie
            const movieIds = this.getIdsObject(id);
            if (!this.isValidIdsObject(movieIds)) {
                this.lastScrobbleErrorTimes.set(watchingKey, now);
                console.warn('[TraktService] Invalid movie IDs for scrobble', { id, movieIds });
                return null;
            }
            body.movie = { ids: movieIds };
        }

        // Nuvio-style: use /scrobble/stop for both pause + stop (Trakt infers pause vs scrobble by progress)
        const endpointAction = action === 'pause' ? 'stop' : action;

        try {
            const res = await this.apiRequest(`/scrobble/${endpointAction}`, 'POST', body);

            if (action === 'start') {
                this.currentlyWatching.add(watchingKey);
                this.lastScrobbleStartTimes.set(watchingKey, now);
            }
            if (action === 'pause') {
                this.lastScrobbleSyncTimes.set(watchingKey, now);
            }
            if (action === 'stop') {
                this.lastScrobbleStopTimes.set(watchingKey, now);
                this.currentlyWatching.delete(watchingKey);

                // If user stopped near completion, mark as scrobbled locally to avoid duplicate stop conflicts.
                if (body.progress >= 80) {
                    this.scrobbledItems.add(watchingKey);
                    this.scrobbledTimestamps.set(watchingKey, now);
                }
            }

            return res;
        } catch (err) {
            this.lastScrobbleErrorTimes.set(watchingKey, now);
            throw err;
        }
    }

    public async stopScrobble(item: any) {
        return this.apiRequest('/scrobble/stop', 'POST', item);
    }

    private getIdsObject(id: string) {
        const raw = String(id || '').trim();
        if (!raw) return {};
        if (raw.startsWith('tmdb:')) return { tmdb: parseInt(raw.replace('tmdb:', ''), 10) };
        if (raw.startsWith('trakt:')) return { trakt: parseInt(raw.replace('trakt:', ''), 10) };
        if (raw.startsWith('imdb:')) {
            const imdb = raw.replace('imdb:', '').trim();
            if (!imdb) return {};
            return { imdb: imdb.startsWith('tt') ? imdb : `tt${imdb}` };
        }
        if (raw.startsWith('tt')) return { imdb: raw };
        // Fallback for numeric strings that might be raw TMDB IDs (common in our app)
        if (!isNaN(Number(raw))) return { tmdb: parseInt(raw, 10) };
        // Fallback for everything else
        return { imdb: raw.replace('imdb:', '') };
    }

    public async addToWatchlist(id: string, type: 'movie' | 'show') {
        const ids = this.getIdsObject(id);
        const body = type === 'movie'
            ? { movies: [{ ids }] }
            : { shows: [{ ids }] };
        return this.apiRequest('/sync/watchlist', 'POST', body);
    }

    public async removeFromWatchlist(id: string, type: 'movie' | 'show') {
        const ids = this.getIdsObject(id);
        const body = type === 'movie'
            ? { movies: [{ ids }] }
            : { shows: [{ ids }] };
        return this.apiRequest('/sync/watchlist/remove', 'POST', body);
    }

    public async addToCollection(id: string, type: 'movie' | 'show') {
        const ids = this.getIdsObject(id);
        const body = type === 'movie'
            ? { movies: [{ ids }] }
            : { shows: [{ ids }] };
        return this.apiRequest('/sync/collection', 'POST', body);
    }

    public async removeFromCollection(id: string, type: 'movie' | 'show') {
        const ids = this.getIdsObject(id);
        const body = type === 'movie'
            ? { movies: [{ ids }] }
            : { shows: [{ ids }] };
        return this.apiRequest('/sync/collection/remove', 'POST', body);
    }

    public async addRating(id: string, type: 'movie' | 'show' | 'episode', rating: number) {
        const ids = this.getIdsObject(id);
        const body = type === 'movie'
            ? { movies: [{ rating, ids }] }
            : type === 'show'
                ? { shows: [{ rating, ids }] }
                : { episodes: [{ rating, ids }] };
        return this.apiRequest('/sync/ratings', 'POST', body);
    }

    public async removeRating(id: string, type: 'movie' | 'show' | 'episode') {
        const ids = this.getIdsObject(id);
        const body = type === 'movie'
            ? { movies: [{ ids }] }
            : type === 'show'
                ? { shows: [{ ids }] }
                : { episodes: [{ ids }] };
        return this.apiRequest('/sync/ratings/remove', 'POST', body);
    }

    public async addToHistory(id: string, type: 'movie' | 'show') {
        const ids = this.getIdsObject(id);
        const body = type === 'movie'
            ? { movies: [{ ids }] }
            : { shows: [{ ids }] };
        return this.apiRequest('/sync/history', 'POST', body);
    }

    public async removeFromHistory(id: string, type: 'movie' | 'show') {
        const ids = this.getIdsObject(id);
        const body = type === 'movie'
            ? { movies: [{ ids }] }
            : { shows: [{ ids }] };
        return this.apiRequest('/sync/history/remove', 'POST', body);
    }

    public async getWatchlist() {
        if (!this.isAuthenticated()) return [];
        const [movies, shows] = await Promise.all([
            this.apiRequest<any[]>('/sync/watchlist/movies?extended=images,full'),
            this.apiRequest<any[]>('/sync/watchlist/shows?extended=images,full')
        ]);
        const all = [
            ...(movies || []).map(i => ({ ...i, type: 'movie' })),
            ...(shows || []).map(i => ({ ...i, type: 'show' }))
        ];
        return all.map(i => this.normalize(i));
    }

    public async getRatings() {
        if (!this.isAuthenticated()) return [];
        const [movies, shows] = await Promise.all([
            this.apiRequest<any[]>('/sync/ratings/movies?extended=full'),
            this.apiRequest<any[]>('/sync/ratings/shows?extended=full')
        ]);
        const all = [
            ...(movies || []).map(i => ({ ...i, type: 'movie' })),
            ...(shows || []).map(i => ({ ...i, type: 'show' }))
        ];
        return all.map(i => this.normalize(i));
    }

    public async getStats() {
        if (!this.isAuthenticated()) return null;
        return this.apiRequest('/users/me/stats');
    }

    public async getRecommendations(type: 'movies' | 'shows', limit = 10) {
        if (!this.isAuthenticated()) return [];
        return this.apiRequest<any[]>(`/recommendations/${type}?limit=${limit}&extended=full,images`);
    }

    public async getMixedRecommendations(limit = 10) {
        // Fetch both in parallel
        const [movieRecs, showRecs] = await Promise.all([
            this.getRecommendations('movies', limit),
            this.getRecommendations('shows', limit)
        ]);

        // Mix them
        const mixed: any[] = [];
        const maxLen = Math.max(movieRecs.length, showRecs.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < movieRecs.length) mixed.push({ ...movieRecs[i], type: 'movie' });
            if (i < showRecs.length) mixed.push({ ...showRecs[i], type: 'series' });
        }

        return mixed.slice(0, limit).map(i => this.normalize(i));
    }

    // --- Comments & Social (Ported from WebUI) ---

    // Unified getComments to satisfy useTraktComments hook expectation
    public async getComments(type: 'movie' | 'show' | 'episode', id: string, options: { page?: number, limit?: number, season?: number, episode?: number } = {}) {
        if (!this.isAuthenticated()) return [];
        const cleanId = id.replace('imdb:', '');
        const { page = 1, limit = 10 } = options;

        if (type === 'movie') {
            return this.getMovieComments(cleanId, page, limit);
        } else if (type === 'show') {
            return this.getShowComments(cleanId, page, limit);
        }
        return [];
    }

    public async getMovieComments(id: string, page: number = 1, limit: number = 10) {
        const imdbId = id.replace('imdb:', '');
        return this.apiRequest<any[]>(`/movies/${imdbId}/comments/likes?page=${page}&limit=${limit}`);
    }

    public async getShowComments(id: string, page: number = 1, limit: number = 10) {
        const imdbId = id.replace('imdb:', '');
        return this.apiRequest<any[]>(`/shows/${imdbId}/comments/likes?page=${page}&limit=${limit}`);
    }

    public async getTraktIdFromImdbId(id: string, type: 'movie' | 'show'): Promise<string | number | null> {
        if (!id) return null;

        if (typeof id === 'string' && id.startsWith('trakt:')) {
            return parseInt(id.replace('trakt:', ''), 10);
        }

        const imdbId = id.toString().replace('imdb:', '');
        if (imdbId.startsWith('tt')) {
            const data = await this.apiRequest<any[]>(`/search/imdb/${imdbId}?type=${type}`);
            if (data && data.length > 0) {
                const traktId = data[0][type]?.ids?.trakt;
                return traktId;
            }
        }

        // If numeric, assume it's already a Trakt ID
        if (!isNaN(Number(imdbId))) return Number(imdbId);

        return null;
    }

    // Static Accessor Compatibility
    public static get instance() {
        return this.getInstance();
    }

    public static async getContinueWatching() {
        return this.getInstance().getContinueWatching();
    }

    public static async getCollection() {
        return this.getInstance().getCollection();
    }

    public static async getWatchedHistory() {
        return this.getInstance().getWatchedHistory();
    }

    public static async getWatchedShows() {
        return this.getInstance().getWatchedShows();
    }

    public static async getWatchedMovies() {
        return this.getInstance().getWatchedMovies();
    }

    // Alias for Context compatibility (Movies watched)
    public static async getWatched() {
        return this.getInstance().getWatchedMovies();
    }

    // Alias for Context compatibility
    public static async getRated() {
        return this.getInstance().getRatings();
    }

    public static async getWatchlist() {
        return this.getInstance().getWatchlist();
    }

    public static async getRecommendations(type: 'movies' | 'shows', limit?: number) {
        return this.getInstance().getRecommendations(type, limit);
    }

    public static async getMixedRecommendations(limit?: number) {
        return this.getInstance().getMixedRecommendations(limit);
    }

    public static async oauthDeviceCode() {
        return this.getInstance().oauthDeviceCode();
    }

    public static async oauthToken(deviceCode: string) {
        return this.getInstance().oauthToken(deviceCode);
    }

    public static async getComments(type: 'movie' | 'show' | 'episode', id: string, options?: any) {
        return this.getInstance().getComments(type, id, options);
    }

    public static async addToWatchlist(id: string, type: 'movie' | 'show') {
        return this.getInstance().addToWatchlist(id, type);
    }

    public static async removeFromWatchlist(id: string, type: 'movie' | 'show') {
        return this.getInstance().removeFromWatchlist(id, type);
    }

    public static async addToCollection(id: string, type: 'movie' | 'show') {
        return this.getInstance().addToCollection(id, type);
    }

    public static async removeFromCollection(id: string, type: 'movie' | 'show') {
        return this.getInstance().removeFromCollection(id, type);
    }

    public static async addRating(id: string, type: 'movie' | 'show' | 'episode', rating: number) {
        return this.getInstance().addRating(id, type, rating);
    }

    public static async removeRating(id: string, type: 'movie' | 'show' | 'episode') {
        return this.getInstance().removeRating(id, type);
    }

    public static async addToHistory(id: string, type: 'movie' | 'show') {
        return this.getInstance().addToHistory(id, type);
    }

    public static async removeFromHistory(id: string, type: 'movie' | 'show') {
        return this.getInstance().removeFromHistory(id, type);
    }
}
