import { TraktAuth, useUserStore } from '../../features/trakt/stores/userStore';
import { StorageService } from '../storage';

// Helper to safely get IDs
const media_ids = (item: any) => item?.ids || {};

// Storage keys - these will be prefixed by StorageService for per-user isolation
const TRAKT_AUTH_KEY = 'crispy-trakt-auth';

// Trakt API configuration
const TRAKT_API_URL = 'https://api.trakt.tv';
const TRAKT_CLIENT_ID = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
const TRAKT_CLIENT_SECRET = process.env.EXPO_PUBLIC_TRAKT_CLIENT_SECRET;
const TRAKT_REDIRECT_URI = 'crispy-native://auth/trakt';

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
        const poster =
            media.images?.poster?.[0] ||
            media.images?.poster?.medium ||
            media.images?.poster?.full ||
            media.poster;

        const background =
            media.images?.fanart?.[0] ||
            media.images?.fanart?.medium ||
            media.images?.fanart?.full ||
            media.background || media.backdrop;

        const logo =
            media.images?.logo?.[0] ||
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
        retryCount: number
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

            if (!res.ok) {
                if (res.status === 204) return null as T;
                throw new Error(`Trakt API Error: ${res.status}`);
            }

            const text = await res.text();
            return text ? JSON.parse(text) : null;
        } catch (e) {
            console.error(`[TraktService] Request failed for ${endpoint}:`, e);
            throw e;
        }
    }

    // --- Public API Methods (WebUI Parity) ---

    public async getUserProfile() {
        return this.apiRequest('/users/me?extended=full');
    }

    public async getContinueWatching() {
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
        const [movies, shows] = await Promise.all([
            this.apiRequest<any[]>('/sync/collection/movies?extended=full'),
            this.apiRequest<any[]>('/sync/collection/shows?extended=full')
        ]);
        const all = [
            ...(movies || []).map(i => ({ ...i, type: 'movie' })),
            ...(shows || []).map(i => ({ ...i, type: 'show' }))
        ];
        return all.map(i => this.normalize(i));
    }

    public async getWatchedShows() {
        const shows = await this.apiRequest<any[]>('/sync/watched/shows?extended=full');
        return (shows || []).map(i => ({ ...i, type: 'show' })).map(i => this.normalize(i));
    }

    public async getWatchedMovies() {
        const movies = await this.apiRequest<any[]>('/sync/watched/movies?extended=full');
        return (movies || []).map(i => ({ ...i, type: 'movie' })).map(i => this.normalize(i));
    }

    public async stopScrobble(item: any) {
        return this.apiRequest('/scrobble/stop', 'POST', item);
    }

    public async addToWatchlist(id: string, type: 'movie' | 'show') {
        const body = type === 'movie'
            ? { movies: [{ ids: { imdb: id.replace('imdb:', '') } }] }
            : { shows: [{ ids: { imdb: id.replace('imdb:', '') } }] };
        return this.apiRequest('/sync/watchlist', 'POST', body);
    }

    public async removeFromWatchlist(id: string, type: 'movie' | 'show') {
        const body = type === 'movie'
            ? { movies: [{ ids: { imdb: id.replace('imdb:', '') } }] }
            : { shows: [{ ids: { imdb: id.replace('imdb:', '') } }] };
        return this.apiRequest('/sync/watchlist/remove', 'POST', body);
    }

    public async addToCollection(id: string, type: 'movie' | 'show') {
        const body = type === 'movie'
            ? { movies: [{ ids: { imdb: id.replace('imdb:', '') } }] }
            : { shows: [{ ids: { imdb: id.replace('imdb:', '') } }] };
        return this.apiRequest('/sync/collection', 'POST', body);
    }

    public async removeFromCollection(id: string, type: 'movie' | 'show') {
        const body = type === 'movie'
            ? { movies: [{ ids: { imdb: id.replace('imdb:', '') } }] }
            : { shows: [{ ids: { imdb: id.replace('imdb:', '') } }] };
        return this.apiRequest('/sync/collection/remove', 'POST', body);
    }

    public async addRating(id: string, type: 'movie' | 'show' | 'episode', rating: number) {
        const body = type === 'movie'
            ? { movies: [{ rating, ids: { imdb: id.replace('imdb:', '') } }] }
            : type === 'show'
                ? { shows: [{ rating, ids: { imdb: id.replace('imdb:', '') } }] }
                : { episodes: [{ rating, ids: { imdb: id.replace('imdb:', '') } }] };
        return this.apiRequest('/sync/ratings', 'POST', body);
    }

    public async removeRating(id: string, type: 'movie' | 'show' | 'episode') {
        const body = type === 'movie'
            ? { movies: [{ ids: { imdb: id.replace('imdb:', '') } }] }
            : type === 'show'
                ? { shows: [{ ids: { imdb: id.replace('imdb:', '') } }] }
                : { episodes: [{ ids: { imdb: id.replace('imdb:', '') } }] };
        return this.apiRequest('/sync/ratings/remove', 'POST', body);
    }

    public async addToHistory(id: string, type: 'movie' | 'show') {
        const body = type === 'movie'
            ? { movies: [{ ids: { imdb: id.replace('imdb:', '') } }] }
            : { shows: [{ ids: { imdb: id.replace('imdb:', '') } }] };
        return this.apiRequest('/sync/history', 'POST', body);
    }

    public async removeFromHistory(id: string, type: 'movie' | 'show') {
        const body = type === 'movie'
            ? { movies: [{ ids: { imdb: id.replace('imdb:', '') } }] }
            : { shows: [{ ids: { imdb: id.replace('imdb:', '') } }] };
        return this.apiRequest('/sync/history/remove', 'POST', body);
    }

    public async getWatchlist() {
        const [movies, shows] = await Promise.all([
            this.apiRequest<any[]>('/sync/watchlist/movies?extended=full'),
            this.apiRequest<any[]>('/sync/watchlist/shows?extended=full')
        ]);
        const all = [
            ...(movies || []).map(i => ({ ...i, type: 'movie' })),
            ...(shows || []).map(i => ({ ...i, type: 'show' }))
        ];
        return all.map(i => this.normalize(i));
    }

    public async getRatings() {
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
        return this.apiRequest('/users/me/stats');
    }

    // --- Comments & Social (Ported from WebUI) ---

    // Unified getComments to satisfy useTraktComments hook expectation
    public async getComments(type: 'movie' | 'show' | 'episode', id: string, options: { page?: number, limit?: number, season?: number, episode?: number } = {}) {
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
